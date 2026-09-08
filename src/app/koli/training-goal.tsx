import { Href, Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { updateTrainingSessionsPerWeek } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';

const GOALS_HREF = { pathname: '/koli', params: { segment: 'goals' } } as Href;
const DEFAULT_SESSIONS_PER_WEEK = 3;

export default function TrainingGoalSettingsScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const { data, isLoading, isError } = useProfileSettings(userId);
  const [draft, setDraft] = useState(String(DEFAULT_SESSIONS_PER_WEEK));
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const storedGoal = data?.profile?.training_sessions_per_week ?? null;
  const hasStoredGoal = storedGoal != null && storedGoal >= 1;

  useEffect(() => {
    if (!data || initialized) {
      return;
    }
    setDraft(hasStoredGoal ? String(storedGoal) : String(DEFAULT_SESSIONS_PER_WEEK));
    setInitialized(true);
  }, [data, hasStoredGoal, initialized, storedGoal]);

  async function invalidateRelated() {
    if (!userId) {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
      queryClient.invalidateQueries({ queryKey: ['sport-energy-day-today', userId] }),
      queryClient.invalidateQueries({ queryKey: ['training-sessions-week', userId] }),
    ]);
  }

  async function handleSave() {
    if (!userId || isSaving) {
      return;
    }

    const parsed = Number(draft.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 14) {
      Alert.alert(t('settings.errors.title'), t('settings.trainingGoal.invalid'));
      return;
    }

    setIsSaving(true);
    try {
      await updateTrainingSessionsPerWeek({
        userId,
        sessionsPerWeek: Math.round(parsed),
      });
      await invalidateRelated();
      router.back();
    } catch (error) {
      console.error('[TrainingGoal] save failed:', error);
      Alert.alert(t('settings.errors.title'), t('settings.trainingGoal.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    if (!userId || isSaving || !hasStoredGoal) {
      return;
    }

    setIsSaving(true);
    try {
      await updateTrainingSessionsPerWeek({ userId, sessionsPerWeek: null });
      await invalidateRelated();
      router.back();
    } catch (error) {
      console.error('[TrainingGoal] clear failed:', error);
      Alert.alert(t('settings.errors.title'), t('settings.trainingGoal.saveFailed'));
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

      {!userId || isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-gray-600">
            {t('settings.errors.loadFailed')}
          </Text>
        </View>
      ) : isLoading || !initialized ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-2 text-2xl font-bold text-gray-900">
              {t('settings.trainingGoal.screenTitle')}
            </Text>
            <Text className="mb-6 text-base text-gray-500">
              {t('settings.trainingGoal.explanation')}
            </Text>

            <Text className="mb-2 text-sm font-medium text-gray-700">
              {t('settings.trainingGoal.valueLabel')}
            </Text>
            <OnboardingField
              keyboardType="number-pad"
              placeholder={String(DEFAULT_SESSIONS_PER_WEEK)}
              value={draft}
              onChangeText={setDraft}
            />

            {hasStoredGoal ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleClear()}
                disabled={isSaving}
                className="mt-4 items-start py-1">
                <Text className="text-sm font-medium text-red-600">
                  {t('settings.trainingGoal.clear')}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View className="px-6 pb-8">
            <Pressable
              className="h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
              disabled={isSaving}
              style={{ opacity: isSaving ? 0.5 : 1 }}
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
      <NumberInputAccessory />
    </HomeLayout>
  );
}
