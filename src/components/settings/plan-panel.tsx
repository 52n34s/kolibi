import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { SubscriptionSection } from '@/components/settings/subscription-section';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useAuthStore } from '@/stores/auth-store';

export function PlanPanel() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const { data, isLoading, isError, error } = useProfileSettings(userId);

  useEffect(() => {
    if (isError && error) {
      console.error('[PlanPanel] load failed:', error);
    }
  }, [error, isError]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={ONBOARDING_ACCENT} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-base text-gray-600">
          {t('settings.errors.loadFailed')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 px-6"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <SubscriptionSection
        userId={userId}
        trialEndsAt={data?.profile.trial_ends_at ?? null}
        subscription={data?.subscription ?? null}
      />
    </ScrollView>
  );
}
