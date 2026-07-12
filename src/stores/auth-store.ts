import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  initialized: boolean;
  isOnboarded: boolean | null;
  initialize: () => () => void;
  refreshOnboardingStatus: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

async function fetchOnboardingStatus(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to fetch onboarding status:', error.message);
    return false;
  }

  return !!data?.onboarded_at;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  initialized: false,
  isOnboarded: null,

  refreshOnboardingStatus: async () => {
    const userId = get().session?.user?.id;

    if (!userId) {
      set({ isOnboarded: null });
      return false;
    }

    const isOnboarded = await fetchOnboardingStatus(userId);
    set({ isOnboarded });
    return isOnboarded;
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
    await supabase.auth.signOut();
    set({ session: null, isOnboarded: null });
  },
}));
