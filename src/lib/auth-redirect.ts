import { supabase } from '@/lib/supabase';

export const PASSWORD_RESET_REDIRECT_URL = 'kolibi://reset-password';

let passwordRecoveryFlowActive = false;

export function markPasswordRecoveryFlow(active: boolean) {
  passwordRecoveryFlowActive = active;
}

export function isPasswordRecoveryFlowActive() {
  return passwordRecoveryFlowActive;
}

export function parseAuthRedirectParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const queryString =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : (url.split('?')[1] ?? '');

  const params: Record<string, string> = {};

  for (const part of queryString.split('&')) {
    if (!part) {
      continue;
    }

    const [rawKey, rawValue = ''] = part.split('=');
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    params[key] = value;
  }

  return params;
}

export function isPasswordRecoveryRedirect(url: string): boolean {
  return url.includes('reset-password') || url.includes('type=recovery');
}

/** Establishes a Supabase session from a password-recovery deep link. */
export async function establishSessionFromAuthRedirect(url: string): Promise<void> {
  const params = parseAuthRedirectParams(url);

  if (params.error || params.error_description) {
    throw new Error(params.error_description ?? params.error ?? 'Auth redirect failed');
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('Missing recovery tokens in redirect URL');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }
}
