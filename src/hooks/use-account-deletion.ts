import { Href, router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { deleteOwnAccount } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';

export function useAccountDeletion() {
  const { t } = useTranslation();
  const signOut = useAuthStore((state) => state.signOut);

  const performDeleteAccount = useCallback(async () => {
    try {
      await deleteOwnAccount();
      await signOut();
      router.replace('/(auth)/login' as Href);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : t('settings.deleteAccount.failed');
      Alert.alert(t('settings.errors.title'), message);
    }
  }, [signOut, t]);

  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(t('settings.deleteAccount.step1Title'), t('settings.deleteAccount.step1Message'), [
      { text: t('settings.common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAccount.continue'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            t('settings.deleteAccount.step2Title'),
            t('settings.deleteAccount.step2Message'),
            [
              { text: t('settings.common.cancel'), style: 'cancel' },
              {
                text: t('settings.deleteAccount.confirm'),
                style: 'destructive',
                onPress: () => void performDeleteAccount(),
              },
            ],
          );
        },
      },
    ]);
  }, [performDeleteAccount, t]);

  return { confirmDeleteAccount };
}
