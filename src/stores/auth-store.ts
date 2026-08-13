import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { unregisterPushToken } from '@/lib/notifications';

type AuthState = {
  session: Session | null;
  initialized: boolean;
  /** true = onboarded, false = not onboarded, null = unknown / still loading */
  isOnboarded: boolean | null;
  initialize: () => () => void;
  refreshOnboardingStatus: () => Promise<boolean | null>;
  signOut: () => Promise<void>;
};

/** Successful fetch only. Errors return null (unknown) — never "not onboarded". */
async function fetchOnboardingStatus(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to fetch onboarding status:', error.message);
    return null;
  }

  return !!data?.onboarded_at;
}

const ONBOARDING_STATUS_MAX_ATTEMPTS = 3;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  initialized: false,
  isOnboarded: null,

  refreshOnboardingStatus: async () => {
    const userId = get().session?.user?.id;

    if (!userId) {
      set({ isOnboarded: null });
      return null;
    }

    for (let attempt = 0; attempt < ONBOARDING_STATUS_MAX_ATTEMPTS; attempt++) {
      const isOnboarded = await fetchOnboardingStatus(userId);

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
  },

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, initialized: true });

      if (session?.user?.id) {
        get().refreshOnboardingStatus();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    set({ session: null, isOnboarded: null });
  },
}));
