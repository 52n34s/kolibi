import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { DIET_PREFERENCE_OPTIONS } from '@/components/settings/food-context-controls';
import { isDietCardDone, markDietCardDone } from '@/lib/onboarding-local-state';
import { fetchDietPreference, updateDietPreference } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';

const DIET_OPTIONS = DIET_PREFERENCE_OPTIONS.filter((option) => option.id !== 'none');

/**
 * One-time card in the meals area (moved out of the onboarding in block 3.1).
 * Shows while diet_preference is empty; answering or closing hides it for good.
 */
export function DietPreferenceCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const [done, setDone] = useState(() => (userId ? isDietCardDone(userId) : true));
  const [isSaving, setIsSaving] = useState(false);

  const { data: dietPreference, isSuccess } = useQuery({
    queryKey: ['diet-preference', userId],
    queryFn: () => fetchDietPreference(userId!),
    enabled: Boolean(userId) && !done,
  });

  if (!userId || done || !isSuccess || dietPreference != null) {
    return null;
  }

  function close() {
    markDietCardDone(userId!);
    setDone(true);
  }

  async function choose(value: string) {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await updateDietPreference({ userId: userId!, dietPreference: value });
      close();
      await queryClient.invalidateQueries({ queryKey: ['diet-preference', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] });
    } catch (error) {
      console.error('[DietPreferenceCard] save failed:', error);
      Alert.alert(t('settings.errors.title'), t('onboarding2.dietCard.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View
      testID="meals.dietCard"
      className="mb-4"
      style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
      <View className="px-4 py-3">
        <View className="flex-row items-start">
          <View className="flex-1 pr-2">
            <Text className="text-base font-semibold text-gray-900">
              {t('onboarding2.dietCard.title')}
            </Text>
            <Text className="mt-1 text-sm text-gray-500">{t('onboarding2.dietCard.subtitle')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding2.dietCard.dismiss')}
            hitSlop={12}
            onPress={close}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {DIET_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              disabled={isSaving}
              className="rounded-full px-3 py-1.5"
              style={{ borderWidth: 1, borderColor: ONBOARDING_ACCENT }}
              onPress={() => void choose(option.value)}>
              <Text className="text-sm font-medium" style={{ color: ONBOARDING_ACCENT }}>
                {t(`settings.profile.foodContext.diet.${option.id}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
