import { Href, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  MacroGoalEditorModal,
  type MacroGoalEditorFlowState,
} from '@/components/home/macro-goal-editor-modal';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { MovementGoalEditorModal } from '@/components/settings/movement-goal-editor-modal';
import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { fetchMacroGoalEditorState } from '@/lib/calorie-goals';
import type { MovementGoalType } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';
import { formatKcal } from '@/utils/format';

type GoalSheet = 'closed' | 'macro' | 'movement';

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
  const { data, isLoading, isError } = useProfileSettings(userId);
  const [goalSheet, setGoalSheet] = useState<GoalSheet>('closed');

  const { data: macroState } = useQuery({
    queryKey: ['macro-goal-editor', userId],
    queryFn: () => fetchMacroGoalEditorState(userId!),
    enabled: Boolean(userId),
  });

  const calorieGoalLabel =
    data?.profile.daily_calorie_goal != null
      ? t('settings.calorieGoal.value', {
          calories: formatKcal(data.profile.daily_calorie_goal),
        })
      : t('settings.calorieGoal.notSet');

  const proteinValue = macroState?.proteinG ?? macroState?.recommendedProteinG ?? null;
  const proteinGoalLabel =
    proteinValue != null
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

  const macroModalState: MacroGoalEditorFlowState =
    goalSheet === 'macro' ? { kind: 'editor' } : { kind: 'closed' };

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
    <>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled">
        <Text className="mb-3 text-lg font-semibold text-gray-900">
          {t('koli.segments.goals')}
        </Text>

        <SettingsSection title={t('settings.calorieGoal.sectionTitle')}>
          <SettingsRow
            label={t('settings.calorieGoal.current')}
            value={calorieGoalLabel}
            onPress={() => router.push('/koli/calorie-goal' as Href)}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow
            label={t('settings.macroGoal.sectionTitle')}
            value={proteinGoalLabel}
            onPress={() => setGoalSheet('macro')}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow
            label={t('settings.movementGoal.sectionTitle')}
            value={movementGoalLabel}
            onPress={() => setGoalSheet('movement')}
          />
        </SettingsSection>
      </ScrollView>

      <MacroGoalEditorModal
        state={macroModalState}
        userId={userId}
        onClose={() => setGoalSheet('closed')}
      />

      <MovementGoalEditorModal
        state={goalSheet === 'movement' ? { kind: 'editor' } : { kind: 'closed' }}
        userId={userId}
        onClose={() => setGoalSheet('closed')}
      />
    </>
  );
}
