import * as Sentry from '@sentry/react-native';
import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import {
  identifyAnalyticsUser,
  resetAnalyticsUser,
  trackAnonymousSessionStarted,
} from '@/lib/analytics';
import { isMissingAuthUserError } from '@/lib/auth-errors';
import { getDeviceId } from '@/lib/device-id';
import { supabase, wipeAuthStorageIfRequested } from '@/lib/supabase';
import { unregisterPushToken } from '@/lib/notifications';

type AuthState = {
  session: Session | null;
  initialized: boolean;
  /** true = onboarded, false = not onboarded, null = unknown / still loading */
  isOnboarded: boolean | null;
  initialize: () => () => void;
  refreshOnboardingStatus: () => Promise<boolean | null>;
  recoverSessionIfUserMissing: () => Promise<'recovered' | 'user_exists' | 'unknown'>;
  signOut: () => Promise<void>;
};

/** Skip SIGNED_OUT while swapping a zombie JWT for a fresh anonymous session. */
let replacingMissingUser = false;

/**
 * Server-side check: is this JWT's user gone?
 * `true` = deleted/missing, `false` = user exists, `null` = unknown (network — do not recover).
 */
async function serverUserIsGone(): Promise<boolean | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (isMissingAuthUserError(error)) {
      return true;
    }

    if (error) {
      return null;
    }

    return user == null ? null : false;
  } catch (error) {
    if (isMissingAuthUserError(error)) {
      return true;
    }

    return null;
  }
}

type OnboardingFetchResult = boolean | null | 'missing_user';

/** Successful fetch only. Errors return null (unknown) — never "not onboarded". */
async function fetchOnboardingStatus(userId: string): Promise<OnboardingFetchResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    // PGRST116 = .single() got 0 or many rows. Confirm via getUser before recovering.
    if (error.code === 'PGRST116') {
      const gone = await serverUserIsGone();
      if (gone === true) {
        return 'missing_user';
      }

      return gone === null ? null : false;
    }

    console.warn('Failed to fetch onboarding status:', error.message);
    return null;
  }

  if (!data) {
    const gone = await serverUserIsGone();
    if (gone === true) {
      return 'missing_user';
    }

    // Network: keep loading. User exists but no profile: treat as not onboarded.
    return gone === null ? null : false;
  }

  return !!data.onboarded_at;
}

const ONBOARDING_STATUS_MAX_ATTEMPTS = 3;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns a session on success; null on failure (caller falls back to login). */
async function signInAnonymouslyWithUsage(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      Sentry.captureException(error ?? new Error('Anonymous sign-in returned no session'));
      return null;
    }

    identifyAnalyticsUser(data.session.user.id);
    trackAnonymousSessionStarted();

    try {
      const deviceId = await getDeviceId();
      const usageResponse = await supabase.from('anonymous_scan_usage').upsert(
        {
          user_id: data.session.user.id,
          device_id: deviceId,
          scan_count: 0,
        },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
      console.warn('[auth] anonymous_scan_usage upsert response', usageResponse);

      if (usageResponse.error) {
        Sentry.captureException(usageResponse.error);
      }
    } catch (usageError) {
      Sentry.captureException(usageError);
    }

    return data.session;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  async function replaceMissingUserSession(): Promise<Session | null> {
    replacingMissingUser = true;
    try {
      console.warn('[auth] local session points at a missing auth user — starting a fresh anonymous session');

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        console.warn('[auth] local signOut for missing user failed:', signOutError);
      }

      resetAnalyticsUser();
      const session = await signInAnonymouslyWithUsage();
      set({ session, isOnboarded: session ? false : null });
      return session;
    } finally {
      replacingMissingUser = false;
    }
  }

  async function resolveOnboardingStatus(userId: string): Promise<boolean | null> {
    for (let attempt = 0; attempt < ONBOARDING_STATUS_MAX_ATTEMPTS; attempt++) {
      const isOnboarded = await fetchOnboardingStatus(userId);

      if (isOnboarded === 'missing_user') {
        const session = await replaceMissingUserSession();
        const nextUserId = session?.user?.id;
        if (!nextUserId) {
          set({ isOnboarded: null });
          return null;
        }

        const next = await fetchOnboardingStatus(nextUserId);
        if (next === 'missing_user' || next === null) {
          set({ isOnboarded: null });
          return null;
        }

        set({ isOnboarded: next });
        return next;
      }

      if (isOnboarded !== null) {
        set({ isOnboarded });
        return isOnboarded;
      }

      if (attempt < ONBOARDING_STATUS_MAX_ATTEMPTS - 1) {
        await delay(400 * (attempt + 1));
      }
    }

    // Still unknown after retries — keep loading; do not treat as not onboarded.
    set({ isOnboarded: null });
    return null;
  }

  return {
  session: null,
  initialized: false,
  isOnboarded: null,

  refreshOnboardingStatus: async () => {
    const userId = get().session?.user?.id;

    if (!userId) {
      set({ isOnboarded: null });
      return null;
    }

    return resolveOnboardingStatus(userId);
  },

  recoverSessionIfUserMissing: async () => {
    const gone = await serverUserIsGone();

    if (gone === true) {
      const session = await replaceMissingUserSession();
      return session?.user?.id ? 'recovered' : 'unknown';
    }

    if (gone === false) {
      return 'user_exists';
    }

    return 'unknown';
  },

  initialize: () => {
    // Keep `initialized` false until getSession + optional anonymous sign-in
    // finish. `_layout` only mounts the router when initialized, so index.tsx
    // cannot redirect to login while signInAnonymously() is still in flight.
    void (async () => {
      let session: Session | null = null;

      try {
        await wipeAuthStorageIfRequested();

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          Sentry.captureException(error);
        }
        session = data.session ?? null;

        if (session) {
          const gone = await serverUserIsGone();
          if (gone === true) {
            session = await replaceMissingUserSession();
          }
        }

        if (!session) {
          session = await signInAnonymouslyWithUsage();
        }
      } catch (error) {
        Sentry.captureException(error);
        session = null;
      }

      set({ session, initialized: true });

      if (session?.user?.id) {
        get().refreshOnboardingStatus();
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (replacingMissingUser && !session) {
        return;
      }

      if (session?.user?.id) {
        identifyAnalyticsUser(session.user.id);
      } else {
        resetAnalyticsUser();
      }

      set({
        session,
        isOnboarded: session ? get().isOnboarded : null,
      });

      if (session?.user?.id) {
        get().refreshOnboardingStatus();
      } else {
        set({ isOnboarded: null });
      }
    });

    return () => subscription.unsubscribe();
  },

  signOut: async () => {
    const userId = get().session?.user?.id ?? null;
    if (userId) {
      await unregisterPushToken(userId);
    }
    await supabase.auth.signOut();
    resetAnalyticsUser();
    set({ session: null, isOnboarded: null });
  },
  };
});
