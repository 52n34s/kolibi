import * as Sentry from '@sentry/react-native';
import { Href, router } from 'expo-router';
import type { User } from '@supabase/supabase-js';

import {
  identifyAnalyticsUser,
  identifyAndTrackSignupIfNew,
  trackAnonymousConvertedToAccount,
  trackSignupCompleted,
  type SignupProvider,
} from '@/lib/analytics';
import { PASSWORD_RESET_REDIRECT_URL } from '@/lib/auth-redirect';
import {
  EmailAuthError,
  IdentityAlreadyLinkedError,
  mapSignInAuthError,
  mapSignUpAuthError,
  type LinkedOAuthProvider,
} from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { requestPaywallAfterSignup } from '@/lib/pending-paywall';
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

export function navigateToSignIn(reason?: 'emailAlreadyRegistered' | 'accountRequired') {
  router.push({
    pathname: '/(auth)/login',
    params: reason ? { mode: 'signin', reason } : { mode: 'signin' },
  } as Href);
}

export function navigateToSignup() {
  router.push('/(auth)/login' as Href);
}

async function getAuthUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSignUpAuthError(error);
    if (mapped.kind === 'sessionMissing') {
      return null;
    }
    throw error;
  }

  return user ?? null;
}

function readErrorString(error: unknown, key: string): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function isIdentityAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const nested =
    'error' in error && typeof (error as { error: unknown }).error === 'object'
      ? (error as { error: unknown }).error
      : null;

  const code = (
    readErrorString(error, 'code') ||
    readErrorString(error, 'error_code') ||
    readErrorString(nested, 'code') ||
    readErrorString(nested, 'error_code')
  ).toLowerCase();

  const message = (
    readErrorString(error, 'message') ||
    readErrorString(error, 'msg') ||
    readErrorString(nested, 'message') ||
    readErrorString(nested, 'msg')
  ).toLowerCase();

  return (
    code === 'identity_already_exists' ||
    message.includes('already been registered') ||
    message.includes('already linked') ||
    message.includes('identity already exists')
  );
}

function throwIfIdentityAlreadyLinked(
  error: unknown,
  provider: LinkedOAuthProvider,
  identityToken: string,
): void {
  if (!isIdentityAlreadyExistsError(error)) {
    return;
  }

  throw new IdentityAlreadyLinkedError(provider, identityToken);
}

/**
 * Signs into the existing Apple/Google account after the user confirms data loss.
 * Uses local signOut only — do not delete the anonymous user here. If sign-in
 * failed after a server-side delete, the user would have no session. Orphans
 * can be removed later by an inactive-anonymous cleanup job.
 */
export async function completeExistingIdentitySignIn(
  provider: LinkedOAuthProvider,
  identityToken: string,
): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (signOutError) {
    console.warn('[auth] local signOut after anonymous switch failed', signOutError);
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider,
    token: identityToken,
  });
  if (error) {
    throw error;
  }

  identifyAndTrackSignupIfNew(data.user, provider);
  await navigateAfterLogin();
}

async function startTrialAfterAccountConversion(): Promise<void> {
  const { data, error } = await supabase.rpc('start_trial_after_account_conversion');

  if (error) {
    throw error;
  }

  // StoreKit trial: RPC is a no-op and may return null. Do not require a timestamp.
  if (data == null) {
    return;
  }
}

async function finalizeConvertedSignup(userId: string, provider: SignupProvider) {
  identifyAnalyticsUser(userId);
  trackAnonymousConvertedToAccount(provider);
  trackSignupCompleted(provider);

  try {
    await startTrialAfterAccountConversion();
  } catch (trialError) {
    Sentry.captureException(trialError);
  }

  requestPaywallAfterSignup();
  await navigateAfterLogin();
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw mapSignInAuthError(error);
  }
  if (data.user?.id) {
    identifyAnalyticsUser(data.user.id);
  }
  await navigateAfterLogin();
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw mapSignUpAuthError(error);
  }
  identifyAndTrackSignupIfNew(data.user, 'email');
  requestPaywallAfterSignup();
  await navigateAfterLogin();
}

/**
 * Converts the current anonymous session with email + password.
 *
 * Confirm email is off, so updateUser({ email }) applies the address immediately
 * and flips is_anonymous to false. Password MUST be set after that, or the user
 * has an email and cannot sign in later. Retry callers skip the email step when
 * the address is already on this account.
 */
export async function convertAnonymousWithEmailPassword(
  email: string,
  password: string,
): Promise<void> {
  const trimmedEmail = email.trim();
  const user = await getAuthUser();
  if (!user) {
    throw new EmailAuthError('sessionMissing');
  }

  const currentEmail = user.email?.trim().toLowerCase() ?? '';
  const emailAlreadyOurs = currentEmail === trimmedEmail.toLowerCase();

  if (!emailAlreadyOurs) {
    if (!user.is_anonymous) {
      throw new EmailAuthError('sessionMissing');
    }

    const { data, error } = await supabase.auth.updateUser({ email: trimmedEmail });
    console.warn('[auth] updateUser({ email }) response', { data, error });

    if (error) {
      throw mapSignUpAuthError(error);
    }
  }

  const { data: passwordData, error: passwordError } = await supabase.auth.updateUser({
    password,
  });

  if (passwordError) {
    const mapped = mapSignUpAuthError(passwordError);
    if (mapped.kind === 'weakPassword') {
      throw mapped;
    }
    Sentry.captureException(passwordError, {
      extra: { stage: 'convertAnonymousWithEmailPassword.password' },
    });
    throw new EmailAuthError('passwordSetupFailed', passwordError.message);
  }

  await finalizeConvertedSignup(passwordData.user?.id ?? user.id, 'email');
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
  const user = await getAuthUser();

  if (user?.is_anonymous) {
    const anonymousUserId = user.id;
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'apple',
      token: identityToken,
    });

    if (error) {
      throwIfIdentityAlreadyLinked(error, 'apple', identityToken);
      throw error;
    }

    if (!data?.user) {
      throw new Error(
        typeof data === 'object' && data && 'url' in data && data.url
          ? 'Apple identity link returned an OAuth URL instead of a user'
          : 'Apple identity link did not return a user',
      );
    }

    const convertedUserId = data.user.id;
    if (convertedUserId !== anonymousUserId) {
      Sentry.captureException(new Error('Anonymous Apple conversion changed user id'));
    }

    await finalizeConvertedSignup(convertedUserId, 'apple');
    return;
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;
  identifyAndTrackSignupIfNew(data.user, 'apple');
  await navigateAfterLogin();
}

export async function signInWithGoogleIdToken(idToken: string) {
  const user = await getAuthUser();

  if (user?.is_anonymous) {
    const anonymousUserId = user.id;
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      throwIfIdentityAlreadyLinked(error, 'google', idToken);

      console.error('[signInWithGoogleIdToken] Supabase rejected Google identity link:', {
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
      });
      throw error;
    }

    const convertedUserId = data.user?.id ?? anonymousUserId;
    if (data.user?.id && data.user.id !== anonymousUserId) {
      Sentry.captureException(new Error('Anonymous Google conversion changed user id'));
    }

    await finalizeConvertedSignup(convertedUserId, 'google');
    return;
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
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
  identifyAndTrackSignupIfNew(data.user, 'google');
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
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }
}
