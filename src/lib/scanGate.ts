import * as Sentry from '@sentry/react-native';

import { getDeviceId } from '@/lib/device-id';
import { supabase } from '@/lib/supabase';

export const FREE_SCAN_LIMIT = 4;

export const scanAllowanceQueryKey = (userId: string) =>
  ['scan-allowance', userId] as const;

export type ScanAllowance = {
  allowed: boolean;
  remaining: number;
  isAnonymous: boolean;
  scanCount: number;
};

const SIGNED_IN_ALLOWANCE: ScanAllowance = {
  allowed: true,
  remaining: -1,
  isAnonymous: false,
  scanCount: 0,
};

const DENIED_ANONYMOUS_ALLOWANCE: ScanAllowance = {
  allowed: false,
  remaining: 0,
  isAnonymous: true,
  scanCount: 0,
};

function allowanceFromScanCount(scanCount: number): ScanAllowance {
  const remaining = Math.max(0, FREE_SCAN_LIMIT - scanCount);
  return {
    allowed: remaining > 0,
    remaining,
    isAnonymous: true,
    scanCount,
  };
}

function isUsageRowNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message =
    'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';

  return code === 'P0001' || message.includes('anonymous_scan_usage row not found');
}

async function fetchUsageScanCount(userId: string) {
  return supabase
    .from('anonymous_scan_usage')
    .select('scan_count')
    .eq('user_id', userId)
    .maybeSingle();
}

/** Inserts a usage row. Existing rows are left untouched (`ignoreDuplicates`). */
async function insertUsageRowIfMissing(
  userId: string,
  scanCount: number,
): Promise<{ inserted: boolean; scanCount: number } | null> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase
      .from('anonymous_scan_usage')
      .upsert(
        {
          user_id: userId,
          device_id: deviceId,
          scan_count: scanCount,
        },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
      .select('scan_count')
      .maybeSingle();

    if (error) {
      Sentry.captureException(error);
      return null;
    }

    if (data) {
      return { inserted: true, scanCount: data.scan_count ?? scanCount };
    }

    return { inserted: false, scanCount };
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

export async function checkScanAllowance(userId: string): Promise<ScanAllowance> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    Sentry.captureException(userError ?? new Error('checkScanAllowance: no user'));
    return SIGNED_IN_ALLOWANCE;
  }

  if (user.is_anonymous !== true) {
    return SIGNED_IN_ALLOWANCE;
  }

  const { data, error } = await fetchUsageScanCount(userId);

  if (error) {
    Sentry.captureException(error);
    return DENIED_ANONYMOUS_ALLOWANCE;
  }

  if (!data) {
    const inserted = await insertUsageRowIfMissing(userId, 0);
    if (!inserted) {
      return DENIED_ANONYMOUS_ALLOWANCE;
    }

    if (inserted.inserted) {
      return allowanceFromScanCount(inserted.scanCount);
    }

    const { data: existing, error: refetchError } = await fetchUsageScanCount(userId);
    if (refetchError || !existing) {
      Sentry.captureException(
        refetchError ?? new Error('checkScanAllowance: usage row missing after upsert'),
      );
      return DENIED_ANONYMOUS_ALLOWANCE;
    }

    return allowanceFromScanCount(existing.scan_count ?? 0);
  }

  return allowanceFromScanCount(data.scan_count ?? 0);
}

export async function incrementScanCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('increment_scan_count', {
    p_user_id: userId,
  });

  if (!error) {
    return typeof data === 'number' ? data : 0;
  }

  if (!isUsageRowNotFoundError(error)) {
    Sentry.captureException(error);
    throw error;
  }

  console.warn('[scanGate] increment_scan_count row not found, inserting', error);

  const inserted = await insertUsageRowIfMissing(userId, 1);
  if (inserted?.inserted) {
    return inserted.scanCount;
  }

  if (inserted) {
    const { data: retried, error: retryError } = await supabase.rpc('increment_scan_count', {
      p_user_id: userId,
    });

    if (!retryError) {
      return typeof retried === 'number' ? retried : 0;
    }

    Sentry.captureException(retryError);
    throw retryError;
  }

  Sentry.captureException(error);
  throw error;
}
