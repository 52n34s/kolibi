import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const ERDI_TICKETS_URL = 'https://erdiknows.com/api/v1/tickets';

type SupportMessageRecord = {
  id?: string;
  user_id?: string;
  category?: string;
  message?: string;
  app_version?: string | null;
  platform?: string | null;
  locale?: string | null;
};

type InsertPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: SupportMessageRecord;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return false;
  }

  const hookSecret = Deno.env.get('SUPPORT_TO_ERDI_SECRET');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (hookSecret && token === hookSecret) {
    return true;
  }

  if (serviceKey && token === serviceKey) {
    return true;
  }

  return false;
}

function truncateUserId(userId: string): string {
  return userId.slice(0, 8);
}

/** Message, then optional meta; truncated user_id always last when present. */
function buildTicketBody(record: SupportMessageRecord): string {
  const message = (record.message ?? '').trim();
  const meta: string[] = [];

  if (record.app_version) {
    meta.push(`app_version: ${record.app_version}`);
  }
  if (record.platform) {
    meta.push(`platform: ${record.platform}`);
  }
  if (record.locale) {
    meta.push(`locale: ${record.locale}`);
  }
  if (record.user_id) {
    meta.push(`user_id: ${truncateUserId(record.user_id)}`);
  }

  if (meta.length === 0) {
    return message;
  }

  return `${message}\n\n${meta.join('\n')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const erdiToken = Deno.env.get('ERDI_TOKEN_TICKETS');
  if (!erdiToken) {
    console.error('[support-to-erdi] ERDI_TOKEN_TICKETS is not configured.');
    return jsonResponse({ error: 'MISCONFIGURED' }, 500);
  }

  let payload: InsertPayload;
  try {
    payload = (await req.json()) as InsertPayload;
  } catch (error) {
    console.error('[support-to-erdi] invalid JSON:', error);
    return jsonResponse({ error: 'INVALID_JSON' }, 400);
  }

  const record = payload.record;
  if (!record?.id || !record.category || typeof record.message !== 'string') {
    console.error('[support-to-erdi] missing record fields:', payload);
    return jsonResponse({ error: 'INVALID_BODY' }, 400);
  }

  const ticket = {
    subject: record.category,
    body: buildTicketBody(record),
    topic: record.category,
    external_id: `kolibi:${record.id}`,
  };

  try {
    const response = await fetch(ERDI_TICKETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${erdiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ticket),
    });

    const detail = await response.text();

    if (!response.ok) {
      console.error('[support-to-erdi] Erdi tickets API failed:', {
        status: response.status,
        detail: detail.slice(0, 500),
        external_id: ticket.external_id,
      });
      return jsonResponse({ error: 'ERDI_TICKET_FAILED', status: response.status }, 502);
    }

    let erdi: unknown = null;
    if (detail) {
      try {
        erdi = JSON.parse(detail);
      } catch {
        erdi = detail;
      }
    }

    console.log('[support-to-erdi] ticket posted:', {
      external_id: ticket.external_id,
      topic: ticket.topic,
    });

    return jsonResponse({
      ok: true,
      external_id: ticket.external_id,
      erdi,
    });
  } catch (error) {
    console.error('[support-to-erdi] Erdi request error:', error);
    return jsonResponse({ error: 'ERDI_REQUEST_FAILED' }, 502);
  }
});
