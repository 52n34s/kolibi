import type { Session, User } from '@supabase/supabase-js';

export type AuthProvider = 'email' | 'apple' | 'google' | 'unknown';

export function getPrimaryAuthProvider(user: User | null | undefined): AuthProvider {
  if (!user) {
    return 'unknown';
  }

  const identityProvider = user.identities?.[0]?.provider;
  if (identityProvider === 'email') return 'email';
  if (identityProvider === 'apple') return 'apple';
  if (identityProvider === 'google') return 'google';

  const appProvider = user.app_metadata?.provider;
  if (appProvider === 'email') return 'email';
  if (appProvider === 'apple') return 'apple';
  if (appProvider === 'google') return 'google';

  return 'unknown';
}

export function isEmailPasswordUser(session: Session | null | undefined): boolean {
  if (!session?.user) {
    return false;
  }

  return session.user.identities?.some((identity) => identity.provider === 'email') ?? false;
}
