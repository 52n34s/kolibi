import {
  getRevenueCatSubscriptionMetadata,
} from '@/lib/purchases';
import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

export const APPLE_REFUND_URL = 'https://reportaproblem.apple.com';

export type WithdrawalRow = {
  id: string;
  user_id: string;
  submitted_at: string;
  status: string;
  user_email: string;
  rc_original_transaction_id: string | null;
  product_id: string | null;
  note: string | null;
};

export type WithdrawalInsertResult = {
  id: string;
  submitted_at: string;
};

type WithdrawalInsertRow = {
  user_id: string;
  user_email: string;
  note: string | null;
  product_id: string | null;
  rc_original_transaction_id: string | null;
};

export async function hasExistingWithdrawal(userId: string): Promise<WithdrawalRow | null> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select(
      'id, user_id, submitted_at, status, user_email, rc_original_transaction_id, product_id, note',
    )
    .eq('user_id', userId)
    .neq('status', 'rejected')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Withdrawal] hasExistingWithdrawal failed:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  return data;
}

async function notifyWithdrawalReceived(withdrawalId: string): Promise<void> {
  if (!supabaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL environment variable.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Missing auth session for withdrawal notification.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/withdrawal-notify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ withdrawal_id: withdrawalId }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = payload?.error ?? `withdrawal-notify failed with status ${response.status}`;
    throw new Error(message);
  }
}

export async function insertWithdrawal(params: {
  userId: string;
  userEmail: string;
  note?: string;
}): Promise<WithdrawalInsertResult> {
  const trimmedNote = params.note?.trim() ?? '';
  const { rcOriginalTransactionId, productId } = await getRevenueCatSubscriptionMetadata();

  const insertRow: WithdrawalInsertRow = {
    user_id: params.userId,
    user_email: params.userEmail.trim(),
    note: trimmedNote.length > 0 ? trimmedNote : null,
    product_id: productId,
    rc_original_transaction_id: rcOriginalTransactionId,
  };

  const { data, error } = await supabase
    .from('withdrawals')
    .insert(insertRow)
    .select('id, submitted_at')
    .single();

  if (error) {
    console.error('[Withdrawal] insert failed:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  // Der Widerruf ist mit dem erfolgreichen DB-Insert oben rechtlich dokumentiert.
  // Die Support-Benachrichtigung ist optional und darf den Widerruf nicht scheitern lassen.
  try {
    await notifyWithdrawalReceived(data.id);
  } catch (notifyError) {
    console.error('[Withdrawal] withdrawal-notify failed (non-blocking):', notifyError);
  }

  return {
    id: data.id,
    submitted_at: data.submitted_at,
  };
}
