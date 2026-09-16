import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@3.2.0';

const FALLBACK_TIME_ZONE = 'Europe/Berlin';
/**
 * Forward half-open window [remind_at, remind_at + WINDOW).
 * Must match the pg_cron interval (send-meal-reminders / this function: */30).
 * Never fires early; max lateness ≈ WINDOW_MINUTES − ε.
 */
const WINDOW_MINUTES = 30;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100;

type ReminderLocale = 'de' | 'en' | 'es';

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type NotificationPreferencesRow = {
  user_id: string;
  reminder_locale: string | null;
};

type ProfileTimezoneRow = {
  id: string;
  timezone: string | null;
};

type SupplementReminderRow = {
  id: string;
  user_id: string;
  label: string | null;
  remind_at: string;
  is_enabled: boolean;
};

type ReminderItemRow = {
  reminder_id: string;
  supplement_id: string;
};

type ReminderLogRow = {
  reminder_id: string;
  sent_on: string;
};

type DueSupplement = {
  id: string;
  name: string;
};

type PendingReminder = {
  userId: string;
  reminderId: string;
  label: string | null;
  localDate: string;
  locale: ReminderLocale;
  tokens: string[];
  names: string[];
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { url: string };
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
      `[send-supplement-reminders] invalid or missing timezone for user ${userId}; ` +
        `raw=${JSON.stringify(raw)}; falling back to ${FALLBACK_TIME_ZONE}`,
    );
    return FALLBACK_TIME_ZONE;
  }

  return trimmed;
}

function resolveLocale(raw: string | null | undefined): ReminderLocale {
  if (raw === 'de' || raw === 'en' || raw === 'es') {
    return raw;
  }
  return 'de';
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
    console.warn(
      `[send-supplement-reminders] formatInTimeZone failed for zone ${timeZone}:`,
      error,
    );
    return null;
  }
}

function localDateInZone(isoTimestamp: string, timeZone: string): string | null {
  try {
    return formatInTimeZone(new Date(isoTimestamp), timeZone, 'yyyy-MM-dd');
  } catch (error) {
    console.warn(
      `[send-supplement-reminders] localDateInZone failed for zone ${timeZone}:`,
      error,
    );
    return null;
  }
}

/**
 * Minutes elapsed since remind_at on a 24h clock (0 = exactly on time).
 * Values in [0, WINDOW_MINUTES) are in the forward send window.
 */
function minutesSinceRemindAt(nowMinutes: number, targetMinutes: number): number {
  return (nowMinutes - targetMinutes + 24 * 60) % (24 * 60);
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildBody(locale: ReminderLocale, names: string[]): string {
  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return names[0]!;
  }

  const more = names.length - 1;
  if (locale === 'en') {
    return `${names[0]} and ${more} more`;
  }
  if (locale === 'es') {
    return `${names[0]} y ${more} más`;
  }
  return `${names[0]} und ${more} weitere`;
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
      console.warn('[send-supplement-reminders] partial Expo ticket errors:', ticketErrors);
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
  let skippedOutsideWindow = 0;
  let skippedEmptyIntersection = 0;
  let skippedAlreadySent = 0;
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
      skippedOutsideWindow: 0,
      skippedEmptyIntersection: 0,
      skippedAlreadySent: 0,
      errors: 0,
      now: nowIso,
    });
  }

  const [
    { data: prefRows, error: prefsError },
    { data: profileRows, error: profilesError },
    { data: reminderRows, error: remindersError },
  ] = await Promise.all([
    serviceClient
      .from('notification_preferences')
      .select('user_id, reminder_locale')
      .in('user_id', userIds),
    serviceClient.from('profiles').select('id, timezone').in('id', userIds),
    serviceClient
      .from('supplement_reminders')
      .select('id, user_id, label, remind_at, is_enabled')
      .in('user_id', userIds)
      .eq('is_enabled', true),
  ]);

  if (prefsError) {
    console.error('Failed to load notification_preferences:', prefsError);
    return jsonResponse({ error: 'PREFS_QUERY_FAILED', message: prefsError.message }, 500);
  }

  if (profilesError) {
    console.error('Failed to load profiles.timezone:', profilesError);
    return jsonResponse({ error: 'PROFILES_QUERY_FAILED', message: profilesError.message }, 500);
  }

  if (remindersError) {
    console.error('Failed to load supplement_reminders:', remindersError);
    return jsonResponse({ error: 'REMINDERS_QUERY_FAILED', message: remindersError.message }, 500);
  }

  const prefsByUser = new Map<string, NotificationPreferencesRow>();
  for (const row of (prefRows ?? []) as NotificationPreferencesRow[]) {
    prefsByUser.set(row.user_id, row);
  }

  const timezoneByUser = new Map<string, string>();
  for (const profile of (profileRows ?? []) as ProfileTimezoneRow[]) {
    timezoneByUser.set(profile.id, resolveUserTimeZone(profile.id, profile.timezone));
  }

  for (const userId of userIds) {
    if (!timezoneByUser.has(userId)) {
      console.warn(
        `[send-supplement-reminders] missing profile for user ${userId}; falling back to ${FALLBACK_TIME_ZONE}`,
      );
      timezoneByUser.set(userId, FALLBACK_TIME_ZONE);
    }
  }

  const enabledReminders = (reminderRows ?? []) as SupplementReminderRow[];
  if (enabledReminders.length === 0) {
    return jsonResponse({
      ok: true,
      usersChecked,
      remindersSent: 0,
      skippedOutsideWindow: 0,
      skippedEmptyIntersection: 0,
      skippedAlreadySent: 0,
      errors,
      now: nowIso,
    });
  }

  const inWindow: Array<{
    reminder: SupplementReminderRow;
    localDate: string;
    locale: ReminderLocale;
    tokens: string[];
  }> = [];

  for (const reminder of enabledReminders) {
    const tokens = tokensByUser.get(reminder.user_id) ?? [];
    if (tokens.length === 0) {
      continue;
    }

    const timeZone = timezoneByUser.get(reminder.user_id) ?? FALLBACK_TIME_ZONE;
    const localDate = localDateInZone(nowIso, timeZone);
    const nowMinutes = minutesSinceMidnightInZone(nowIso, timeZone);
    const targetMinutes = parseTimeToMinutes(reminder.remind_at);

    if (localDate == null || nowMinutes == null || targetMinutes == null) {
      errors += 1;
      continue;
    }

    if (minutesSinceRemindAt(nowMinutes, targetMinutes) >= WINDOW_MINUTES) {
      skippedOutsideWindow += 1;
      continue;
    }

    inWindow.push({
      reminder,
      localDate,
      locale: resolveLocale(prefsByUser.get(reminder.user_id)?.reminder_locale),
      tokens,
    });
  }

  if (inWindow.length === 0) {
    return jsonResponse({
      ok: true,
      usersChecked,
      remindersSent: 0,
      skippedOutsideWindow,
      skippedEmptyIntersection: 0,
      skippedAlreadySent: 0,
      errors,
      now: nowIso,
    });
  }

  const reminderIds = inWindow.map((entry) => entry.reminder.id);

  const [{ data: itemRows, error: itemsError }, { data: logRows, error: logsError }] =
    await Promise.all([
      serviceClient
        .from('supplement_reminder_items')
        .select('reminder_id, supplement_id')
        .in('reminder_id', reminderIds),
      serviceClient
        .from('supplement_reminder_log')
        .select('reminder_id, sent_on')
        .in('reminder_id', reminderIds),
    ]);

  if (itemsError) {
    console.error('Failed to load supplement_reminder_items:', itemsError);
    return jsonResponse({ error: 'REMINDER_ITEMS_QUERY_FAILED', message: itemsError.message }, 500);
  }

  if (logsError) {
    console.error('Failed to load supplement_reminder_log:', logsError);
    return jsonResponse({ error: 'REMINDER_LOG_QUERY_FAILED', message: logsError.message }, 500);
  }

  const itemIdsByReminder = new Map<string, Set<string>>();
  for (const row of (itemRows ?? []) as ReminderItemRow[]) {
    const set = itemIdsByReminder.get(row.reminder_id) ?? new Set<string>();
    set.add(row.supplement_id);
    itemIdsByReminder.set(row.reminder_id, set);
  }

  const alreadySent = new Set<string>();
  for (const row of (logRows ?? []) as ReminderLogRow[]) {
    alreadySent.add(`${row.reminder_id}|${row.sent_on}`);
  }

  const dueCache = new Map<string, DueSupplement[]>();
  const toSend: PendingReminder[] = [];

  for (const entry of inWindow) {
    const sentKey = `${entry.reminder.id}|${entry.localDate}`;
    if (alreadySent.has(sentKey)) {
      skippedAlreadySent += 1;
      continue;
    }

    const itemIds = itemIdsByReminder.get(entry.reminder.id);
    if (!itemIds || itemIds.size === 0) {
      skippedEmptyIntersection += 1;
      continue;
    }

    const dueKey = `${entry.reminder.user_id}|${entry.localDate}`;
    let due = dueCache.get(dueKey);
    if (!due) {
      const { data: dueRows, error: dueError } = await serviceClient.rpc(
        'supplements_due_for_user',
        {
          p_user_id: entry.reminder.user_id,
          p_date: entry.localDate,
        },
      );

      if (dueError) {
        errors += 1;
        console.error(
          `[send-supplement-reminders] supplements_due_for_user failed user=${entry.reminder.user_id}:`,
          dueError,
        );
        continue;
      }

      due = ((dueRows ?? []) as DueSupplement[]).map((row) => ({
        id: String(row.id),
        name: String(row.name),
      }));
      dueCache.set(dueKey, due);
    }

    const matched = due.filter((row) => itemIds.has(row.id));
    if (matched.length === 0) {
      skippedEmptyIntersection += 1;
      continue;
    }

    toSend.push({
      userId: entry.reminder.user_id,
      reminderId: entry.reminder.id,
      label: entry.reminder.label,
      localDate: entry.localDate,
      locale: entry.locale,
      tokens: entry.tokens,
      names: matched.map((row) => row.name),
    });
  }

  for (const reminder of toSend) {
    const title =
      typeof reminder.label === 'string' && reminder.label.trim().length > 0
        ? reminder.label.trim()
        : 'Kolibi';
    const body = buildBody(reminder.locale, reminder.names);
    const messages: ExpoPushMessage[] = reminder.tokens.map((token) => ({
      to: token,
      title,
      body,
      sound: 'default',
      data: { url: '/home' },
    }));

    let sendFailed = false;
    for (const chunk of chunkArray(messages, EXPO_CHUNK_SIZE)) {
      const result = await sendExpoPushMessages(chunk);
      if (!result.ok) {
        sendFailed = true;
        errors += 1;
        console.error(
          `[send-supplement-reminders] Expo send failed user=${reminder.userId} reminder=${reminder.reminderId}:`,
          result.error,
        );
        break;
      }
    }

    if (sendFailed) {
      continue;
    }

    const { error: insertError } = await serviceClient.from('supplement_reminder_log').insert({
      user_id: reminder.userId,
      reminder_id: reminder.reminderId,
      sent_on: reminder.localDate,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        skippedAlreadySent += 1;
        continue;
      }

      errors += 1;
      console.error(
        `[send-supplement-reminders] log insert failed user=${reminder.userId} reminder=${reminder.reminderId}:`,
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
    skippedOutsideWindow,
    skippedEmptyIntersection,
    skippedAlreadySent,
    errors,
    now: nowIso,
  });
});
