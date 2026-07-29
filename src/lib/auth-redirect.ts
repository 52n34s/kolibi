import { supabase } from '@/lib/supabase';

export const PASSWORD_RESET_REDIRECT_URL = 'kolibi://reset-password';

let passwordRecoveryFlowActive = false;

export function markPasswordRecoveryFlow(active: boolean) {
  passwordRecoveryFlowActive = active;
}

export function isPasswordRecoveryFlowActive() {
  return passwordRecoveryFlowActive;
}

const SENSITIVE_AUTH_PARAM_KEYS = new Set([
  'access_token',
  'refresh_token',
  'token',
  'token_hash',
  'code',
]);

function maskAuthParamValue(key: string, value: string): string {
  if (!SENSITIVE_AUTH_PARAM_KEYS.has(key) || value.length === 0) {
    return value;
  }

  if (value.length <= 8) {
    return '***';
  }

  return `${value.slice(0, 4)}…${value.slice(-4)} (len=${value.length})`;
}

/** Diagnostic helper: log URL shape with tokens masked. */
export function logMaskedAuthRedirectUrl(tag: string, url: string) {
  const hashIndex = url.indexOf('#');
  const questionIndex = url.indexOf('?');
  const base = url.split('#')[0]?.split('?')[0] ?? url;
  const params = parseAuthRedirectParams(url);
  const maskedParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    maskedParams[key] = maskAuthParamValue(key, value);
  }

  console.log(`[reset] ${tag}`, {
    urlBase: base,
    hasQuery: questionIndex >= 0,
    hasFragment: hashIndex >= 0,
    fragmentFirst: hashIndex >= 0 && (questionIndex < 0 || hashIndex < questionIndex),
    paramKeys: Object.keys(params),
    params: maskedParams,
  });
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
  logMaskedAuthRedirectUrl('establishSessionFromAuthRedirect url', url);
  const params = parseAuthRedirectParams(url);

  if (params.error || params.error_description) {
    console.log('[reset] establishSessionFromAuthRedirect redirect error params', {
      error: params.error ?? null,
      error_description: params.error_description ?? null,
    });
    throw new Error(params.error_description ?? params.error ?? 'Auth redirect failed');
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  console.log('[reset] establishSessionFromAuthRedirect tokens present', {
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    accessTokenMasked: accessToken ? maskAuthParamValue('access_token', accessToken) : null,
    refreshTokenMasked: refreshToken ? maskAuthParamValue('refresh_token', refreshToken) : null,
    type: params.type ?? null,
  });

  if (!accessToken || !refreshToken) {
    throw new Error('Missing recovery tokens in redirect URL');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  console.log('[reset] establishSessionFromAuthRedirect setSession result', {
    data: {
      hasSession: Boolean(data.session),
      userId: data.session?.user?.id ?? null,
      expiresAt: data.session?.expires_at ?? null,
    },
    error,
  });

  if (error) {
    throw error;
  }
}
