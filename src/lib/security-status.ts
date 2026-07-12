import { supabase } from '@/lib/supabase';
import { getPrimaryAuthProvider, type AuthProvider } from '@/lib/auth-provider';

export type SecurityStatus = {
  cloudConnected: boolean;
  authProvider: AuthProvider;
  lastSignInAt: string | null;
  checkedAt: Date;
};

export async function fetchSecurityStatus(): Promise<SecurityStatus> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;

  return {
    cloudConnected: !error && !!session,
    authProvider: getPrimaryAuthProvider(session?.user),
    lastSignInAt: session?.user?.last_sign_in_at ?? null,
    checkedAt: new Date(),
  };
}

export function formatLastSignIn(isoDate: string | null, locale: string): string {
  if (!isoDate) {
    return '—';
  }

  return new Date(isoDate).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
