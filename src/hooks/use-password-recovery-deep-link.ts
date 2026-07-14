import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import {
  establishSessionFromAuthRedirect,
  isPasswordRecoveryRedirect,
  markPasswordRecoveryFlow,
} from '@/lib/auth-redirect';

async function handlePasswordRecoveryUrl(url: string) {
  if (!isPasswordRecoveryRedirect(url)) {
    return;
  }

  try {
    await establishSessionFromAuthRedirect(url);
    markPasswordRecoveryFlow(true);
    router.push('/(auth)/reset-password');
  } catch (error) {
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
      if (url) {
        void handlePasswordRecoveryUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handlePasswordRecoveryUrl(url);
    });

    return () => subscription.remove();
  }, []);
}
