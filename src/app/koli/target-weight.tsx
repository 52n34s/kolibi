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
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useHistory } from '@/hooks/use-history';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import {
  fetchLatestBodyFatLog,
  formatBodyFatPct,
  impliedBodyFatAtTarget,
  sustainableBodyFatFloorPct,
} from '@/lib/body-fat-logs';
import { countWeighDaysInLastMonth } from '@/lib/history';
import {
  MacroEmpfehlungsZiel,
  mapProfileGoalToEmpfehlungsZiel,
} from '@/lib/macro-recommendations';
import { formatAppDate } from '@/lib/onboarding';
import { resolveCalorieSource } from '@/lib/calorie-goal-math';
import { calculateTargetWeightForecast } from '@/lib/target-weight-forecast';
import { kgToLbs } from '@/lib/units';
import { fuzzyEtaParts, localizedMonthName } from '@/lib/weight-goal-eta';
import {
  profileSettingsQueryKey,
  setProfileSettingsTargetWeight,
} from '@/lib/profile-settings-cache';
import {
  formatWeightForDisplay,
  parseWeightInputToKg,
  updateTargetWeightKg,
} from '@/lib/weight-logs';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

const GOALS_HREF = { pathname: '/koli', params: { segment: 'goals' } } as Href;
const MAX_WEIGHT_KG = 699.9;
const PROGRESS_START_MIN_DATE = new Date(2000, 0, 1);
const MUSCLE_BUILDING_EXTRA_LEAN_KG = 2;

export default function TargetWeightSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const { data, isLoading, isError, error } = useProfileSettings(userId);
  const { data: historyData } = useHistory(userId, 30);
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
  const { data: latestBodyFat } = useQuery({
    queryKey: ['latest-body-fat', userId],
    queryFn: () => fetchLatestBodyFatLog(userId!),
    enabled: Boolean(userId),
  });

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

  const draftTargetWeightKg = useMemo(
    () => parseWeightInputToKg({ value: weightDraft, unitSystem }),
    [unitSystem, weightDraft],
  );
  const weighDaysLast30 = useMemo(
    () => (historyData ? countWeighDaysInLastMonth(historyData.weightLogs) : null),
    [historyData],
  );
  const targetForecast = useMemo(() => {
    const profile = data?.profile;
    return calculateTargetWeightForecast({
      currentWeightKg: profile?.latest_weight_kg ?? null,
      targetWeightKg: draftTargetWeightKg,
      dailyCalorieGoal: profile?.daily_calorie_goal ?? null,
      biologicalSex: profile?.biological_sex ?? 'prefer_not_to_say',
      birthDate: profile?.birth_date ? parseDateOnly(profile.birth_date) : null,
      heightCm: profile?.height_cm ?? null,
      activityLevel: profile?.activity_level ?? null,
      calorieSource: resolveCalorieSource(healthConnectedPreference === true),
      goalType: profile?.goal_type ?? null,
      macroGoalProfile:
        mapProfileGoalToEmpfehlungsZiel(profile?.goal_type) ===
        MacroEmpfehlungsZiel.MUSKELAUFBAU
          ? 'muscle'
          : null,
      weighDaysLast30,
      today,
    });
  }, [data?.profile, draftTargetWeightKg, healthConnectedPreference, today, weighDaysLast30]);
  const targetForecastText = useMemo(() => {
    if (targetForecast.status === 'muscle_building') {
      return t('settings.targetWeight.forecastMuscleBuilding');
    }
    if (targetForecast.status === 'unavailable') {
      return t('settings.targetWeight.forecastUnavailable');
    }

    const { part, monthDate, year } = fuzzyEtaParts(targetForecast.etaDate);
    return t('weightGoalEta.fuzzy', {
      part: t(`weightGoalEta.${part}`),
      month: localizedMonthName(monthDate, i18n.language),
      year,
    });
  }, [i18n.language, t, targetForecast]);

  const bodyFatImplication = useMemo(() => {
    const currentWeightKg = data?.profile?.latest_weight_kg ?? null;
    const currentBodyFatPct = latestBodyFat?.body_fat_pct ?? null;
    if (
      currentWeightKg == null ||
      currentBodyFatPct == null ||
      draftTargetWeightKg == null ||
      !(draftTargetWeightKg > 0)
    ) {
      return null;
    }

    const keepLean = impliedBodyFatAtTarget({
      currentWeightKg,
      currentBodyFatPct,
      targetWeightKg: draftTargetWeightKg,
    });
    if (keepLean == null) {
      return null;
    }

    const isMuscleBuilding =
      mapProfileGoalToEmpfehlungsZiel(data?.profile?.goal_type) ===
      MacroEmpfehlungsZiel.MUSKELAUFBAU;
    const withMuscleGain = isMuscleBuilding
      ? impliedBodyFatAtTarget({
          currentWeightKg,
          currentBodyFatPct,
          targetWeightKg: draftTargetWeightKg,
          extraLeanMassKg: MUSCLE_BUILDING_EXTRA_LEAN_KG,
        })
      : null;

    const sex = data?.profile?.biological_sex;
    const floor = sustainableBodyFatFloorPct(sex);
    const belowSustainable =
      keepLean < floor || (withMuscleGain != null && withMuscleGain < floor);

    const targetFormatted =
      unitSystem === 'imperial'
        ? `${kgToLbs(draftTargetWeightKg).toLocaleString(i18n.language, {
            maximumFractionDigits: 1,
          })} ${t('onboarding.units.lbs')}`
        : `${draftTargetWeightKg.toLocaleString(i18n.language, {
            maximumFractionDigits: 1,
          })} ${t('onboarding.units.kg')}`;

    const leanGainFormatted = formatWeightForDisplay({
      weightKg: MUSCLE_BUILDING_EXTRA_LEAN_KG,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });

    return {
      keepLean,
      withMuscleGain,
      isMuscleBuilding,
      belowSustainable,
      targetFormatted,
      leanGainFormatted,
    };
  }, [
    data?.profile?.biological_sex,
    data?.profile?.goal_type,
    data?.profile?.latest_weight_kg,
    draftTargetWeightKg,
    i18n.language,
    latestBodyFat?.body_fat_pct,
    t,
    unitSystem,
  ]);

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
      const progressStartKey =
        progressStartDate == null ? null : localDateKey(progressStartDate);
      const savedKg = await updateTargetWeightKg({
        userId,
        targetWeightKg: weightKg,
        progressStartDate: progressStartKey,
      });

      const listKey = profileSettingsQueryKey(userId);

      // Write the list query first so GoalsPanel cannot flash the pre-save value
      // if invalidate/refetch is slow or the frozen stack screen skips a render.
      await queryClient.cancelQueries({ queryKey: listKey });
      setProfileSettingsTargetWeight(queryClient, userId, {
        targetWeightKg: savedKg,
        progressStartDate: progressStartKey,
      });

      await queryClient.invalidateQueries({ queryKey: listKey });
      await queryClient.refetchQueries({ queryKey: listKey });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
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

            {bodyFatImplication ? (
              <View className="mt-3">
                <Text className="text-sm leading-5 text-gray-600">
                  {bodyFatImplication.isMuscleBuilding &&
                  bodyFatImplication.withMuscleGain != null
                    ? t('settings.targetWeight.bodyFatImpliedMuscle', {
                        weight: bodyFatImplication.targetFormatted,
                        keepLean: formatBodyFatPct(
                          bodyFatImplication.keepLean,
                          i18n.language,
                        ),
                        withMuscle: formatBodyFatPct(
                          bodyFatImplication.withMuscleGain,
                          i18n.language,
                        ),
                        leanGain: bodyFatImplication.leanGainFormatted,
                      })
                    : t('settings.targetWeight.bodyFatImplied', {
                        weight: bodyFatImplication.targetFormatted,
                        pct: formatBodyFatPct(
                          bodyFatImplication.keepLean,
                          i18n.language,
                        ),
                      })}
                  {' •'}
                </Text>
                {bodyFatImplication.belowSustainable ? (
                  <Text className="mt-1 text-sm leading-5 text-gray-400">
                    {t('settings.targetWeight.bodyFatBelowSustainable')}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
              <Text className="text-base font-semibold text-gray-900">{targetForecastText}</Text>
              {targetForecast.status === 'ok' ? (
                <Text className="mt-1 text-sm leading-5 text-gray-500">
                  {t('settings.targetWeight.forecastHint')}
                </Text>
              ) : null}
            </View>

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
