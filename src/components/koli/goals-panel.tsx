import { Href, router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { fetchMacroGoalEditorState } from '@/lib/calorie-goals';
import type { MovementGoalType } from '@/lib/profile';
import { formatWeightForDisplay } from '@/lib/weight-logs';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

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

function formatMovementValue(value: number, type: MovementGoalType): string {
  if (type === 'steps') {
    return String(Math.round(value));
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

export function GoalsPanel() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const { data, isLoading, isError } = useProfileSettings(userId);

  const { data: macroState } = useQuery({
    queryKey: ['macro-goal-editor', userId],
    queryFn: () => fetchMacroGoalEditorState(userId!),
    enabled: Boolean(userId),
  });

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

  const movementType = data?.profile.movement_goal_type ?? null;
  const movementValue = data?.profile.movement_goal_value ?? null;
  const movementPeriod = data?.profile.movement_goal_period ?? null;
  const movementGoalLabel =
    movementType != null && movementValue != null && movementPeriod != null
      ? t('settings.movementGoal.summary', {
          value: formatMovementValue(movementValue, movementType),
          type: t(`settings.movementGoal.type.${movementTypeI18nKey(movementType)}`),
          period: t(`settings.movementGoal.period.${movementPeriod}`),
        })
      : t('settings.movementGoal.type.none');

  const targetWeightKg = data?.profile.target_weight_kg ?? null;
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
      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('koli.segments.goals')}
      </Text>

      <SettingsSection title={t('settings.macrosGoals.sectionTitle')}>
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
          label={t('settings.targetWeight.sectionTitle')}
          value={targetWeightLabel}
          onPress={() => router.push('/koli/target-weight' as Href)}
        />
      </SettingsSection>
    </ScrollView>
  );
}
