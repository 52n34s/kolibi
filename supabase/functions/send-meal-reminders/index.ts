import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@3.2.0';

const FALLBACK_TIME_ZONE = 'Europe/Berlin';
const MIN_SAMPLES = 3;
const WINDOW_MINUTES = 20;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100;

/** Breakfast [04:00, 11:00), lunch [11:00, 16:00), dinner [16:00, 24:00). */
const BREAKFAST_START_MIN = 4 * 60;
const BREAKFAST_END_MIN = 11 * 60;
const LUNCH_END_MIN = 16 * 60;
const DINNER_END_MIN = 24 * 60;

const BUCKETS = ['breakfast', 'lunch', 'dinner'] as const;
type MealBucket = (typeof BUCKETS)[number];

const FALLBACK_TARGET_MINUTES: Record<MealBucket, number> = {
  breakfast: 8 * 60,
  lunch: 13 * 60,
  dinner: 19 * 60,
};

/** v1 DE-first copy; structure is ready for later locale maps. */
const REMINDER_COPY: Record<MealBucket, { title: string; body: string }> = {
  breakfast: {
    title: 'Kolibi',
    body: 'Zeit fürs Frühstück? Vergiss nicht zu tracken 📸',
  },
  lunch: {
    title: 'Kolibi',
    body: 'Mittagessen schon geloggt?',
  },
  dinner: {
    title: 'Kolibi',
    body: 'Wie war dein Abendessen? Kurz festhalten.',
  },
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type MealTimeStatsRow = {
  user_id: string;
  breakfast_avg_time: string | null;
  lunch_avg_time: string | null;
  dinner_avg_time: string | null;
  breakfast_sample_count: number;
  lunch_sample_count: number;
  dinner_sample_count: number;
};

type ProfileTimezoneRow = {
  id: string;
  timezone: string | null;
};

type MealRow = {
  user_id: string;
  eaten_at: string;
};

type ReminderLogRow = {
  user_id: string;
  meal_bucket: MealBucket;
  sent_on: string;
};

type PendingReminder = {
  userId: string;
  bucket: MealBucket;
  timeZone: string;
  localDate: string;
  tokens: string[];
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
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

function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    formatInTimeZone(new Date(), timeZone, 'H');
    return true;
  } catch {
    return false;
  }
}

function resolveUserTimeZone(userId: string, raw: string | null | undefined): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed || !isValidIanaTimeZone(trimmed)) {
    console.warn(
      `[send-meal-reminders] invalid or missing timezone for user ${userId}; ` +
        `raw=${JSON.stringify(raw)}; falling back to ${FALLBACK_TIME_ZONE}`,
    );
    return FALLBACK_TIME_ZONE;
  }

  return trimmed;
}

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
    console.warn(`[send-meal-reminders] formatInTimeZone failed for zone ${timeZone}:`, error);
    return null;
  }
}

function localDateInZone(isoTimestamp: string, timeZone: string): string | null {
  try {
    return formatInTimeZone(new Date(isoTimestamp), timeZone, 'yyyy-MM-dd');
  } catch (error) {
    console.warn(`[send-meal-reminders] localDateInZone failed for zone ${timeZone}:`, error);
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

  return null;
}

/** Circular minute distance on a 24h clock (handles midnight wrap). */
function circularMinuteDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 * 60 - diff);
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function resolveTargetMinutes(stats: MealTimeStatsRow | undefined, bucket: MealBucket): number {
  if (!stats) {
    return FALLBACK_TARGET_MINUTES[bucket];
  }

  const avgTime =
    bucket === 'breakfast'
      ? stats.breakfast_avg_time
      : bucket === 'lunch'
        ? stats.lunch_avg_time
        : stats.dinner_avg_time;

  const sampleCount =
    bucket === 'breakfast'
      ? stats.breakfast_sample_count
      : bucket === 'lunch'
        ? stats.lunch_sample_count
        : stats.dinner_sample_count;

  if (sampleCount >= MIN_SAMPLES) {
    const parsed = parseTimeToMinutes(avgTime);
    if (parsed != null) {
      return parsed;
    }
  }

  return FALLBACK_TARGET_MINUTES[bucket];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
): Promise<{ ok: boolean; error?: string }> {
  if (messages.length === 0) {
    return { ok: true };
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Expo HTTP ${response.status}: ${text.slice(0, 300)}` };
    }

    const payload = await response.json() as {
      data?: Array<{ status?: string; message?: string; details?: { error?: string } }>;
    };

    const tickets = payload.data ?? [];
    const ticketErrors = tickets
      .filter((ticket) => ticket.status === 'error')
      .map((ticket) => ticket.message ?? ticket.details?.error ?? 'unknown')
      .filter(Boolean);

    if (ticketErrors.length === tickets.length && tickets.length > 0) {
      return { ok: false, error: ticketErrors.join('; ') };
    }

    if (ticketErrors.length > 0) {
      console.warn('[send-meal-reminders] partial Expo ticket errors:', ticketErrors);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

  const serviceClient: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const nowIso = now.toISOString();

  let usersChecked = 0;
  let remindersSent = 0;
  let skippedAlreadyLogged = 0;
  let skippedAlreadySent = 0;
  let skippedOutsideWindow = 0;
  let errors = 0;

  const { data: tokenRows, error: tokensError } = await serviceClient
    .from('push_tokens')
    .select('user_id, expo_push_token');

  if (tokensError) {
    console.error('Failed to load push_tokens:', tokensError);
    return jsonResponse({ error: 'PUSH_TOKENS_QUERY_FAILED', message: tokensError.message }, 500);
  }

  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokenRows ?? []) as PushTokenRow[]) {
    if (!row?.user_id || !row?.expo_push_token) {
      continue;
    }

    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.expo_push_token);
    tokensByUser.set(row.user_id, list);
  }

  const userIds = [...tokensByUser.keys()];
  usersChecked = userIds.length;

  if (userIds.length === 0) {
    return jsonResponse({
      ok: true,
      usersChecked: 0,
      remindersSent: 0,
      skippedAlreadyLogged: 0,
      skippedAlreadySent: 0,
      skippedOutsideWindow: 0,
      errors: 0,
      now: nowIso,
    });
  }

  const [{ data: statsRows, error: statsError }, { data: profileRows, error: profilesError }] =
    await Promise.all([
      serviceClient.from('user_meal_time_stats').select(
        'user_id, breakfast_avg_time, lunch_avg_time, dinner_avg_time, breakfast_sample_count, lunch_sample_count, dinner_sample_count',
      ).in('user_id', userIds),
      serviceClient.from('profiles').select('id, timezone').in('id', userIds),
    ]);

  if (statsError) {
    console.error('Failed to load user_meal_time_stats:', statsError);
    return jsonResponse({ error: 'STATS_QUERY_FAILED', message: statsError.message }, 500);
  }

  if (profilesError) {
    console.error('Failed to load profiles.timezone:', profilesError);
    return jsonResponse({ error: 'PROFILES_QUERY_FAILED', message: profilesError.message }, 500);
  }

  const statsByUser = new Map<string, MealTimeStatsRow>();
  for (const row of (statsRows ?? []) as MealTimeStatsRow[]) {
    statsByUser.set(row.user_id, row);
  }

  const timezoneByUser = new Map<string, string>();
  for (const profile of (profileRows ?? []) as ProfileTimezoneRow[]) {
    timezoneByUser.set(profile.id, resolveUserTimeZone(profile.id, profile.timezone));
  }

  for (const userId of userIds) {
    if (!timezoneByUser.has(userId)) {
      console.warn(
        `[send-meal-reminders] missing profile for user ${userId}; falling back to ${FALLBACK_TIME_ZONE}`,
      );
      timezoneByUser.set(userId, FALLBACK_TIME_ZONE);
    }
  }

  const windowCandidates: PendingReminder[] = [];

  for (const userId of userIds) {
    const timeZone = timezoneByUser.get(userId) ?? FALLBACK_TIME_ZONE;
    const localDate = localDateInZone(nowIso, timeZone);
    const nowMinutes = minutesSinceMidnightInZone(nowIso, timeZone);
    if (localDate == null || nowMinutes == null) {
      errors += 1;
      continue;
    }

    const stats = statsByUser.get(userId);
    const tokens = tokensByUser.get(userId) ?? [];
    if (tokens.length === 0) {
      continue;
    }

    for (const bucket of BUCKETS) {
      const targetMinutes = resolveTargetMinutes(stats, bucket);
      if (circularMinuteDistance(nowMinutes, targetMinutes) > WINDOW_MINUTES) {
        skippedOutsideWindow += 1;
        continue;
      }

      windowCandidates.push({
        userId,
        bucket,
        timeZone,
        localDate,
        tokens,
      });
    }
  }

  if (windowCandidates.length === 0) {
    return jsonResponse({
      ok: true,
      usersChecked,
      remindersSent: 0,
      skippedAlreadyLogged: 0,
      skippedAlreadySent: 0,
      skippedOutsideWindow,
      errors,
      now: nowIso,
    });
  }

  const candidateUserIds = [...new Set(windowCandidates.map((c) => c.userId))];

  // Wide lookback covers every candidate's local "today" regardless of UTC offset.
  const mealsSince = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [{ data: mealRows, error: mealsError }, { data: logRows, error: logsError }] =
    await Promise.all([
      serviceClient
        .from('meals')
        .select('user_id, eaten_at')
        .in('user_id', candidateUserIds)
        .gte('eaten_at', mealsSince),
      serviceClient
        .from('push_reminder_log')
        .select('user_id, meal_bucket, sent_on')
        .in('user_id', candidateUserIds),
    ]);

  if (mealsError) {
    console.error('Failed to load meals for reminder skip check:', mealsError);
    return jsonResponse({ error: 'MEALS_QUERY_FAILED', message: mealsError.message }, 500);
  }

  if (logsError) {
    console.error('Failed to load push_reminder_log:', logsError);
    return jsonResponse({ error: 'REMINDER_LOG_QUERY_FAILED', message: logsError.message }, 500);
  }

  const loggedBucketsByUserDate = new Map<string, Set<MealBucket>>();
  for (const meal of (mealRows ?? []) as MealRow[]) {
    if (!meal?.user_id || !meal?.eaten_at) {
      continue;
    }

    const timeZone = timezoneByUser.get(meal.user_id) ?? FALLBACK_TIME_ZONE;
    const mealLocalDate = localDateInZone(meal.eaten_at, timeZone);
    const mealMinutes = minutesSinceMidnightInZone(meal.eaten_at, timeZone);
    if (mealLocalDate == null || mealMinutes == null) {
      continue;
    }

    const bucket = classifyBucket(mealMinutes);
    if (!bucket) {
      continue;
    }

    const key = `${meal.user_id}|${mealLocalDate}`;
    const set = loggedBucketsByUserDate.get(key) ?? new Set<MealBucket>();
    set.add(bucket);
    loggedBucketsByUserDate.set(key, set);
  }

  const alreadySent = new Set<string>();
  for (const row of (logRows ?? []) as ReminderLogRow[]) {
    alreadySent.add(`${row.user_id}|${row.meal_bucket}|${row.sent_on}`);
  }

  const toSend: PendingReminder[] = [];

  for (const candidate of windowCandidates) {
    const mealKey = `${candidate.userId}|${candidate.localDate}`;
    if (loggedBucketsByUserDate.get(mealKey)?.has(candidate.bucket)) {
      skippedAlreadyLogged += 1;
      continue;
    }

    const sentKey = `${candidate.userId}|${candidate.bucket}|${candidate.localDate}`;
    if (alreadySent.has(sentKey)) {
      skippedAlreadySent += 1;
      continue;
    }

    toSend.push(candidate);
  }

  for (const reminder of toSend) {
    const copy = REMINDER_COPY[reminder.bucket];
    const messages: ExpoPushMessage[] = reminder.tokens.map((token) => ({
      to: token,
      title: copy.title,
      body: copy.body,
      sound: 'default',
    }));

    let sendFailed = false;
    for (const chunk of chunkArray(messages, EXPO_CHUNK_SIZE)) {
      const result = await sendExpoPushMessages(chunk);
      if (!result.ok) {
        sendFailed = true;
        errors += 1;
        console.error(
          `[send-meal-reminders] Expo send failed user=${reminder.userId} bucket=${reminder.bucket}:`,
          result.error,
        );
        break;
      }
    }

    if (sendFailed) {
      continue;
    }

    const { error: insertError } = await serviceClient.from('push_reminder_log').insert({
      user_id: reminder.userId,
      meal_bucket: reminder.bucket,
      sent_on: reminder.localDate,
    });

    if (insertError) {
      // Unique race: another concurrent run already logged — treat as already sent.
      if (insertError.code === '23505') {
        skippedAlreadySent += 1;
        continue;
      }

      errors += 1;
      console.error(
        `[send-meal-reminders] log insert failed user=${reminder.userId} bucket=${reminder.bucket}:`,
        insertError,
      );
      continue;
    }

    remindersSent += 1;
  }

  return jsonResponse({
    ok: true,
    usersChecked,
    remindersSent,
    skippedAlreadyLogged,
    skippedAlreadySent,
    skippedOutsideWindow,
    errors,
    now: nowIso,
  });
});
