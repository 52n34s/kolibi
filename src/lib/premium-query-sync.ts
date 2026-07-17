import type { QueryClient } from '@tanstack/react-query';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { fetchHasPremiumAccess } from '@/lib/subscription';

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_ATTEMPTS = 8;

class AbortError extends Error {
  override name = 'AbortError';
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new AbortError();
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new AbortError());
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort);
  });
}

export type PremiumPollResult = 'confirmed' | 'pending' | 'aborted';

/** Query keys that depend on has_premium_access() or subscriptions data. */
export function getPremiumAccessQueryKeys(userId: string) {
  return {
    hasPremiumAccess: ['has-premium-access', userId] as const,
    trialStatus: ['trial-status', userId] as const,
    profileSettings: ['profile-settings', userId] as const,
    withdrawalStatus: ['withdrawal-status', userId] as const,
  };
}

export async function invalidatePremiumAccessQueries(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  const keys = getPremiumAccessQueryKeys(userId);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.hasPremiumAccess }),
    queryClient.invalidateQueries({ queryKey: keys.trialStatus }),
    queryClient.invalidateQueries({ queryKey: keys.profileSettings }),
    queryClient.invalidateQueries({ queryKey: keys.withdrawalStatus }),
  ]);
}

/** Registers a global RevenueCat listener that refreshes premium/subscription queries. */
export function registerPremiumAccessCustomerInfoListener(
  queryClient: QueryClient,
  userId: string,
): () => void {
  const listener = (_customerInfo: CustomerInfo) => {
    void invalidatePremiumAccessQueries(queryClient, userId);
  };

  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** Polls until has_premium_access() returns true, attempts are exhausted, or signal aborts. */
export async function pollForPremiumAccessConfirmation(
  queryClient: QueryClient,
  userId: string,
  signal?: AbortSignal,
): Promise<PremiumPollResult> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      return 'aborted';
    }

    await invalidatePremiumAccessQueries(queryClient, userId);
    if (signal?.aborted) {
      return 'aborted';
    }

    const hasAccess = await fetchHasPremiumAccess(userId);
    if (signal?.aborted) {
      return 'aborted';
    }

    if (hasAccess) {
      await invalidatePremiumAccessQueries(queryClient, userId);
      return 'confirmed';
    }

    if (attempt < POLL_MAX_ATTEMPTS - 1) {
      try {
        await sleep(POLL_INTERVAL_MS, signal);
      } catch (error) {
        if (error instanceof AbortError || signal?.aborted) {
          return 'aborted';
        }

        throw error;
      }
    }
  }

  if (signal?.aborted) {
    return 'aborted';
  }

  await invalidatePremiumAccessQueries(queryClient, userId);
  return 'pending';
}

export function isPremiumFlowAbortError(error: unknown): boolean {
  return error instanceof AbortError;
}
