import { useEffect, useMemo, useRef, useState } from 'react';
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
  resolveNumericKeyboardType,
} from '@/lib/numeric-input';
import { requestHealthPermissions } from '@/lib/health';
import {
  distanceKmToDisplay,
  parseDistanceToKm,
  useUnitSystem,
} from '@/lib/measure-units';
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

/** Defaults are always stored as km (or step counts). */
const DEFAULT_VALUE_KM: Record<MovementGoalType, Record<MovementGoalPeriod, number>> = {
  steps: { day: 8000, week: 56000 },
  running_km: { day: 3, week: 20 },
  distance_km: { day: 6, week: 42 },
};

function defaultValueDraft(
  type: MovementGoalType,
  period: MovementGoalPeriod,
  unitSystem: 'metric' | 'imperial',
): string {
  const stored = DEFAULT_VALUE_KM[type][period];
  if (type === 'steps') {
    return String(stored);
  }
  return String(distanceKmToDisplay(stored, unitSystem));
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

function formatStoredValueForDraft(
  value: number | null,
  type: MovementGoalType | null,
  unitSystem: 'metric' | 'imperial',
): string {
  if (value == null) {
    return '';
  }
  if (type === 'steps') {
    return String(Math.round(value));
  }
  return String(distanceKmToDisplay(value, unitSystem));
}

type MovementGoalEditorBodyProps = {
  userId: string;
  /** Called after a successful save. */
  onSaved?: () => void;
  /** When true, omit bottom save (screen footer owns it). */
  hideActions?: boolean;
  onActionsChange?: (actions: MovementGoalEditorActions) => void;
};

export type MovementGoalEditorActions = {
  canSave: boolean;
  isSaving: boolean;
  save: () => void;
};

export function MovementGoalEditorBody({
  userId,
  onSaved,
  hideActions = false,
  onActionsChange,
}: MovementGoalEditorBodyProps) {
  const { t } = useTranslation();
  const unitSystem = useUnitSystem();
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
    setValueDraft(
      formatStoredValueForDraft(profile.movement_goal_value, storedType, unitSystem),
    );
    setValueIsCustom(profile.movement_goal_value != null);
  }, [
    data?.profile?.movement_goal_type,
    data?.profile?.movement_goal_value,
    data?.profile?.movement_goal_period,
    unitSystem,
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
      setValueDraft(defaultValueDraft(next, nextPeriod, unitSystem));
    }
  }

  function applyPeriodSelection(nextPeriod: MovementGoalPeriod) {
    setInlineError(null);
    setPeriod(nextPeriod);
    if (typeSelection !== 'none' && !valueIsCustom) {
      setValueDraft(defaultValueDraft(typeSelection, nextPeriod, unitSystem));
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
        const storedValue =
          typeSelection === 'steps'
            ? Math.round(parsedValue!)
            : parseDistanceToKm({ value: valueDraft, unitSystem });
        if (storedValue == null || !(storedValue > 0)) {
          setInlineError(t('settings.movementGoal.blockedNonPositive'));
          return;
        }
        await updateMovementGoal({
          userId,
          movementGoalType: typeSelection,
          movementGoalValue: storedValue,
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
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['movement-goal-actual'] });
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

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  useEffect(() => {
    if (!onActionsChange) {
      return;
    }

    onActionsChange({
      canSave,
      isSaving,
      save: () => {
        void saveRef.current();
      },
    });
  }, [canSave, isSaving, onActionsChange]);

  if (isLoading) {
    return (
      <View className="items-center justify-center py-6">
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  if (isError || data == null) {
    return (
      <View className="py-4">
        <Text className="text-sm" style={{ color: TEXT_SECONDARY }}>
          {t('settings.errors.loadFailed')}
        </Text>
      </View>
    );
  }

  const placeholder =
    typeSelection !== 'none'
      ? defaultValueDraft(typeSelection, period, unitSystem)
      : undefined;

  const valueLabel =
    typeSelection === 'steps'
      ? t('settings.movementGoal.valueLabelSteps')
      : unitSystem === 'imperial'
        ? t('settings.movementGoal.valueLabelMi')
        : t('settings.movementGoal.valueLabelKm');

  return (
    <View className={hideActions ? undefined : 'px-4 py-4'}>
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
          <Text className="mb-2 text-sm font-medium text-gray-700">{valueLabel}</Text>
          <TextInput
            keyboardType={resolveNumericKeyboardType(
              allowDecimals ? 'decimal-pad' : 'number-pad',
            )}
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

      {!hideActions ? (
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
      ) : null}
    </View>
  );
}
