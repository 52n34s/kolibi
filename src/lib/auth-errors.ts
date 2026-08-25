type AuthMode = 'signIn' | 'signUp';

export type EmailAuthErrorKind =
  | 'emailAlreadyRegistered'
  | 'weakPassword'
  | 'invalidCredentials'
  | 'otpInvalid'
  | 'otpExpired'
  | 'sessionMissing'
  | 'passwordSetupFailed'
  | 'generic';

export class EmailAuthError extends Error {
  readonly kind: EmailAuthErrorKind;

  constructor(kind: EmailAuthErrorKind, message?: string) {
    super(message ?? kind);
    this.name = 'EmailAuthError';
    this.kind = kind;
  }
}

export type LinkedOAuthProvider = 'apple' | 'google';
export type ExistingAccountProvider = LinkedOAuthProvider | 'email';

/** Apple/Google identity is already attached to a different (non-anonymous) user. */
export class IdentityAlreadyLinkedError extends Error {
  readonly provider: LinkedOAuthProvider;
  readonly identityToken: string;

  constructor(provider: LinkedOAuthProvider, identityToken: string) {
    super('identity_already_exists');
    this.name = 'IdentityAlreadyLinkedError';
    this.provider = provider;
    this.identityToken = identityToken;
  }
}

export function logAuthError(context: string, error: unknown) {
  console.error(`[${context}] auth failed:`, error);
}

function readAuthErrorParts(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== 'object') {
    return { code: '', message: String(error ?? '') };
  }

  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === 'string' ? record.code : '',
    message: typeof record.message === 'string' ? record.message : '',
  };
}

/**
 * True only when GoTrue says this JWT's user no longer exists.
 * Network / refresh failures must not match — those stay retryable.
 */
export function isMissingAuthUserError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as {
    code?: unknown;
    error_code?: unknown;
    message?: unknown;
    status?: unknown;
    name?: unknown;
  };

  if (record.name === 'AuthRetryableError') {
    return false;
  }

  const code = [record.code, record.error_code]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  const status = typeof record.status === 'number' ? record.status : null;

  if (code.includes('user_not_found')) {
    return true;
  }

  if (message.includes('user from sub claim in jwt does not exist')) {
    return true;
  }

  if (status === 403 && message.includes('user not found')) {
    return true;
  }

  return false;
}

export function mapSignUpAuthError(error: unknown): EmailAuthError {
  const { code, message } = readAuthErrorParts(error);
  const lowerMessage = message.toLowerCase();

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    code === 'email_already_exists' ||
    lowerMessage.includes('already registered') ||
    lowerMessage.includes('already been registered')
  ) {
    return new EmailAuthError('emailAlreadyRegistered', message);
  }

  if (code === 'weak_password') {
    return new EmailAuthError('weakPassword', message);
  }

  if (
    code === 'otp_expired' ||
    lowerMessage.includes('otp_expired') ||
    lowerMessage.includes('expired')
  ) {
    return new EmailAuthError('otpExpired', message);
  }

  if (
    code === 'otp_disabled' ||
    (lowerMessage.includes('invalid') &&
      (lowerMessage.includes('otp') ||
        lowerMessage.includes('token') ||
        lowerMessage.includes('code')))
  ) {
    return new EmailAuthError('otpInvalid', message);
  }

  if (
    code === 'session_not_found' ||
    lowerMessage.includes('auth session missing') ||
    lowerMessage.includes('session missing')
  ) {
    return new EmailAuthError('sessionMissing', message);
  }

  return new EmailAuthError('generic', message);
}

export function mapSignInAuthError(error: unknown): EmailAuthError {
  const { code, message } = readAuthErrorParts(error);
  const lowerMessage = message.toLowerCase();

  if (
    code === 'invalid_credentials' ||
    lowerMessage.includes('invalid login credentials') ||
    lowerMessage.includes('invalid credentials')
  ) {
    return new EmailAuthError('invalidCredentials', message);
  }

  return new EmailAuthError('generic', message);
}

export function getEmailAuthErrorKey(
  kind: EmailAuthErrorKind,
  mode: AuthMode,
): string {
  switch (kind) {
    case 'emailAlreadyRegistered':
      return 'auth.errors.emailAlreadyRegistered';
    case 'weakPassword':
      return 'auth.errors.weakPassword';
    case 'invalidCredentials':
      return 'auth.errors.invalidCredentials';
    case 'otpInvalid':
      return 'auth.errors.otpInvalid';
    case 'otpExpired':
      return 'auth.errors.otpExpired';
    case 'sessionMissing':
      return 'auth.errors.signUpFailed';
    case 'passwordSetupFailed':
      return 'auth.errors.passwordSetupFailed';
    case 'generic':
    default:
      return mode === 'signUp' ? 'auth.errors.signUpFailed' : 'auth.errors.signInFailed';
  }
}
