import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HoldTimer } from '@/components/training/HoldTimer';
import { BRAND_INDIGO } from '@/constants/brand';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import type { ActiveExercise, ActiveSet } from '@/lib/workouts/types';

type TrainingSetInputProps = {
  item: ActiveExercise;
  set: ActiveSet;
  onAdjust: (delta: number) => void;
  onSetValue: (value: number) => void;
  onSetSides: (seconds: number, other: number) => void;
  onDone: () => void;
  /** When true, set is already completed — edits persist via parent editDoneSet path. */
  isEditingDone: boolean;
};

export function TrainingSetInput({
  item,
  set,
  onAdjust,
  onSetValue,
  onSetSides,
  onDone,
  isEditingDone,
}: TrainingSetInputProps) {
  const { t } = useTranslation();
  const keyboardHeight = useKeyboardHeight();
  const [directEdit, setDirectEdit] = useState(false);
  const [draft, setDraft] = useState(String(set.value));
  const [timeReady, setTimeReady] = useState(isEditingDone || set.done);

  useEffect(() => {
    setDirectEdit(false);
    setDraft(String(set.value));
    setTimeReady(isEditingDone || set.done);
  }, [set.id, isEditingDone, set.done, set.value]);

  const step = item.kind === 'time' ? 5 : 1;

  function commitDraft() {
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetValue(Math.round(parsed));
    }
    setDirectEdit(false);
  }

  function handleHoldStop(seconds: number, otherSide?: number) {
    if (otherSide != null) {
      onSetSides(seconds, otherSide);
    } else {
      onSetValue(seconds);
    }
    setTimeReady(true);
  }

  const showHold = item.kind === 'time' && !timeReady && !isEditingDone;

  return (
    <View style={[styles.wrap, keyboardHeight > 0 && { paddingBottom: Math.max(0, keyboardHeight - 24) }]}>
      {showHold ? (
        <HoldTimer
          targetSeconds={item.targetSeconds}
          targetSecondsMax={item.targetSecondsMax}
          perSide={item.perSide}
          onStop={handleHoldStop}
        />
      ) : (
        <View style={styles.stepper}>
          <Pressable
            testID="training.input.minus"
            accessibilityRole="button"
            onPress={() => onAdjust(-step)}
            style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>−{step === 5 ? 5 : 1}</Text>
          </Pressable>

          {directEdit ? (
            <TextInput
              testID="training.input.valueInput"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={commitDraft}
              onBlur={commitDraft}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              autoFocus
              style={styles.valueInput}
            />
          ) : (
            <Pressable
              testID="training.input.value"
              accessibilityRole="button"
              onPress={() => {
                setDraft(String(set.value));
                setDirectEdit(true);
              }}>
              <Text style={styles.value}>
                {item.perSide && item.kind === 'time' && set.secondsOtherSide != null
                  ? `${set.value} / ${set.secondsOtherSide} s`
                  : item.kind === 'time'
                    ? `${set.value} s`
                    : String(set.value)}
              </Text>
            </Pressable>
          )}

          <Pressable
            testID="training.input.plus"
            accessibilityRole="button"
            onPress={() => onAdjust(step)}
            style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>+{step === 5 ? 5 : 1}</Text>
          </Pressable>
        </View>
      )}

      {!showHold ? (
        <Pressable
          testID="training.input.done"
          accessibilityRole="button"
          onPress={onDone}
          style={styles.done}>
          <Text style={styles.doneText}>
            {isEditingDone ? t('training.panel.saveSet') : t('training.panel.setDone')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  stepBtn: {
    minWidth: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: BRAND_INDIGO,
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  value: {
    fontSize: 48,
    fontWeight: '600',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
    minWidth: 96,
    textAlign: 'center',
  },
  valueInput: {
    fontSize: 40,
    fontWeight: '600',
    color: BRAND_INDIGO,
    minWidth: 96,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: BRAND_INDIGO,
    paddingVertical: 4,
  },
  done: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: BRAND_INDIGO,
  },
  doneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
