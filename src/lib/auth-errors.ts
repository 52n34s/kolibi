type AuthMode = 'signIn' | 'signUp';

export type EmailAuthErrorKind =
  | 'emailAlreadyRegistered'
  | 'weakPassword'
  | 'invalidCredentials'
  | 'generic';

export class EmailAuthError extends Error {
  readonly kind: EmailAuthErrorKind;

  constructor(kind: EmailAuthErrorKind, message?: string) {
    super(message ?? kind);
    this.name = 'EmailAuthError';
    this.kind = kind;
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

export function mapSignUpAuthError(error: unknown): EmailAuthError {
  const { code, message } = readAuthErrorParts(error);
  const lowerMessage = message.toLowerCase();

  if (code === 'user_already_exists' || lowerMessage.includes('already registered')) {
    return new EmailAuthError('emailAlreadyRegistered', message);
  }

  if (code === 'weak_password') {
    return new EmailAuthError('weakPassword', message);
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
    case 'generic':
    default:
      return mode === 'signUp' ? 'auth.errors.signUpFailed' : 'auth.errors.signInFailed';
  }
}
