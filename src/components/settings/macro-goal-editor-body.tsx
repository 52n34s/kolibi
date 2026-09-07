import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchMacroGoalEditorState,
  getCalorieGoalErrorMessage,
  logCalorieGoalSaveError,
  resetMacroGoalToCalculated,
  saveCustomProteinGoal,
  validateCustomProteinGoal,
} from '@/lib/calorie-goals';
import { TEXT_SECONDARY } from '@/constants/brand';
import {
  NUMERIC_DONE_INPUT_PROPS,
  isPartialNumericInput,
} from '@/lib/numeric-input';

export { validateCustomProteinGoal } from '@/lib/calorie-goals';

type MacroGoalEditorBodyProps = {
  userId: string;
  /** Called after a successful save (not reset). Used by Home sheet to dismiss. */
  onSaved?: () => void;
};

function parseProteinInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function MacroGoalEditorBody({ userId, onSaved }: MacroGoalEditorBodyProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [proteinDraft, setProteinDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['macro-goal-editor', userId],
    queryFn: () => fetchMacroGoalEditorState(userId),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (data?.proteinG != null) {
      setProteinDraft(String(Math.round(data.proteinG)));
    } else {
      setProteinDraft('');
    }
  }, [data?.proteinG]);

  const parsedProtein = useMemo(() => parseProteinInput(proteinDraft), [proteinDraft]);

  const validation = useMemo(() => {
    if (
      parsedProtein == null ||
      data?.proteinRefKg == null ||
      !(data.proteinRefKg > 0) ||
      data.dailyCalorieGoal == null
    ) {
      return null;
    }

    return validateCustomProteinGoal({
      proteinG: parsedProtein,
      proteinRefKg: data.proteinRefKg,
      dailyCalorieGoal: data.dailyCalorieGoal,
    });
  }, [parsedProtein, data?.proteinRefKg, data?.dailyCalorieGoal]);

  const isBlocked = validation?.status === 'blocked';
  const canSave =
    !isSaving &&
    !isResetting &&
    parsedProtein != null &&
    data != null &&
    data.proteinRefKg != null &&
    !isBlocked;

  async function invalidateMacroQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
      queryClient.invalidateQueries({ queryKey: ['calorie-goal-for-date', userId] }),
      queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] }),
    ]);
  }

  async function handleSave() {
    if (!canSave || parsedProtein == null) {
      return;
    }

    setIsSaving(true);
    setInlineError(null);
    try {
      await saveCustomProteinGoal({ userId, proteinG: Math.round(parsedProtein) });
      await invalidateMacroQueries();
      if (onSaved) {
        onSaved();
      } else {
        await refetch();
      }
    } catch (error) {
      logCalorieGoalSaveError('macro-goal-editor', error);
      setInlineError(
        getCalorieGoalErrorMessage(error, t('settings.macroGoal.saveFailed')),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (isSaving || isResetting) {
      return;
    }

    setIsResetting(true);
    setInlineError(null);
    try {
      await resetMacroGoalToCalculated(userId);
      await invalidateMacroQueries();
      await refetch();
    } catch (error) {
      logCalorieGoalSaveError('macro-goal-editor-reset', error);
      setInlineError(
        getCalorieGoalErrorMessage(error, t('settings.macroGoal.saveFailed')),
      );
    } finally {
      setIsResetting(false);
    }
  }

  if (isLoading) {
    return (
      <View className="items-center justify-center px-4 py-6">
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="px-4 py-4">
        <Text className="text-sm text-gray-500">{t('settings.errors.loadFailed')}</Text>
      </View>
    );
  }

  if (data == null) {
    return (
      <View className="px-4 py-4">
        <Text className="text-sm text-gray-500">{t('settings.macroGoal.needsCalorieGoal')}</Text>
      </View>
    );
  }

  const recommendedLabel =
    data.recommendedProteinG != null
      ? t('settings.macroGoal.recommended', { value: Math.round(data.recommendedProteinG) })
      : null;

  return (
    <View className="px-4 py-4">
      <Text className="mb-2 text-sm font-medium" style={{ color: TEXT_SECONDARY }}>
        {t('home.nutrients.protein')} ({t('home.nutrients.unitGrams')})
      </Text>
      <TextInput
        keyboardType="numbers-and-punctuation"
        {...NUMERIC_DONE_INPUT_PROPS}
        selectTextOnFocus
        value={proteinDraft}
        onChangeText={(text) => {
          if (!isPartialNumericInput(text, true)) {
            return;
          }
          setInlineError(null);
          setProteinDraft(text);
        }}
        placeholder={
          data.recommendedProteinG != null ? String(Math.round(data.recommendedProteinG)) : ''
        }
        placeholderTextColor="#9CA3AF"
        className="h-11 w-full self-stretch rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900"
      />
      {recommendedLabel ? (
        <Text className="mt-2 text-sm" style={{ color: TEXT_SECONDARY }}>
          {recommendedLabel}
        </Text>
      ) : null}
      {validation?.status === 'blocked' ? (
        <Text className="mt-2 text-sm text-red-600">
          {validation.reason === 'above_max'
            ? t('settings.macroGoal.blockedAboveMax')
            : t('settings.macroGoal.blockedNonPositive')}
        </Text>
      ) : null}
      {validation?.status === 'warning' ? (
        <Text className="mt-2 text-sm text-amber-700">{t('settings.macroGoal.softWarning')}</Text>
      ) : null}
      {inlineError ? (
        <Text className="mt-2 text-sm text-red-600">{inlineError}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={() => void handleSave()}
        className={`mt-4 h-11 items-center justify-center rounded-xl ${
          canSave ? 'bg-[#4F46E5]' : 'bg-indigo-300'
        }`}>
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-base font-semibold text-white">{t('settings.common.save')}</Text>
        )}
      </Pressable>

      {data.macroGoalSource === 'custom' ? (
        <Pressable
          accessibilityRole="button"
          disabled={isSaving || isResetting}
          onPress={() => void handleReset()}
          className="mt-3 items-center py-2">
          {isResetting ? (
            <ActivityIndicator color="#4F46E5" />
          ) : (
            <Text className="text-sm font-medium text-indigo-600">
              {t('settings.macroGoal.resetToRecommended')}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
