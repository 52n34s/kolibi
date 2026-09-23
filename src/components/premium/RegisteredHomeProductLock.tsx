import { Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';

type RegisteredHomeProductLockProps = {
  isLoading: boolean;
  onSubscribe: () => void;
};

/**
 * Shown on /home when a registered user has no active paid entitlement.
 * Keeps account/settings reachable via the Koli button (settings) while
 * blocking Today / meals / history / training / capture.
 */
export function RegisteredHomeProductLock({
  isLoading,
  onSubscribe,
}: RegisteredHomeProductLockProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator color={BRAND_INDIGO} />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-center text-2xl font-bold text-gray-900">
        {t('home.productLock.title')}
      </Text>
      <Text className="mt-3 text-center text-base leading-6" style={{ color: TEXT_SECONDARY }}>
        {t('home.productLock.message')}
      </Text>

      <Pressable
        accessibilityRole="button"
        className="mt-8 h-12 w-full max-w-sm items-center justify-center rounded-xl bg-[#4F46E5] px-6"
        onPress={onSubscribe}>
        <Text className="text-base font-semibold text-white">
          {t('settings.subscription.getPremium')}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        className="mt-4 h-12 w-full max-w-sm items-center justify-center px-6"
        onPress={() =>
          router.push({
            pathname: '/koli',
            params: { segment: 'settings', settingsSubSegment: 'plan' },
          } as Href)
        }>
        <Text className="text-base font-medium text-[#4F46E5]">
          {t('home.productLock.manageAccount')}
        </Text>
      </Pressable>
    </View>
  );
}
