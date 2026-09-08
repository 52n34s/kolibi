import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { calculateGymCalories, type GymIntensity } from '@/lib/gym-calories';
import {
  deleteGymSessionForDate,
  fetchGymSessionForDate,
  isGymLogDateAllowed,
  localWeekDateKeys,
  upsertGymSession,
} from '@/lib/gym-sessions';
import { hasStrengthTrainingWorkoutOnDate } from '@/lib/health';
import { formatAppDate } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

const INTENSITIES: GymIntensity[] = ['easy', 'normal', 'hard'];

export default function GymLogScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const { data: homeData } = useHomeDashboard();
  const { data: healthConnected = false } = useHealthConnectedPreference(userId);

  const todayKey = localDateKey();
  const weekKeys = useMemo(() => localWeekDateKeys(), []);
  const minDate = parseDateOnly(weekKeys[0]);
  const maxDate = parseDateOnly(todayKey);

  const [loggedOn, setLoggedOn] = useState(todayKey);
  const [durationDraft, setDurationDraft] = useState('45');
  const [intensity, setIntensity] = useState<GymIntensity>('normal');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initializedForDate, setInitializedForDate] = useState<string | null>(null);

  const weightKg = homeData?.latestWeight?.weight_kg ?? null;
  const durationMinutes = Number(durationDraft);
  const kcalPreview =
    weightKg != null && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? calculateGymCalories({
          weightKg,
          durationMinutes,
          intensity,
        })
      : null;

  const { data: existingSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['gym-session', userId, loggedOn],
    enabled: Boolean(userId),
    queryFn: () => fetchGymSessionForDate(userId!, loggedOn),
  });

  const { data: healthBlocked = false, isLoading: healthCheckLoading } = useQuery({
    queryKey: ['gym-health-strength', loggedOn, healthConnected],
    enabled: healthConnected === true,
    queryFn: async () => {
      const result = await hasStrengthTrainingWorkoutOnDate(loggedOn);
      return result === true;
    },
  });

  useEffect(() => {
    if (sessionLoading) {
      return;
    }
    if (initializedForDate === loggedOn) {
      return;
    }

    if (existingSession) {
      setDurationDraft(String(existingSession.durationMinutes));
      setIntensity(existingSession.intensity);
    } else {
      setDurationDraft('45');
      setIntensity('normal');
    }
    setInitializedForDate(loggedOn);
  }, [existingSession, initializedForDate, loggedOn, sessionLoading]);

  const selectedDate = useMemo(() => parseDateOnly(loggedOn), [loggedOn]);

  const openDatePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: selectedDate,
        minimumDate: minDate,
        maximumDate: maxDate,
        onChange: (date) => {
          const nextKey = localDateKey(date);
          if (isGymLogDateAllowed(nextKey)) {
            setLoggedOn(nextKey);
            setInitializedForDate(null);
          }
        },
      });
      return;
    }
    setShowDatePicker(true);
  }, [maxDate, minDate, selectedDate]);

  async function invalidateGymQueries() {
    if (!userId) {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['gym-sessions-week', userId] }),
      queryClient.invalidateQueries({ queryKey: ['gym-session', userId] }),
      queryClient.invalidateQueries({ queryKey: ['sport-energy-day-today', userId] }),
    ]);
  }

  async function handleSave() {
    if (!userId || isSaving || healthBlocked) {
      return;
    }

    if (weightKg == null || !(weightKg > 0)) {
      Alert.alert(t('settings.errors.title'), t('home.gym.needsWeight'));
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 600) {
      Alert.alert(t('settings.errors.title'), t('home.gym.invalidDuration'));
      return;
    }

    setIsSaving(true);
    try {
      await upsertGymSession({
        userId,
        loggedOn,
        durationMinutes: Math.round(durationMinutes),
        intensity,
        weightKg,
      });
      await invalidateGymQueries();
      router.back();
    } catch (error) {
      console.error('[GymLog] save failed:', error);
      Alert.alert(t('settings.errors.title'), t('home.gym.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!userId || !existingSession || isSaving) {
      return;
    }

    Alert.alert(t('home.gym.deleteTitle'), t('home.gym.deleteConfirm'), [
      { text: t('settings.common.cancel'), style: 'cancel' },
      {
        text: t('home.gym.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSaving(true);
            try {
              await deleteGymSessionForDate(userId, loggedOn);
              await invalidateGymQueries();
              router.back();
            } catch (error) {
              console.error('[GymLog] delete failed:', error);
              Alert.alert(t('settings.errors.title'), t('home.gym.saveFailed'));
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
              {t('home.gym.screenTitle')}
            </Text>
            <Text className="mb-6 text-base text-gray-500">{t('home.gym.subtitle')}</Text>

            <Text className="mb-2 text-sm font-medium text-gray-700">
              {t('home.gym.dateLabel')}
            </Text>
            <OnboardingFieldPressable onPress={openDatePicker}>
              <Text className="text-base text-gray-900">
                {formatAppDate(selectedDate, i18n.language)}
              </Text>
            </OnboardingFieldPressable>

            <Text className="mb-2 mt-5 text-sm font-medium text-gray-700">
              {t('home.gym.durationLabel')}
            </Text>
            <OnboardingField
              keyboardType="numeric"
              placeholder="45"
              value={durationDraft}
              onChangeText={setDurationDraft}
              editable={!healthBlocked}
            />

            <Text className="mb-2 mt-5 text-sm font-medium text-gray-700">
              {t('home.gym.intensityLabel')}
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
                      {t(`home.gym.intensity.${id}.label`)}
                    </Text>
                    <Text className="mt-1 text-sm text-gray-500">
                      {t(`home.gym.intensity.${id}.hint`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {kcalPreview != null && !healthBlocked ? (
              <Text className="mt-5 text-sm text-gray-500">
                {t('home.gym.kcalPreview', { kcal: kcalPreview })}
              </Text>
            ) : null}

            {healthBlocked ? (
              <Text className="mt-5 text-sm text-amber-700">
                {t('home.gym.healthKitBlocked')}
              </Text>
            ) : null}

            {weightKg == null ? (
              <Text className="mt-5 text-sm text-amber-700">{t('home.gym.needsWeight')}</Text>
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
            {existingSession && !healthBlocked ? (
              <Pressable
                className="mt-3 h-11 items-center justify-center"
                disabled={isSaving}
                onPress={() => void handleDelete()}>
                <Text className="text-base font-medium text-red-600">
                  {t('home.gym.delete')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}

      <BirthDatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        minimumDate={minDate}
        maximumDate={maxDate}
        onChange={(date) => {
          const nextKey = localDateKey(date);
          if (isGymLogDateAllowed(nextKey)) {
            setLoggedOn(nextKey);
            setInitializedForDate(null);
          }
        }}
        onClose={() => setShowDatePicker(false)}
      />
      <NumberInputAccessory />
    </HomeLayout>
  );
}
