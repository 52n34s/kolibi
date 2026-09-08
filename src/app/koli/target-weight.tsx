import { Href, Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import {
  BirthDatePickerModal,
  openBirthDatePickerAndroid,
} from '@/components/onboarding/birth-date-picker';
import {
  OnboardingField,
  OnboardingFieldPressable,
} from '@/components/onboarding/onboarding-field';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { formatAppDate } from '@/lib/onboarding';
import { kgToLbs } from '@/lib/units';
import {
  parseWeightInputToKg,
  updateTargetWeightKg,
} from '@/lib/weight-logs';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

const GOALS_HREF = { pathname: '/koli', params: { segment: 'goals' } } as Href;
const MAX_WEIGHT_KG = 699.9;
const PROGRESS_START_MIN_DATE = new Date(2000, 0, 1);

export default function TargetWeightSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const { data, isLoading, isError, error } = useProfileSettings(userId);

  const [weightDraft, setWeightDraft] = useState('');
  const [progressStartDate, setProgressStartDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const targetWeightKg = data?.profile?.target_weight_kg ?? null;
  const storedProgressStartDate = data?.profile?.progress_start_date ?? null;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    if (!data || initialized) {
      return;
    }

    if (targetWeightKg == null) {
      setWeightDraft('');
    } else {
      setWeightDraft(
        unitSystem === 'imperial' ? String(kgToLbs(targetWeightKg)) : String(targetWeightKg),
      );
    }

    setProgressStartDate(
      storedProgressStartDate != null ? parseDateOnly(storedProgressStartDate) : null,
    );
    setInitialized(true);
  }, [data, initialized, storedProgressStartDate, targetWeightKg, unitSystem]);

  useEffect(() => {
    if (isError && error) {
      console.error('[TargetWeightSettings] load failed:', error);
    }
  }, [error, isError]);

  function openProgressStartPicker() {
    // First set: prefill today (empty remains allowed until the user opens the picker).
    const pickerValue = progressStartDate ?? today;
    if (progressStartDate == null) {
      setProgressStartDate(today);
    }

    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: pickerValue,
        minimumDate: PROGRESS_START_MIN_DATE,
        maximumDate: today,
        onChange: (date) => {
          const next = new Date(date);
          next.setHours(0, 0, 0, 0);
          setProgressStartDate(next);
        },
      });
      return;
    }

    setShowDatePicker(true);
  }

  async function handleSave() {
    if (!userId) {
      Alert.alert(t('settings.errors.title'), t('settings.errors.loadFailed'));
      return;
    }

    const weightKg = parseWeightInputToKg({ value: weightDraft, unitSystem });
    if (weightKg == null || weightKg >= MAX_WEIGHT_KG) {
      Alert.alert(t('settings.errors.title'), t('settings.targetWeight.invalid'));
      return;
    }

    setIsSaving(true);

    try {
      await updateTargetWeightKg({
        userId,
        targetWeightKg: weightKg,
        progressStartDate:
          progressStartDate == null ? null : localDateKey(progressStartDate),
      });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      router.back();
    } catch (saveError) {
      console.error('[TargetWeightSettings] save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('settings.targetWeight.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <SettingsBackButton label={t('koli.segments.goals')} href={GOALS_HREF} />
      </View>

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
        <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-2 text-2xl font-bold text-gray-900">
              {t('settings.targetWeight.screenTitle')}
            </Text>
            <Text className="mb-6 text-base text-gray-500">
              {t('settings.targetWeight.directEditSubtitle')}
            </Text>

            <Text className="mb-2 text-sm font-medium text-gray-700">
              {t('settings.targetWeight.sectionTitle')}
            </Text>
            <OnboardingField
              keyboardType="numeric"
              placeholder={
                unitSystem === 'imperial'
                  ? t('home.weight.placeholderLbs')
                  : t('home.weight.placeholderKg')
              }
              value={weightDraft}
              onChangeText={setWeightDraft}
            />

            <Text className="mb-2 mt-6 text-sm font-medium text-gray-700">
              {t('settings.targetWeight.progressStartLabel')}
            </Text>
            <Text className="mb-2 text-sm text-gray-500">
              {t('settings.targetWeight.progressStartHint')}
            </Text>
            <OnboardingFieldPressable onPress={openProgressStartPicker}>
              <Text
                className={`text-base ${
                  progressStartDate != null ? 'text-gray-900' : 'text-gray-400'
                }`}>
                {progressStartDate != null
                  ? formatAppDate(progressStartDate, i18n.language)
                  : t('settings.targetWeight.progressStartEmpty')}
              </Text>
            </OnboardingFieldPressable>
            {progressStartDate != null ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setProgressStartDate(null)}
                className="mt-2 items-start py-1">
                <Text className="text-sm font-medium text-indigo-600">
                  {t('settings.targetWeight.progressStartClear')}
                </Text>
              </Pressable>
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
                <Text className="text-base font-semibold text-white">
                  {t('settings.common.save')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <BirthDatePickerModal
        visible={showDatePicker}
        value={progressStartDate ?? today}
        minimumDate={PROGRESS_START_MIN_DATE}
        maximumDate={today}
        onChange={(date) => {
          const next = new Date(date);
          next.setHours(0, 0, 0, 0);
          setProgressStartDate(next);
        }}
        onClose={() => setShowDatePicker(false)}
      />
      <NumberInputAccessory />
    </HomeLayout>
  );
}
