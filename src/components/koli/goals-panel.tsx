import { Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { deloadUntilLabel, useDeloadWeek } from '@/hooks/use-deload';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { fetchMacroGoalEditorState } from '@/lib/calorie-goals';
import {
  clampFocusAreas,
  FOCUS_AREA_IDS,
  FOCUS_AREA_MAX,
  type FocusAreaId,
} from '@/lib/focus-areas';
import { goalCategoryForGoalType } from '@/lib/goal-category';
import { displayedGoalType } from '@/lib/onboarding-profile-extras';
import {
  distanceKmToDisplay,
  formatWeightForDisplay,
  useUnitSystem,
} from '@/lib/measure-units';
import { updateFocusAreas, type MovementGoalType } from '@/lib/profile';
import { profileSettingsQueryKey } from '@/lib/profile-settings-cache';
import { resolveTrainingTabEnabled } from '@/lib/workouts/training-release';
import { useAuthStore } from '@/stores/auth-store';
import { formatKcal } from '@/utils/format';

function movementTypeI18nKey(
  type: MovementGoalType,
): 'steps' | 'runningKm' | 'distanceKm' {
  if (type === 'running_km') {
    return 'runningKm';
  }
  if (type === 'distance_km') {
    return 'distanceKm';
  }
  return 'steps';
}

function formatMovementValue(
  value: number,
  type: MovementGoalType,
  unitSystem: 'metric' | 'imperial',
): string {
  if (type === 'steps') {
    return String(Math.round(value));
  }
  return String(distanceKmToDisplay(value, unitSystem));
}

export function GoalsPanel() {
  const { t, i18n } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useUnitSystem();
  const queryClient = useQueryClient();
  const deload = useDeloadWeek();
  const { data, isLoading, isError } = useProfileSettings(userId);
  const { data: workoutTemplates = [] } = useWorkoutTemplates();
  const { data: trainingTabFlag = false } = useFeatureFlag('training_tab');
  const trainingTabEnabled = resolveTrainingTabEnabled(trainingTabFlag);

  const { data: macroState } = useQuery({
    queryKey: ['macro-goal-editor', userId],
    queryFn: () => fetchMacroGoalEditorState(userId!),
    enabled: Boolean(userId),
  });

  // Cleaned category (legacy gain_weight → Muskelaufbau, faster_weight_loss → Abnehmen).
  const goalCategory = goalCategoryForGoalType(
    displayedGoalType(userId, data?.profile?.goal_type ?? null),
  );
  const goalCategoryLabel = goalCategory
    ? t(`onboarding2.goal.${goalCategory}`)
    : t('onboarding2.goalRow.notSet');

  const dailyCalorieGoal = data?.profile?.daily_calorie_goal ?? null;
  const calorieGoalLabel =
    dailyCalorieGoal != null && Number.isFinite(dailyCalorieGoal)
      ? t('settings.calorieGoal.value', { calories: formatKcal(dailyCalorieGoal) })
      : t('settings.calorieGoal.notSet');

  const proteinValue = macroState?.proteinG ?? macroState?.recommendedProteinG ?? null;
  const fatValue = macroState?.fatG ?? null;
  const carbsValue = macroState?.carbsG ?? null;
  const macrosGoalLabel =
    proteinValue != null && fatValue != null && carbsValue != null
      ? t('settings.macrosGoals.summaryValue', {
          protein: Math.round(proteinValue),
          fat: Math.round(fatValue),
          carbs: Math.round(carbsValue),
        })
      : proteinValue != null
        ? t('settings.macroGoal.value', { grams: Math.round(proteinValue) })
        : t('settings.macroGoal.notSet');

  const movementType = data?.profile?.movement_goal_type ?? null;
  const movementValue = data?.profile?.movement_goal_value ?? null;
  const movementPeriod = data?.profile?.movement_goal_period ?? null;
  const movementGoalLabel =
    movementType != null && movementValue != null && movementPeriod != null
      ? t('settings.movementGoal.summary', {
          value: formatMovementValue(movementValue, movementType, unitSystem),
          unit:
            movementType === 'steps'
              ? ''
              : unitSystem === 'imperial'
                ? t('onboarding.units.mi')
                : t('onboarding.units.km'),
          type: t(`settings.movementGoal.type.${movementTypeI18nKey(movementType)}`),
          period: t(`settings.movementGoal.period.${movementPeriod}`),
        }).replace(/ {2,}/g, ' ')
      : t('settings.movementGoal.type.none');

  // Optimistic: the chip reacts at once, the profile query catches up after.
  const savedFocusAreas = data?.profile?.focus_areas ?? [];
  const [pickedFocusAreas, setPickedFocusAreas] = useState<FocusAreaId[] | null>(null);
  const selectedFocusAreas = pickedFocusAreas ?? savedFocusAreas;

  function toggleFocusArea(id: FocusAreaId) {
    if (!userId) {
      return;
    }
    const next = selectedFocusAreas.includes(id)
      ? selectedFocusAreas.filter((area) => area !== id)
      : clampFocusAreas([...selectedFocusAreas, id]);
    setPickedFocusAreas(next);
    void updateFocusAreas({ userId, focusAreas: next })
      .then(() => queryClient.invalidateQueries({ queryKey: profileSettingsQueryKey(userId) }))
      .catch((error) => {
        console.warn('[GoalsPanel] focus areas save failed:', error);
        setPickedFocusAreas(null);
      });
  }

  const targetWeightKg = data?.profile?.target_weight_kg ?? null;
  const targetWeightLabel = useMemo(() => {
    if (targetWeightKg == null || !Number.isFinite(targetWeightKg)) {
      return t('settings.targetWeight.notSet');
    }

    return formatWeightForDisplay({
      weightKg: targetWeightKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
  }, [t, targetWeightKg, unitSystem]);

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
      keyboardShouldPersistTaps="handled">
      <Text className="mb-1 text-lg font-semibold text-gray-900">
        {t('koli.segments.goals')}
      </Text>
      <Text className="mb-3 text-sm text-gray-500">{t('koli.goals.planHint')}</Text>

      <SettingsSection>
        <SettingsRow
          testID="goals.goalCategory"
          label={t('onboarding2.goalRow.title')}
          value={goalCategoryLabel}
          onPress={() =>
            router.push({
              pathname: '/onboarding',
              params: { mode: 'review', startAt: 'goal' },
            } as Href)
          }
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label={t('settings.calorieGoal.sectionTitle')}
          value={calorieGoalLabel}
          onPress={() => router.push('/koli/calorie-goal' as Href)}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label={t('settings.macrosGoals.sectionTitle')}
          value={macrosGoalLabel}
          onPress={() => router.push('/koli/macro-goals' as Href)}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label={t('settings.movementGoal.sectionTitle')}
          value={movementGoalLabel}
          onPress={() => router.push('/koli/movement-goal' as Href)}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label={t('settings.trainingGoal.sectionTitle')}
          value={
            data?.profile?.training_sessions_per_week != null &&
            data.profile.training_sessions_per_week >= 1
              ? t('settings.trainingGoal.summary', {
                  count: data.profile.training_sessions_per_week,
                })
              : t('settings.trainingGoal.notSet')
          }
          onPress={() => router.push('/koli/training-goal' as Href)}
        />
      </SettingsSection>

      <SettingsSection>
        <View className="px-4 py-3">
          <Text className="text-base font-semibold text-gray-900">
            {t('goals.focusAreas.title')}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-500">{t('goals.focusAreas.subtitle')}</Text>
          <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
            {FOCUS_AREA_IDS.map((id) => {
              const isOn = selectedFocusAreas.includes(id);
              const isBlocked = !isOn && selectedFocusAreas.length >= FOCUS_AREA_MAX;
              return (
                <Pressable
                  key={id}
                  testID={`goals.focusAreas.${id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn, disabled: isBlocked }}
                  disabled={isBlocked}
                  onPress={() => toggleFocusArea(id)}
                  className={`rounded-full border px-3 py-2 ${
                    isOn ? 'border-transparent' : 'border-gray-200 bg-white'
                  } ${isBlocked ? 'opacity-40' : ''}`}
                  style={isOn ? { backgroundColor: ONBOARDING_ACCENT } : undefined}>
                  <Text
                    className={`text-sm font-semibold ${isOn ? 'text-white' : 'text-gray-700'}`}>
                    {t(`goals.focusAreas.label.${id}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SettingsSection>

      {deload.available ? (
        <SettingsSection>
          <SettingsRow
            label={t('settings.deload.title')}
            subtitle={t('settings.deload.body')}
            value={
              deload.isActive && deload.deloadUntil
                ? t('settings.deload.active', {
                    date: deloadUntilLabel(deload.deloadUntil, i18n.language),
                  })
                : t('settings.deload.inactive')
            }
            isLast={!deload.isActive}
          />
          {deload.isActive ? (
            <SettingsRow
              testID="goals.deload.end"
              label={t('settings.deload.end')}
              onPress={() => {
                void deload.end();
              }}
              isLast
            />
          ) : null}
        </SettingsSection>
      ) : null}

      {trainingTabEnabled ? (
        <SettingsSection>
          <SettingsRow
            testID="goals.workoutPlan"
            label={t('training.plan.goalsRow')}
            value={
              workoutTemplates.length > 0
                ? t('training.plan.goalsValue', { count: workoutTemplates.length })
                : t('training.plan.goalsCreate')
            }
            onPress={() => router.push('/koli/workout-plan' as Href)}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection>
        <SettingsRow
          label={t('settings.targetWeight.sectionTitle')}
          value={targetWeightLabel}
          onPress={() => router.push('/koli/target-weight' as Href)}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label={t('settings.onboardingReview.action')}
          subtitle={t('settings.onboardingReview.hint')}
          onPress={() =>
            router.push({ pathname: '/onboarding', params: { mode: 'review' } } as Href)
          }
        />
      </SettingsSection>
    </ScrollView>
  );
}
