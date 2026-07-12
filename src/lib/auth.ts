import { Href, router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const HOME_ROUTE = '/home' as Href;
const ONBOARDING_ROUTE = { pathname: '/onboarding', params: {} } as Href;

export async function navigateAfterLogin() {
  const isOnboarded = await useAuthStore.getState().refreshOnboardingStatus();
  router.replace(isOnboarded ? HOME_ROUTE : ONBOARDING_ROUTE);
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await navigateAfterLogin();
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  await navigateAfterLogin();
}

export async function signInWithAppleIdentityToken(identityToken: string) {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;
  await navigateAfterLogin();
}

export async function signInWithGoogleIdToken(idToken: string) {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  await navigateAfterLogin();
}
