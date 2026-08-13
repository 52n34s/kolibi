import { Href, router } from 'expo-router';

import { PASSWORD_RESET_REDIRECT_URL } from '@/lib/auth-redirect';
import { mapSignInAuthError, mapSignUpAuthError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const HOME_ROUTE = '/home' as Href;
const ONBOARDING_ROUTE = { pathname: '/onboarding', params: {} } as Href;

export async function navigateAfterLogin() {
  const isOnboarded = await useAuthStore.getState().refreshOnboardingStatus();

  // null = unknown (fetch failed). Stay put — index/login keep loading / retry.
  // Only a successful false may send the user to onboarding.
  if (isOnboarded === null) {
    return;
  }

  router.replace(isOnboarded ? HOME_ROUTE : ONBOARDING_ROUTE);
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw mapSignInAuthError(error);
  }
  await navigateAfterLogin();
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw mapSignUpAuthError(error);
  }
  await navigateAfterLogin();
}

/**
 * Sets profiles.display_name from Apple givenName only when the column is currently null.
 * Never overwrites an existing name; never writes null.
 */
export async function setDisplayNameIfEmpty(displayName: string): Promise<void> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user?.id) {
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', user.id)
    .is('display_name', null);

  if (error) {
    console.warn('[auth] setDisplayNameIfEmpty failed:', error);
  }
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
  if (error) {
    console.error('[signInWithGoogleIdToken] Supabase rejected Google ID token:', {
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    });
    throw error;
  }
  await navigateAfterLogin();
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: PASSWORD_RESET_REDIRECT_URL,
  });

  if (error) {
    throw error;
  }
}

export async function updatePassword(password: string) {
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log('[reset] updatePassword getSession before updateUser', {
    sessionError,
    hasSession: Boolean(sessionData.session),
    userId: sessionData.session?.user?.id ?? null,
    expiresAt: sessionData.session?.expires_at ?? null,
    accessTokenMasked: sessionData.session?.access_token
      ? `${sessionData.session.access_token.slice(0, 4)}…${sessionData.session.access_token.slice(-4)} (len=${sessionData.session.access_token.length})`
      : null,
  });

  const { data, error } = await supabase.auth.updateUser({ password });

  console.log('[reset] updatePassword updateUser result', {
    data: {
      userId: data.user?.id ?? null,
      email: data.user?.email ?? null,
    },
    error,
  });

  if (error) {
    console.log('[reset] updatePassword updateUser error details', {
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
      stringified: JSON.stringify(error),
    });
    throw error;
  }
}
