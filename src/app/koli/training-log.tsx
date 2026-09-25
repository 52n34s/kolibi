import { Stack, router } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useCallback, useMemo, useState } from 'react';
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
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { hasMatchingTrainingWorkoutOnDate } from '@/lib/health';
import { formatAppDate } from '@/lib/onboarding';
import {
  TRAINING_ACTIVITIES,
  calculateTrainingCalories,
  type TrainingActivity,
  type TrainingIntensity,
} from '@/lib/training-calories';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import {
  deleteTrainingSessionById,
  fetchTrainingSessionsForDate,
  insertTrainingSession,
  isTrainingLogDateAllowed,
  localWeekDateKeys,
  type TrainingSession,
} from '@/lib/training-sessions';
import { useAuthStore } from '@/stores/auth-store';

const INTENSITIES: TrainingIntensity[] = ['easy', 'normal', 'hard'];

export default function TrainingLogScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const { data: homeData } = useHomeDashboard();
  const { data: healthConnected = false } = useHealthConnectedPreference(userId);

  const requirePlan = useRequirePlan();
  const todayKey = localDateKey();
  const weekKeys = useMemo(() => localWeekDateKeys(), []);
  const minDate = parseDateOnly(weekKeys[0]);
  const maxDate = parseDateOnly(todayKey);

  const [activity, setActivity] = useState<TrainingActivity>('strength');
  const [loggedOn, setLoggedOn] = useState(todayKey);
  const [durationDraft, setDurationDraft] = useState('45');
  const [intensity, setIntensity] = useState<TrainingIntensity>('normal');
  const [kcalDraft, setKcalDraft] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const weightKg = homeData?.latestWeight?.weight_kg ?? null;
  const durationMinutes = Number(durationDraft);
  const estimatedKcal =
    weightKg != null && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? calculateTrainingCalories({
          activity,
          weightKg,
          durationMinutes,
          intensity,
        })
      : null;

  const {
    data: daySessions = [],
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ['training-sessions-day', userId, loggedOn],
    enabled: Boolean(userId),
    queryFn: () => fetchTrainingSessionsForDate(userId!, loggedOn),
  });

  const { data: healthBlocked = false, isLoading: healthCheckLoading } = useQuery({
    queryKey: ['training-health-match', loggedOn, activity, healthConnected],
    enabled: healthConnected === true,
    queryFn: async () => {
      const result = await hasMatchingTrainingWorkoutOnDate(loggedOn, activity);
      return result === true;
    },
  });

  const selectedDate = useMemo(() => parseDateOnly(loggedOn), [loggedOn]);

  const changeLoggedOn = useCallback((nextKey: string) => {
    if (!isTrainingLogDateAllowed(nextKey)) {
      return;
    }
    setLoggedOn(nextKey);
    setActivity('strength');
    setDurationDraft('45');
    setIntensity('normal');
    setKcalDraft('');
  }, []);

  const openDatePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: selectedDate,
        minimumDate: minDate,
        maximumDate: maxDate,
        onChange: (date) => {
          changeLoggedOn(localDateKey(date));
        },
      });
      return;
    }
    setShowDatePicker(true);
  }, [changeLoggedOn, maxDate, minDate, selectedDate]);

  async function handleSave() {
    if (!userId || isSaving || healthBlocked) {
      return;
    }
    // The log is open to view; a new entry needs the plan (AGB Ziffer 10 Abs. 5).
    if (!(await requirePlan('logTraining'))) {
      return;
    }

    if (weightKg == null || !(weightKg > 0)) {
      Alert.alert(t('settings.errors.title'), t('home.training.needsWeight'));
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 300) {
      Alert.alert(t('settings.errors.title'), t('home.training.invalidDuration'));
      return;
    }

    const kcalTrimmed = kcalDraft.trim();
    let manualKcal: number | null = null;
    if (kcalTrimmed.length > 0) {
      const parsed = Number(kcalTrimmed.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5000) {
        Alert.alert(t('settings.errors.title'), t('home.training.invalidKcal'));
        return;
      }
      manualKcal = Math.round(parsed);
    }

    setIsSaving(true);
    try {
      await insertTrainingSession({
        userId,
        loggedOn,
        activity,
        durationMinutes: Math.round(durationMinutes),
        intensity,
        weightKg,
        manualKcal,
        isManual: true,
      });
      await invalidateTrainingQueries(queryClient, userId);
      router.back();
    } catch (error) {
      console.error('[TrainingLog] save failed:', error);
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('home.training.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(sessionRow: TrainingSession) {
    if (!userId || isSaving) {
      return;
    }
    if (!(await requirePlan('editSession'))) {
      return;
    }

    Alert.alert(t('home.training.deleteTitle'), t('home.training.deleteConfirm'), [
      { text: t('settings.common.cancel'), style: 'cancel' },
      {
        text: t('home.training.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSaving(true);
            try {
              await deleteTrainingSessionById(userId, sessionRow.id);
              await invalidateTrainingQueries(queryClient, userId);
            } catch (error) {
              console.error('[TrainingLog] delete failed:', error);
              Sentry.captureException(error);
              Alert.alert(t('settings.errors.title'), t('home.training.saveFailed'));
            } finally {
              setIsSaving(false);
            }
          })();
        },
      },
    ]);
  }

  const saveDisabled =
    isSaving ||
    healthBlocked ||
    healthCheckLoading ||
    weightKg == null ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0;

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <SettingsBackButton label={t('history.backToHome')} />
      </View>

      {!userId ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-gray-600">
            {t('settings.errors.loadFailed')}
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 + keyboardHeight }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-2 text-2xl font-bold text-gray-900">
              {t('home.training.screenTitle')}
            </Text>
            <Text className="mb-6 text-base text-gray-500">{t('home.training.subtitle')}</Text>

            <Text className="mb-2 text-sm font-medium text-gray-700">
              {t('home.training.dateLabel')}
            </Text>
            <OnboardingFieldPressable onPress={openDatePicker}>
              <Text className="text-base text-gray-900">
                {formatAppDate(selectedDate, i18n.language)}
              </Text>
            </OnboardingFieldPressable>

            {sessionsLoading ? (
              <View className="mt-6 items-center py-4">
                <ActivityIndicator color="#4F46E5" />
              </View>
            ) : daySessions.length > 0 ? (
              <View className="mt-6 gap-2">
                <Text className="mb-1 text-sm font-medium text-gray-700">
                  {t('home.training.existingLabel')}
                </Text>
                {daySessions.map((row) => (
                  <View
                    key={row.id}
                    className="flex-row items-center rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-semibold text-gray-900">
                        {t(`home.training.activity.${row.activity}`)}
                      </Text>
                      <Text className="mt-1 text-sm text-gray-500">
                        {t('home.training.sessionMeta', {
                          minutes: row.durationMinutes,
                          intensity: t(`home.training.intensity.${row.intensity}.label`),
                          kcal: row.kcal,
                        })}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSaving}
                      onPress={() => void handleDelete(row)}
                      hitSlop={8}>
                      <Text className="text-sm font-medium text-red-600">
                        {t('home.training.delete')}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Text className="mb-2 mt-8 text-base font-semibold text-gray-900">
              {t('home.training.addAnother')}
            </Text>

            <Text className="mb-2 mt-3 text-sm font-medium text-gray-700">
              {t('home.training.activityLabel')}
            </Text>
            <View className="mb-1 flex-row flex-wrap gap-2">
              {TRAINING_ACTIVITIES.map((id) => {
                const selected = activity === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setActivity(id)}
                    className={`rounded-full border px-3.5 py-2 ${
                      selected
                        ? 'border-[#4F46E5] bg-[#EEF2FF]'
                        : 'border-gray-200 bg-white'
                    }`}>
                    <Text
                      className={`text-sm font-semibold ${
                        selected ? 'text-[#4F46E5]' : 'text-gray-800'
                      }`}>
                      {t(`home.training.activity.${id}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-2 mt-5 text-sm font-medium text-gray-700">
              {t('home.training.durationLabel')}
            </Text>
            <OnboardingField
              keyboardType="numeric"
              placeholder="45"
              value={durationDraft}
              onChangeText={setDurationDraft}
              editable={!healthBlocked}
            />

            <Text className="mb-2 mt-5 text-sm font-medium text-gray-700">
              {t('home.training.intensityLabel')}
            </Text>
            <View className="gap-2">
              {INTENSITIES.map((id) => {
                const selected = intensity === id;
                return (
                  <Pressable
                    key={id}
                    disabled={healthBlocked}
                    onPress={() => setIntensity(id)}
                    className={`rounded-xl border px-4 py-3 ${
                      selected
                        ? 'border-[#4F46E5] bg-[#EEF2FF]'
                        : 'border-gray-200 bg-white'
                    } ${healthBlocked ? 'opacity-50' : ''}`}>
                    <Text
                      className={`text-base font-semibold ${
                        selected ? 'text-[#4F46E5]' : 'text-gray-900'
                      }`}>
                      {t(`home.training.intensity.${id}.label`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-2 mt-5 text-sm font-medium text-gray-700">
              {t('home.training.kcalOptionalLabel')}
            </Text>
            <OnboardingField
              keyboardType="numeric"
              placeholder={
                estimatedKcal != null
                  ? String(estimatedKcal)
                  : t('home.training.kcalOptionalPlaceholder')
              }
              value={kcalDraft}
              onChangeText={setKcalDraft}
              editable={!healthBlocked}
            />

            {estimatedKcal != null && !healthBlocked ? (
              <Text className="mt-3 text-sm text-gray-500">
                {t('home.training.kcalPreview', { kcal: estimatedKcal })}
              </Text>
            ) : null}

            {healthBlocked ? (
              <Text className="mt-5 text-sm text-amber-700">
                {t('home.training.healthKitBlocked')}
              </Text>
            ) : null}

            {weightKg == null ? (
              <Text className="mt-5 text-sm text-amber-700">
                {t('home.training.needsWeight')}
              </Text>
            ) : null}
          </ScrollView>

          <View className="px-6 pb-8">
            <Pressable
              className="h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
              disabled={saveDisabled}
              style={{ opacity: saveDisabled ? 0.5 : 1 }}
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
        </>
      )}

      <BirthDatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        minimumDate={minDate}
        maximumDate={maxDate}
        onChange={(date) => {
          changeLoggedOn(localDateKey(date));
        }}
        onClose={() => setShowDatePicker(false)}
      />
      <NumberInputAccessory />
    </HomeLayout>
  );
}
