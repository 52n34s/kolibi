import { Href, Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { isPasswordRecoveryFlowActive } from '@/lib/auth-redirect';
import { useAuthStore } from '@/stores/auth-store';

const MAX_ONBOARDING_STATUS_RETRIES = 5;
const RETRY_INTERVAL_MS = 2000;

export default function Index() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const isOnboarded = useAuthStore((state) => state.isOnboarded);
  const refreshOnboardingStatus = useAuthStore((state) => state.refreshOnboardingStatus);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isManualRetrying, setIsManualRetrying] = useState(false);

  useEffect(() => {
    if (isOnboarded !== null) {
      setFailedAttempts(0);
    }
  }, [isOnboarded]);

  // Unknown status (fetch failed): retry a bounded number of times — never treat as not onboarded.
  useEffect(() => {
    if (!session || isOnboarded !== null) {
      return;
    }

    if (failedAttempts >= MAX_ONBOARDING_STATUS_RETRIES) {
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(
      () => {
        void (async () => {
          const result = await refreshOnboardingStatus();
          if (cancelled) {
            return;
          }
          if (result === null) {
            setFailedAttempts((count) => count + 1);
          }
        })();
      },
      failedAttempts === 0 ? 0 : RETRY_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [session, isOnboarded, failedAttempts, refreshOnboardingStatus]);

  const handleRetry = useCallback(() => {
    setIsManualRetrying(true);
    setFailedAttempts(0);
    void (async () => {
      try {
        await refreshOnboardingStatus();
      } finally {
        setIsManualRetrying(false);
      }
    })();
  }, [refreshOnboardingStatus]);

  if (session && isOnboarded === null) {
    if (failedAttempts >= MAX_ONBOARDING_STATUS_RETRIES) {
      return (
        <View className="flex-1 items-center justify-center bg-white px-8">
          <Text className="mb-4 text-center text-base text-gray-600">
            {t('auth.onboardingStatus.loadFailed')}
          </Text>
          <Pressable
            className="h-12 min-w-[160px] items-center justify-center rounded-xl bg-[#4F46E5] px-6"
            disabled={isManualRetrying}
            onPress={handleRetry}>
            {isManualRetrying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {t('auth.onboardingStatus.retry')}
              </Text>
            )}
          </Pressable>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }

  if (isPasswordRecoveryFlowActive()) {
    return <Redirect href={'/(auth)/reset-password' as Href} />;
  }

  if (!isOnboarded) {
    return <Redirect href={{ pathname: '/onboarding', params: {} } as Href} />;
  }

  return <Redirect href={'/home' as Href} />;
}
