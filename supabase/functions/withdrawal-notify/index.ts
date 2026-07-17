import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.24.2';

const SUPPORT_EMAIL = 'support@52n34s.com';
const DEFAULT_FROM_EMAIL = 'Kolibi <noreply@kolibi.app>';

const requestSchema = z.object({
  withdrawal_id: z.string().uuid(),
});

type WithdrawalRow = {
  id: string;
  user_id: string;
  user_email: string;
  submitted_at: string;
  status: string;
  rc_original_transaction_id: string | null;
  product_id: string | null;
  note: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formatWithdrawalEmail(withdrawal: WithdrawalRow): { subject: string; text: string } {
  const subject = `[Kolibi] Widerruf erklärt — ${withdrawal.user_email}`;
  const text = [
    'Ein Nutzer hat einen Widerruf erklärt.',
    '',
    `user_id: ${withdrawal.user_id}`,
    `user_email: ${withdrawal.user_email}`,
    `submitted_at: ${withdrawal.submitted_at}`,
    `product_id: ${withdrawal.product_id ?? '(nicht verfügbar)'}`,
    `note: ${withdrawal.note ?? '(keine)'}`,
    `rc_original_transaction_id: ${withdrawal.rc_original_transaction_id ?? '(nicht verfügbar)'}`,
    '',
    `withdrawal_id: ${withdrawal.id}`,
  ].join('\n');

  return { subject, text };
}

async function sendWithdrawalEmail(withdrawal: WithdrawalRow): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured.');
    throw new Error('RESEND_API_KEY is not configured');
  }

  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? DEFAULT_FROM_EMAIL;
  const { subject, text } = formatWithdrawalEmail(withdrawal);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [SUPPORT_EMAIL],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Resend API failed:', {
      status: response.status,
      body,
      withdrawal_id: withdrawal.id,
    });
    throw new Error(`Resend API failed with status ${response.status}`);
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Supabase environment is not configured.');
    return jsonResponse({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const accessToken = authHeader.slice('Bearer '.length).trim();
  if (!accessToken) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  if (userError || !user) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch (error) {
    console.error('Invalid withdrawal-notify JSON:', error);
    return jsonResponse({ error: 'INVALID_JSON' }, 400);
  }

  const parsed = requestSchema.safeParse(requestBody);
  if (!parsed.success) {
    console.error('Invalid withdrawal-notify body:', parsed.error.issues);
    return jsonResponse({ error: 'INVALID_BODY', issues: parsed.error.issues }, 400);
  }

  const { withdrawal_id: withdrawalId } = parsed.data;

  const { data: withdrawal, error: readError } = await serviceClient
    .from('withdrawals')
    .select(
      'id, user_id, user_email, submitted_at, status, rc_original_transaction_id, product_id, note',
    )
    .eq('id', withdrawalId)
    .maybeSingle();

  if (readError) {
    console.error('Failed to read withdrawal row:', readError);
    return jsonResponse({ error: 'DB_READ_FAILED' }, 500);
  }

  if (!withdrawal || withdrawal.user_id !== user.id) {
    return jsonResponse({ error: 'NOT_FOUND' }, 404);
  }

  try {
    await sendWithdrawalEmail(withdrawal as WithdrawalRow);
  } catch (error) {
    console.error('Failed to send withdrawal notification email:', error);
    return jsonResponse({ error: 'EMAIL_SEND_FAILED' }, 502);
  }

  if (withdrawal.status === 'submitted') {
    const { error: updateError } = await serviceClient
      .from('withdrawals')
      .update({ status: 'received' })
      .eq('id', withdrawal.id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to mark withdrawal as received:', updateError);
      return jsonResponse({ error: 'DB_WRITE_FAILED' }, 500);
    }
  }

  console.log('[withdrawal-notify] email sent:', {
    withdrawal_id: withdrawal.id,
    user_id: withdrawal.user_id,
    user_email: withdrawal.user_email,
  });

  return jsonResponse({ ok: true }, 200);
});
