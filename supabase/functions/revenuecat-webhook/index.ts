import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.24.2';

type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'in_grace_period'
  | 'cancelled'
  | 'expired'
  | 'paused'
  | 'unknown';

type StorePlatform = 'app_store' | 'play_store';

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string | null;
  store?: string | null;
  environment?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  period_type?: string | null;
  event_timestamp_ms?: number | null;
  [key: string]: unknown;
};

const IGNORED_EVENT_TYPES = new Set(['TRANSFER', 'SUBSCRIBER_ALIAS', 'TEST']);

const eventPeekSchema = z
  .object({
    event: z
      .object({
        type: z.string(),
        app_user_id: z.string().nullish(),
      })
      .passthrough(),
  })
  .passthrough();

const revenueCatEventSchema = z
  .object({
    type: z.string(),
    app_user_id: z.string(),
    entitlement_ids: z.array(z.string()).nullish(),
    entitlement_id: z.string().nullish(),
    product_id: z.string().nullish(),
    store: z.string().nullish(),
    environment: z.string().nullish(),
    purchased_at_ms: z.number().nullish(),
    expiration_at_ms: z.number().nullish(),
    period_type: z.string().nullish(),
    event_timestamp_ms: z.number().nullish(),
  })
  .passthrough();

const webhookBodySchema = z
  .object({
    api_version: z.string().nullish(),
    event: revenueCatEventSchema,
  })
  .passthrough();

const uuidSchema = z.string().uuid();

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function logValidationFailure(context: string, issues: z.ZodIssue[], requestBody: unknown): void {
  console.error(`${context}:`, issues);
  console.error('RevenueCat webhook body:', requestBody);
}

function isAuthorized(req: Request, secret: string): boolean {
  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return false;
  }

  return authorization === secret || authorization === `Bearer ${secret}`;
}

function isSupabaseUserId(appUserId: string): boolean {
  if (appUserId.startsWith('$RCAnonymousID:')) {
    return false;
  }

  return uuidSchema.safeParse(appUserId).success;
}

function mapStore(store: string | null | undefined): StorePlatform | null {
  if (!store) {
    return null;
  }

  const normalized = store.toLowerCase();
  if (normalized === 'app_store' || normalized === 'play_store') {
    return normalized;
  }

  return null;
}

function msToIso(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) {
    return null;
  }

  return new Date(ms).toISOString();
}

type EventMapping = {
  status: SubscriptionStatus;
  is_active: boolean;
};

function mapEventToSubscriptionState(event: RevenueCatEvent): EventMapping | 'ignore' | 'unknown' {
  if (IGNORED_EVENT_TYPES.has(event.type)) {
    return 'ignore';
  }

  let mapping: EventMapping | 'unknown' = 'unknown';

  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'NON_RENEWING_PURCHASE':
      mapping = { status: 'active', is_active: true };
      break;
    case 'CANCELLATION':
      mapping = { status: 'cancelled', is_active: true };
      break;
    case 'EXPIRATION':
      mapping = { status: 'expired', is_active: false };
      break;
    case 'BILLING_ISSUE':
      mapping = { status: 'in_grace_period', is_active: true };
      break;
    case 'SUBSCRIPTION_PAUSED':
      mapping = { status: 'paused', is_active: false };
      break;
    default:
      mapping = 'unknown';
  }

  if (mapping === 'unknown') {
    return 'unknown';
  }

  if (event.period_type === 'TRIAL') {
    return { status: 'trialing', is_active: true };
  }

  return mapping;
}

function getStoredEventTimestampMs(lastEvent: unknown): number | null {
  if (!lastEvent || typeof lastEvent !== 'object' || Array.isArray(lastEvent)) {
    return null;
  }

  const timestamp = (lastEvent as { event_timestamp_ms?: unknown }).event_timestamp_ms;
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!webhookSecret) {
    console.error('REVENUECAT_WEBHOOK_SECRET is not configured.');
    return jsonResponse({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase environment is not configured.');
    return jsonResponse({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  if (!isAuthorized(req, webhookSecret)) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch (error) {
    console.error('Invalid RevenueCat webhook JSON:', error);
    return jsonResponse({ error: 'INVALID_JSON' }, 400);
  }

  const peek = eventPeekSchema.safeParse(requestBody);
  if (!peek.success) {
    logValidationFailure('Invalid RevenueCat webhook peek', peek.error.issues, requestBody);
    return jsonResponse({ error: 'INVALID_BODY', issues: peek.error.issues }, 400);
  }

  const eventType = peek.data.event.type;
  if (IGNORED_EVENT_TYPES.has(eventType)) {
    console.log('Ignoring RevenueCat event type:', eventType);
    return jsonResponse({ ok: true, ignored: eventType }, 200);
  }

  const parsedBody = webhookBodySchema.safeParse(requestBody);
  if (!parsedBody.success) {
    logValidationFailure('Invalid RevenueCat webhook body', parsedBody.error.issues, requestBody);
    return jsonResponse({ error: 'INVALID_BODY', issues: parsedBody.error.issues }, 400);
  }

  const event = parsedBody.data.event as RevenueCatEvent;

  console.log('RevenueCat webhook received:', {
    type: event.type,
    app_user_id: event.app_user_id,
    environment: event.environment ?? null,
  });

  if (!isSupabaseUserId(event.app_user_id)) {
    console.log('Ignoring RevenueCat event for non-Supabase app_user_id:', event.app_user_id);
    return jsonResponse({ ok: true, ignored: 'anonymous_or_invalid_user' }, 200);
  }

  const mapping = mapEventToSubscriptionState(event);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const userId = event.app_user_id;

  const { data: existing, error: readError } = await supabase
    .from('subscriptions')
    .select('last_event')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    console.error('Failed to read subscription row:', readError);
    return jsonResponse({ error: 'DB_READ_FAILED' }, 500);
  }

  const storedTimestampMs = getStoredEventTimestampMs(existing?.last_event);
  const incomingTimestampMs = event.event_timestamp_ms ?? null;

  if (
    storedTimestampMs != null &&
    incomingTimestampMs != null &&
    storedTimestampMs > incomingTimestampMs
  ) {
    console.log('Ignoring stale RevenueCat event:', {
      type: event.type,
      app_user_id: userId,
      storedTimestampMs,
      incomingTimestampMs,
    });
    return jsonResponse({ ok: true, ignored: 'stale_event' }, 200);
  }

  if (mapping === 'unknown') {
    console.log('Unknown RevenueCat event type (audit only):', event.type);

    if (existing) {
      const { error: auditError } = await supabase
        .from('subscriptions')
        .update({
          last_event: event,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (auditError) {
        console.error('Failed to write unknown event to last_event:', auditError);
        return jsonResponse({ error: 'DB_WRITE_FAILED' }, 500);
      }
    }

    return jsonResponse({ ok: true, ignored: 'unknown_event_type' }, 200);
  }

  const upsertPayload = {
    user_id: userId,
    revenuecat_app_user_id: event.app_user_id,
    entitlement: event.entitlement_ids?.[0] ?? event.entitlement_id ?? null,
    product_id: event.product_id ?? null,
    status: mapping.status,
    is_active: mapping.is_active,
    store: mapStore(event.store),
    environment: event.environment ?? null,
    current_period_start: msToIso(event.purchased_at_ms),
    current_period_end: msToIso(event.expiration_at_ms),
    last_event: event,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(upsertPayload, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('Failed to upsert subscription row:', upsertError);
    return jsonResponse({ error: 'DB_WRITE_FAILED' }, 500);
  }

  console.log('Subscription upserted:', {
    type: event.type,
    app_user_id: userId,
    status: mapping.status,
    is_active: mapping.is_active,
    environment: event.environment ?? null,
  });

  return jsonResponse({ ok: true }, 200);
});
