type AuthMode = 'signIn' | 'signUp';

export function logAuthError(context: string, error: unknown) {
  console.error(`[${context}] auth failed:`, error);
}

export function getEmailAuthErrorKey(mode: AuthMode): 'auth.errors.invalidCredentials' | 'auth.errors.signUpFailed' {
  return mode === 'signUp' ? 'auth.errors.signUpFailed' : 'auth.errors.invalidCredentials';
}
