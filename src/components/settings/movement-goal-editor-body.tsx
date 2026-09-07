import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import { TEXT_SECONDARY } from '@/constants/brand';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import {
  NUMERIC_DONE_INPUT_PROPS,
  isPartialNumericInput,
} from '@/lib/numeric-input';
import { requestHealthPermissions } from '@/lib/health';
import {
  type MovementGoalPeriod,
  type MovementGoalType,
  updateMovementGoal,
} from '@/lib/profile';
import {
  getUserPreference,
  HEALTH_CONNECTED_PREFERENCE_KEY,
} from '@/lib/user-preferences';

type TypeSelection = 'none' | MovementGoalType;

const DEFAULT_PERIOD: Record<MovementGoalType, MovementGoalPeriod> = {
  steps: 'day',
  running_km: 'week',
  distance_km: 'day',
};

const DEFAULT_VALUE: Record<MovementGoalType, Record<MovementGoalPeriod, string>> = {
  steps: { day: '8000', week: '56000' },
  running_km: { day: '3', week: '20' },
  distance_km: { day: '6', week: '42' },
};

function defaultValueDraft(type: MovementGoalType, period: MovementGoalPeriod): string {
  return DEFAULT_VALUE[type][period];
}

function parseGoalValue(value: string): number | null {
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

function formatStoredValue(value: number | null, type: MovementGoalType | null): string {
  if (value == null) {
    return '';
  }
  if (type === 'steps') {
    return String(Math.round(value));
  }
  return String(value);
}

type MovementGoalEditorBodyProps = {
  userId: string;
  /** Called after a successful save. Used by the sheet to dismiss. */
  onSaved?: () => void;
};

export function MovementGoalEditorBody({ userId, onSaved }: MovementGoalEditorBodyProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useProfileSettings(userId);

  const [typeSelection, setTypeSelection] = useState<TypeSelection>('none');
  const [period, setPeriod] = useState<MovementGoalPeriod>('day');
  const [valueDraft, setValueDraft] = useState('');
  /** True once the user has typed (or a stored goal was loaded). Defaults then stop overwriting. */
  const [valueIsCustom, setValueIsCustom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    const profile = data?.profile;
    if (!profile) {
      return;
    }

    const storedType = profile.movement_goal_type;
    if (storedType == null) {
      setTypeSelection('none');
      setPeriod('day');
      setValueDraft('');
      setValueIsCustom(false);
      return;
    }

    const storedPeriod = profile.movement_goal_period ?? DEFAULT_PERIOD[storedType];
    setTypeSelection(storedType);
    setPeriod(storedPeriod);
    setValueDraft(formatStoredValue(profile.movement_goal_value, storedType));
    setValueIsCustom(profile.movement_goal_value != null);
  }, [
    data?.profile?.movement_goal_type,
    data?.profile?.movement_goal_value,
    data?.profile?.movement_goal_period,
  ]);

  const parsedValue = useMemo(() => parseGoalValue(valueDraft), [valueDraft]);
  const allowDecimals = typeSelection !== 'steps';
  const valueInvalid =
    typeSelection !== 'none' && (parsedValue == null || !(parsedValue > 0));

  const canSave =
    !isSaving &&
    data != null &&
    (typeSelection === 'none' || (!valueInvalid && period != null));

  function applyTypeSelection(next: TypeSelection) {
    setInlineError(null);
    setTypeSelection(next);
    if (next === 'none') {
      setPeriod('day');
      setValueDraft('');
      setValueIsCustom(false);
      return;
    }

    const nextPeriod = DEFAULT_PERIOD[next];
    setPeriod(nextPeriod);
    if (!valueIsCustom) {
      setValueDraft(defaultValueDraft(next, nextPeriod));
    }
  }

  function applyPeriodSelection(nextPeriod: MovementGoalPeriod) {
    setInlineError(null);
    setPeriod(nextPeriod);
    if (typeSelection !== 'none' && !valueIsCustom) {
      setValueDraft(defaultValueDraft(typeSelection, nextPeriod));
    }
  }

  async function handleSave() {
    // Guard: do not run validation / network when the value is incomplete.
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setInlineError(null);
    try {
      if (typeSelection === 'none') {
        await updateMovementGoal({
          userId,
          movementGoalType: null,
          movementGoalValue: null,
          movementGoalPeriod: null,
        });
      } else {
        await updateMovementGoal({
          userId,
          movementGoalType: typeSelection,
          movementGoalValue:
            typeSelection === 'steps' ? Math.round(parsedValue!) : parsedValue!,
          movementGoalPeriod: period,
        });
      }

      // Existing Health connections never re-prompt for new read types on their own.
      void getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY).then((connected) => {
        if (connected) {
          return requestHealthPermissions();
        }
      });

      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      if (onSaved) {
        onSaved();
      } else {
        await refetch();
      }
    } catch {
      setInlineError(t('settings.movementGoal.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View className="items-center justify-center px-4 py-6">
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  if (isError || data == null) {
    return (
      <View className="px-4 py-4">
        <Text className="text-sm" style={{ color: TEXT_SECONDARY }}>
          {t('settings.errors.loadFailed')}
        </Text>
      </View>
    );
  }

  const placeholder =
    typeSelection !== 'none' ? defaultValueDraft(typeSelection, period) : undefined;

  return (
    <View className="px-4 py-4">
      <CompactSegmentToggle
        variant="language"
        value={typeSelection}
        style={{ marginBottom: 12, alignSelf: 'stretch' }}
        containerStyle={{ flexWrap: 'wrap', width: '100%' }}
        segments={[
          { id: 'none', label: t('settings.movementGoal.type.none') },
          { id: 'steps', label: t('settings.movementGoal.type.steps') },
          { id: 'running_km', label: t('settings.movementGoal.type.runningKm') },
          { id: 'distance_km', label: t('settings.movementGoal.type.distanceKm') },
        ]}
        onChange={(nextId) => applyTypeSelection(nextId as TypeSelection)}
      />

      {typeSelection !== 'none' ? (
        <>
          <Text className="mb-2 text-sm font-medium" style={{ color: TEXT_SECONDARY }}>
            {typeSelection === 'steps'
              ? t('settings.movementGoal.valueLabelSteps')
              : t('settings.movementGoal.valueLabelKm')}
          </Text>
          <TextInput
            keyboardType="numbers-and-punctuation"
            {...NUMERIC_DONE_INPUT_PROPS}
            value={valueDraft}
            onChangeText={(text) => {
              if (!isPartialNumericInput(text, allowDecimals)) {
                return;
              }
              setInlineError(null);
              setValueIsCustom(true);
              setValueDraft(text);
            }}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            className="h-11 w-full self-stretch rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900"
          />

          <View className="mt-3">
            <CompactSegmentToggle
              variant="language"
              compact
              value={period}
              style={{ marginBottom: 0 }}
              segments={[
                { id: 'day', label: t('settings.movementGoal.period.day') },
                { id: 'week', label: t('settings.movementGoal.period.week') },
              ]}
              onChange={(nextId) => applyPeriodSelection(nextId as MovementGoalPeriod)}
            />
          </View>

          {typeSelection === 'running_km' ? (
            <Text className="mt-3 text-sm" style={{ color: TEXT_SECONDARY }}>
              {t('settings.movementGoal.runningHint')}
            </Text>
          ) : null}

          {valueInvalid ? (
            <Text className="mt-2 text-sm text-red-600">
              {t('settings.movementGoal.blockedNonPositive')}
            </Text>
          ) : null}
        </>
      ) : null}

      {inlineError ? (
        <Text className="mt-2 text-sm text-red-600">{inlineError}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={() => {
          if (!canSave) {
            return;
          }
          void handleSave();
        }}
        className={`mt-4 h-11 items-center justify-center rounded-xl ${
          canSave ? 'bg-[#4F46E5]' : 'bg-indigo-300'
        }`}>
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-base font-semibold text-white">{t('settings.common.save')}</Text>
        )}
      </Pressable>
    </View>
  );
}
