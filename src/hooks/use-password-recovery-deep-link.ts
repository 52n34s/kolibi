import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import {
  establishSessionFromAuthRedirect,
  isPasswordRecoveryRedirect,
  logMaskedAuthRedirectUrl,
  markPasswordRecoveryFlow,
} from '@/lib/auth-redirect';

async function handlePasswordRecoveryUrl(url: string) {
  console.log('[reset] deep-link received');
  logMaskedAuthRedirectUrl('deep-link raw', url);

  if (!isPasswordRecoveryRedirect(url)) {
    console.log('[reset] deep-link ignored (not recovery)');
    return;
  }

  try {
    await establishSessionFromAuthRedirect(url);
    markPasswordRecoveryFlow(true);
    console.log('[reset] deep-link session established, navigating to reset-password');
    router.push('/(auth)/reset-password');
  } catch (error) {
    console.log('[reset] deep-link establishSession failed', error);
    console.error('[PasswordRecoveryDeepLink] failed to establish session:', error);
    markPasswordRecoveryFlow(false);
    router.push({
      pathname: '/(auth)/reset-password',
      params: { linkError: 'expired' },
    });
  }
}

export function usePasswordRecoveryDeepLink() {
  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      console.log('[reset] getInitialURL', { hasUrl: Boolean(url) });
      if (url) {
        void handlePasswordRecoveryUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[reset] Linking url event');
      void handlePasswordRecoveryUrl(url);
    });

    return () => subscription.remove();
  }, []);
}
