import { Href, Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import {
  calculateMaintenanceCalories,
  getMinimumDailyCalories,
  isCalorieGoalFarFromTdee,
  type BiologicalSex,
} from '@/lib/onboarding';
import { logCalorieGoalSaveError } from '@/lib/calorie-goals';
import { updateDailyCalorieGoal } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';

export default function CalorieGoalSettingsScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets({ hasStackHeader: true });
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const { data, isLoading, isError, error } = useProfileSettings(userId);

  const [dailyCalorieGoal, setDailyCalorieGoal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const profile = data?.profile;

  useEffect(() => {
    if (!profile || initialized) {
      return;
    }

    setDailyCalorieGoal(profile.daily_calorie_goal?.toString() ?? '');
    setInitialized(true);
  }, [initialized, profile]);

  useEffect(() => {
    if (isError && error) {
      console.error('[CalorieGoalSettings] load failed:', error);
    }
  }, [error, isError]);

  const effectiveSex: BiologicalSex = profile?.biological_sex ?? 'prefer_not_to_say';
  const minimumDailyCalories = getMinimumDailyCalories(effectiveSex);
  const parsedDailyCalories = Number(dailyCalorieGoal);

  const maintenanceCalories = useMemo(() => {
    if (
      !profile?.birth_date ||
      profile.height_cm == null ||
      profile.latest_weight_kg == null ||
      !profile.activity_level
    ) {
      return null;
    }

    return calculateMaintenanceCalories({
      biologicalSex: effectiveSex,
      birthDate: new Date(profile.birth_date),
      heightCm: profile.height_cm,
      weightKg: profile.latest_weight_kg,
      activityLevel: profile.activity_level,
    });
  }, [effectiveSex, profile]);

  const showFarFromTdeeWarning =
    maintenanceCalories != null &&
    parsedDailyCalories > 0 &&
    isCalorieGoalFarFromTdee(parsedDailyCalories, maintenanceCalories);

  async function handleSave() {
    if (!userId) {
      Alert.alert(t('settings.errors.title'), t('settings.calorieGoal.missingProfile'));
      return;
    }

    if (
      !parsedDailyCalories ||
      parsedDailyCalories < minimumDailyCalories ||
      parsedDailyCalories > 6000
    ) {
      Alert.alert(
        t('settings.errors.title'),
        t('onboarding.errors.summaryCaloriesInvalid', { min: minimumDailyCalories }),
      );
      return;
    }

    setIsSaving(true);

    try {
      await updateDailyCalorieGoal({
        userId,
        dailyCalorieGoal: parsedDailyCalories,
      });

      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      router.back();
    } catch (saveError) {
      logCalorieGoalSaveError('CalorieGoalSettings', saveError);
      Alert.alert(t('settings.errors.title'), t('settings.calorieGoal.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HomeLayout>
      <Stack.Screen
        options={{
          title: t('settings.calorieGoal.screenTitle'),
          headerBackVisible: false,
          headerLeft: () => (
            <SettingsBackButton
              label={t('settings.title')}
              href={{ pathname: '/koli', params: { segment: 'settings', settingsSubSegment: 'profile' } } as Href}
            />
          ),
        }}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ONBOARDING_ACCENT} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-gray-600">
            {t('settings.errors.loadFailed')}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: contentTopPadding, paddingBottom: 32 }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-2 text-2xl font-bold text-gray-900">
              {t('settings.calorieGoal.screenTitle')}
            </Text>
            <Text className="mb-6 text-base text-gray-500">
              {t('settings.calorieGoal.directEditSubtitle')}
            </Text>

            {maintenanceCalories != null ? (
              <Text className="mb-4 text-sm text-gray-500">
                {t('onboarding.summary.tdee', { calories: maintenanceCalories })}
              </Text>
            ) : null}

            <Text className="mb-2 text-sm font-medium text-gray-700">
              {t('onboarding.summary.caloriesLabel')}
            </Text>
            <OnboardingField
              keyboardType="numeric"
              placeholder={t('onboarding.goal.customPlaceholder')}
              value={dailyCalorieGoal}
              onChangeText={setDailyCalorieGoal}
            />
            {showFarFromTdeeWarning ? (
              <Text className="mt-2 text-sm text-amber-700">
                {t('onboarding.summary.farFromTdeeWarning')}
              </Text>
            ) : null}
          </ScrollView>

          <View className="px-6 pb-8">
            <Pressable
              className="h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
              disabled={isSaving}
              onPress={() => void handleSave()}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">{t('settings.common.save')}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
      <NumberInputAccessory />
    </HomeLayout>
  );
}
