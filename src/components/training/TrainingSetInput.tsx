import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { HoldTimer } from '@/components/training/HoldTimer';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import {
  holdResetNeedsConfirm,
  initialHoldPhase,
  isHoldReady,
  pauseHold,
  readyValues,
  resetHold,
  resumeHold,
  startHold,
  stopHold,
  switchSide,
} from '@/lib/workouts/hold-phase';
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
  /** Show "Wie viele wären noch gegangen?" (open rep sets, rir column present). */
  showRir?: boolean;
  onSetRir?: (rir: number | null) => void;
  /** "Für die nächste Stufe: …" under the input; null hides it. */
  nextLevelHint?: string | null;
};

/** 3 stands for "3 or more". */
const RIR_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3+' },
] as const;

export function TrainingSetInput({
  item,
  set,
  onAdjust,
  onSetValue,
  onSetSides,
  onDone,
  isEditingDone,
  showRir = false,
  onSetRir,
  nextLevelHint = null,
}: TrainingSetInputProps) {
  const { t } = useTranslation();
  const keyboardHeight = useKeyboardHeight();
  const [directEdit, setDirectEdit] = useState(false);
  const [showRirInfo, setShowRirInfo] = useState(false);
  const [draft, setDraft] = useState(String(set.value));
  const [holdPhase, setHoldPhase] = useState(() =>
    initialHoldPhase({
      done: set.done,
      isEditingDone,
      value: set.value,
      secondsOtherSide: set.secondsOtherSide,
    }),
  );

  // Reset on a NEW set only. Deriving this from set.value would undo the
  // hold result the moment it is written (see hold-phase.ts).
  const [phaseSetId, setPhaseSetId] = useState(set.id);
  if (phaseSetId !== set.id) {
    setPhaseSetId(set.id);
    setDirectEdit(false);
    setDraft(String(set.value));
    setHoldPhase(
      initialHoldPhase({
        done: set.done,
        isEditingDone,
        value: set.value,
        secondsOtherSide: set.secondsOtherSide,
      }),
    );
  }

  const step = item.kind === 'time' ? 5 : 1;

  function commitDraft() {
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetValue(Math.round(parsed));
    }
    setDirectEdit(false);
  }

  function handleHoldStop() {
    const next = stopHold(holdPhase, Date.now(), item.perSide);
    setHoldPhase(next);

    const values = readyValues(next);
    if (!values) {
      return;
    }
    if (values.secondsOtherSide != null) {
      onSetSides(values.seconds, values.secondsOtherSide);
    } else {
      onSetValue(values.seconds);
    }
  }

  function applyHoldReset() {
    setHoldPhase(resetHold(holdPhase));
  }

  function handleHoldReset() {
    if (holdResetNeedsConfirm(holdPhase, Date.now())) {
      Alert.alert(t('training.timer.holdResetConfirmTitle'), t('training.timer.holdResetConfirm'), [
        { text: t('settings.common.cancel'), style: 'cancel' },
        {
          text: t('training.timer.holdReset'),
          style: 'destructive',
          onPress: applyHoldReset,
        },
      ]);
      return;
    }
    applyHoldReset();
  }

  const showHold = item.kind === 'time' && !isEditingDone && !isHoldReady(holdPhase);

  return (
    <View style={[styles.wrap, keyboardHeight > 0 && { paddingBottom: Math.max(0, keyboardHeight - 24) }]}>
      {showHold ? (
        <HoldTimer
          phase={holdPhase}
          targetSeconds={item.targetSeconds}
          targetSecondsMax={item.targetSecondsMax}
          perSide={item.perSide}
          onStart={() => setHoldPhase(startHold(holdPhase, Date.now()))}
          onPause={() => setHoldPhase(pauseHold(holdPhase, Date.now()))}
          onResume={() => setHoldPhase(resumeHold(holdPhase, Date.now()))}
          onStop={handleHoldStop}
          onReset={handleHoldReset}
          onSwitchSide={() => setHoldPhase(switchSide(holdPhase, Date.now()))}
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

      {nextLevelHint ? (
        <Text testID="training.input.nextLevel" style={styles.nextLevel}>
          {nextLevelHint}
        </Text>
      ) : null}

      {!showHold && showRir && !isEditingDone && item.kind !== 'time' && onSetRir ? (
        <View style={styles.rir} testID="training.input.rir">
          <View style={styles.rirQuestionRow}>
            <Text style={styles.rirQuestion}>{t('rir.question')}</Text>
            <Pressable
              testID="training.input.rir.info"
              accessibilityRole="button"
              accessibilityLabel={t('rir.infoA11y')}
              hitSlop={10}
              onPress={() => setShowRirInfo(true)}>
              <Ionicons name="information-circle-outline" size={18} color={TEXT_SECONDARY} />
            </Pressable>
          </View>
          <View style={styles.rirRow}>
            {RIR_OPTIONS.map((option) => {
              const selected = set.rir === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`training.input.rir.${option.value}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('rir.question')} ${option.label}`}
                  accessibilityState={{ selected }}
                  hitSlop={6}
                  // Tapping the picked value again clears it: the row stays optional.
                  onPress={() => onSetRir(selected ? null : option.value)}
                  style={[styles.rirChip, selected && styles.rirChipSelected]}>
                  <Text style={[styles.rirChipText, selected && styles.rirChipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <GlassBottomSheet
        visible={showRirInfo}
        onClose={() => setShowRirInfo(false)}
        presentation="center">
        <Text style={styles.rirInfoText}>{t('rir.info')}</Text>
        <Pressable
          testID="training.input.rir.infoClose"
          accessibilityRole="button"
          onPress={() => setShowRirInfo(false)}
          style={styles.rirInfoClose}>
          <Text style={styles.rirInfoCloseText}>{t('settings.common.ok')}</Text>
        </Pressable>
      </GlassBottomSheet>

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
  nextLevel: {
    marginTop: -4,
    paddingHorizontal: 16,
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  rir: {
    alignItems: 'center',
    gap: 8,
  },
  rirQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rirQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  rirInfoText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
  },
  rirInfoClose: {
    marginTop: 16,
    backgroundColor: BRAND_INDIGO,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rirInfoCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  rirRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rirChip: {
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  rirChipSelected: {
    backgroundColor: BRAND_INDIGO,
  },
  rirChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
  },
  rirChipTextSelected: {
    color: '#FFFFFF',
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
