import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@3.2.0';

const FALLBACK_TIME_ZONE = 'Europe/Berlin';
const LOOKBACK_DAYS = 30;
const MIN_SAMPLES = 3;

/** Breakfast [04:00, 11:00), lunch [11:00, 16:00), dinner [16:00, 24:00). */
const BREAKFAST_START_MIN = 4 * 60;
const BREAKFAST_END_MIN = 11 * 60;
const LUNCH_END_MIN = 16 * 60;
const DINNER_END_MIN = 24 * 60;

type MealBucket = 'breakfast' | 'lunch' | 'dinner';

type MealRow = {
  user_id: string;
  eaten_at: string;
};

type ProfileTimezoneRow = {
  id: string;
  timezone: string | null;
};

type BucketAgg = {
  sumMinutes: number;
  count: number;
};

type UserMealTimeStatsRow = {
  user_id: string;
  breakfast_avg_time: string | null;
  lunch_avg_time: string | null;
  dinner_avg_time: string | null;
  breakfast_sample_count: number;
  lunch_sample_count: number;
  dinner_sample_count: number;
  updated_at: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/** Returns true when date-fns-tz can format with this IANA zone. */
function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    formatInTimeZone(new Date(), timeZone, 'H');
    return true;
  } catch {
    return false;
  }
}

function resolveUserTimeZone(userId: string, raw: string | null | undefined): {
  timeZone: string;
  usedFallback: boolean;
} {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed || !isValidIanaTimeZone(trimmed)) {
    console.warn(
      `[compute-meal-time-stats] invalid or missing timezone for user ${userId}; ` +
        `raw=${JSON.stringify(raw)}; falling back to ${FALLBACK_TIME_ZONE}`,
    );
    return { timeZone: FALLBACK_TIME_ZONE, usedFallback: true };
  }

  return { timeZone: trimmed, usedFallback: false };
}

/** Local wall-clock minutes since midnight in the given IANA zone (DST-aware). */
function minutesSinceMidnightInZone(isoTimestamp: string, timeZone: string): number | null {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const hour = Number(formatInTimeZone(date, timeZone, 'H'));
    const minute = Number(formatInTimeZone(date, timeZone, 'm'));
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    return hour * 60 + minute;
  } catch (error) {
    console.warn(
      `[compute-meal-time-stats] formatInTimeZone failed for zone ${timeZone}:`,
      error,
    );
    return null;
  }
}

function classifyBucket(minutesSinceMidnight: number): MealBucket | null {
  if (minutesSinceMidnight >= BREAKFAST_START_MIN && minutesSinceMidnight < BREAKFAST_END_MIN) {
    return 'breakfast';
  }

  if (minutesSinceMidnight >= BREAKFAST_END_MIN && minutesSinceMidnight < LUNCH_END_MIN) {
    return 'lunch';
  }

  if (minutesSinceMidnight >= LUNCH_END_MIN && minutesSinceMidnight < DINNER_END_MIN) {
    return 'dinner';
  }

  // 00:00–03:59: outside reminder windows for v1
  return null;
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(Math.round(totalMinutes), 24 * 60 - 1));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function averageTimeOrNull(agg: BucketAgg): string | null {
  if (agg.count < MIN_SAMPLES) {
    return null;
  }

  return minutesToTime(agg.sumMinutes / agg.count);
}

function emptyAgg(): BucketAgg {
  return { sumMinutes: 0, count: 0 };
}

function buildStatsRow(
  userId: string,
  breakfast: BucketAgg,
  lunch: BucketAgg,
  dinner: BucketAgg,
): UserMealTimeStatsRow {
  return {
    user_id: userId,
    breakfast_avg_time: averageTimeOrNull(breakfast),
    lunch_avg_time: averageTimeOrNull(lunch),
    dinner_avg_time: averageTimeOrNull(dinner),
    breakfast_sample_count: breakfast.count,
    lunch_sample_count: lunch.count,
    dinner_sample_count: dinner.count,
    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase environment is not configured.');
    return jsonResponse({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  if (!cronSecret) {
    console.error('CRON_SECRET is not configured.');
    return jsonResponse({ error: 'MISCONFIGURED' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
  const sinceIso = since.toISOString();

  const { data: meals, error: mealsError } = await serviceClient
    .from('meals')
    .select('user_id, eaten_at')
    .gte('eaten_at', sinceIso);

  if (mealsError) {
    console.error('Failed to load meals for meal-time stats:', mealsError);
    return jsonResponse({ error: 'MEALS_QUERY_FAILED', message: mealsError.message }, 500);
  }

  const mealRows = (meals ?? []) as MealRow[];
  const userIds = [...new Set(mealRows.map((row) => row.user_id).filter(Boolean))];

  const timezoneByUserId = new Map<string, string>();
  let timezoneFallbackCount = 0;

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id, timezone')
      .in('id', userIds);

    if (profilesError) {
      console.error('Failed to load profiles.timezone:', profilesError);
      return jsonResponse({ error: 'PROFILES_QUERY_FAILED', message: profilesError.message }, 500);
    }

    for (const profile of (profiles ?? []) as ProfileTimezoneRow[]) {
      const resolved = resolveUserTimeZone(profile.id, profile.timezone);
      timezoneByUserId.set(profile.id, resolved.timeZone);
      if (resolved.usedFallback) {
        timezoneFallbackCount += 1;
      }
    }
  }

  for (const userId of userIds) {
    if (!timezoneByUserId.has(userId)) {
      console.warn(
        `[compute-meal-time-stats] missing profile for user ${userId}; ` +
          `falling back to ${FALLBACK_TIME_ZONE}`,
      );
      timezoneByUserId.set(userId, FALLBACK_TIME_ZONE);
      timezoneFallbackCount += 1;
    }
  }

  const byUser = new Map<
    string,
    { breakfast: BucketAgg; lunch: BucketAgg; dinner: BucketAgg }
  >();

  for (const row of mealRows) {
    if (!row?.user_id || !row?.eaten_at) {
      continue;
    }

    const timeZone = timezoneByUserId.get(row.user_id) ?? FALLBACK_TIME_ZONE;
    const minutes = minutesSinceMidnightInZone(row.eaten_at, timeZone);
    if (minutes == null) {
      continue;
    }

    const bucket = classifyBucket(minutes);
    if (!bucket) {
      continue;
    }

    let aggs = byUser.get(row.user_id);
    if (!aggs) {
      aggs = {
        breakfast: emptyAgg(),
        lunch: emptyAgg(),
        dinner: emptyAgg(),
      };
      byUser.set(row.user_id, aggs);
    }

    const target = aggs[bucket];
    target.sumMinutes += minutes;
    target.count += 1;
  }

  const upsertRows: UserMealTimeStatsRow[] = [];
  for (const [userId, aggs] of byUser) {
    upsertRows.push(buildStatsRow(userId, aggs.breakfast, aggs.lunch, aggs.dinner));
  }

  if (upsertRows.length === 0) {
    return jsonResponse({
      ok: true,
      usersProcessed: 0,
      rowsUpserted: 0,
      lookbackDays: LOOKBACK_DAYS,
      timezoneFallbacks: timezoneFallbackCount,
      since: sinceIso,
    });
  }

  const { error: upsertError } = await serviceClient
    .from('user_meal_time_stats')
    .upsert(upsertRows, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('Failed to upsert user_meal_time_stats:', upsertError);
    return jsonResponse({ error: 'UPSERT_FAILED', message: upsertError.message }, 500);
  }

  return jsonResponse({
    ok: true,
    usersProcessed: upsertRows.length,
    rowsUpserted: upsertRows.length,
    lookbackDays: LOOKBACK_DAYS,
    timezoneFallbacks: timezoneFallbackCount,
    since: sinceIso,
  });
});
