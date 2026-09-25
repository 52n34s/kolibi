import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { exerciseStubFromActive } from '@/components/training/exercise-stub';
import { RestTimerBar } from '@/components/training/RestTimerBar';
import { TrainingOverviewSheet } from '@/components/training/TrainingOverviewSheet';
import { TrainingSetInput } from '@/components/training/TrainingSetInput';
import {
  countDoneSets,
  sessionElapsedLabel,
} from '@/components/training/training-panel-utils';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY, TEXT_TERTIARY } from '@/constants/brand';
import { useSchemaCapability } from '@/hooks/use-schema-capability';
import { useTimerTick } from '@/hooks/use-timer-tick';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import { displayActiveExerciseName } from '@/lib/workouts/exercise-name';
import { hasDoneSet } from '@/lib/workouts/session-logic';
import { useWorkoutSyncStatus } from '@/lib/workouts/sync-queue-runtime';
import type { ActiveSession, Exercise } from '@/lib/workouts/types';
import { useRestTimerStore } from '@/stores/rest-timer-store';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

type TrainingActiveViewProps = {
  session: ActiveSession;
};

function syncIcon(status: 'synced' | 'pending' | 'offline') {
  if (status === 'offline') {
    return 'cloud-offline-outline' as const;
  }
  if (status === 'pending') {
    return 'cloud-upload-outline' as const;
  }
  return 'cloud-done-outline' as const;
}

export function TrainingActiveView({ session }: TrainingActiveViewProps) {
  const { t, i18n } = useTranslation();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [pendingDeleteSetId, setPendingDeleteSetId] = useState<string | null>(null);

  const adjustCurrent = useWorkoutSessionStore((s) => s.adjustCurrent);
  const setCurrent = useWorkoutSessionStore((s) => s.setCurrent);
  const setCurrentSides = useWorkoutSessionStore((s) => s.setCurrentSides);
  const setCurrentRir = useWorkoutSessionStore((s) => s.setCurrentRir);
  // Hidden until the rir migration ran — there is nowhere to save it before.
  const rirAvailable = useSchemaCapability('sessionSetsRir');
  const completeCurrentSet = useWorkoutSessionStore((s) => s.completeCurrentSet);
  const editDoneSet = useWorkoutSessionStore((s) => s.editDoneSet);
  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const removeLastSet = useWorkoutSessionStore((s) => s.removeLastSet);
  const removeOpenTrailingSet = useWorkoutSessionStore((s) => s.removeOpenTrailingSet);
  const skipExercise = useWorkoutSessionStore((s) => s.skipExercise);
  const moveExercise = useWorkoutSessionStore((s) => s.moveExercise);
  const jumpTo = useWorkoutSessionStore((s) => s.jumpTo);
  const addExerciseToSession = useWorkoutSessionStore((s) => s.addExerciseToSession);
  const enterSummary = useWorkoutSessionStore((s) => s.enterSummary);
  const discardSession = useWorkoutSessionStore((s) => s.discardSession);

  const startRest = useRestTimerStore((s) => s.start);
  const syncStatus = useWorkoutSyncStatus();
  const now = useTimerTick(true);

  const { exerciseIndex, setIndex } = session.cursor;
  const item = session.items[exerciseIndex];
  const currentSet = item?.sets[setIndex];
  const progress = countDoneSets(session);
  const progressRatio = progress.total > 0 ? progress.done / progress.total : 0;
  const isEditingDone = Boolean(currentSet?.done);

  useEffect(() => {
    setPendingDeleteSetId(null);
  }, [exerciseIndex]);

  function handleAdjust(delta: number) {
    if (!item || !currentSet) {
      return;
    }
    if (isEditingDone) {
      const next = Math.max(0, currentSet.value + delta);
      editDoneSet(exerciseIndex, setIndex, next, currentSet.secondsOtherSide);
      return;
    }
    adjustCurrent(delta);
  }

  function handleSetValue(value: number) {
    if (!item || !currentSet) {
      return;
    }
    if (isEditingDone) {
      editDoneSet(exerciseIndex, setIndex, value, currentSet.secondsOtherSide);
      return;
    }
    setCurrent(value);
  }

  function handleSetSides(seconds: number, other: number) {
    if (isEditingDone) {
      editDoneSet(exerciseIndex, setIndex, Math.min(seconds, other), other);
      return;
    }
    setCurrentSides(seconds, other);
  }

  function handleDone() {
    if (isEditingDone) {
      const nextOpen = findNextOpen(session, exerciseIndex, setIndex);
      if (nextOpen) {
        jumpTo(nextOpen.exerciseIndex, nextOpen.setIndex);
      }
      return;
    }
    const result = completeCurrentSet();
    if (!result) {
      return;
    }
    if (!result.isLastSet) {
      const rest =
        result.restSeconds ?? useRestTimerStore.getState().getLastDurationSec();
      void startRest(rest);
    }
  }

  function handleFinishPress() {
    if (!hasDoneSet(session)) {
      // Without a set there is nothing to save (hasDoneSet).
      Alert.alert(t('training.panel.finishTitle'), t('training.panel.finishEmptyBody'), [
        {
          text: t('training.panel.finishDiscard'),
          style: 'destructive',
          onPress: () => discardSession(),
        },
        {
          text: t('training.panel.finishContinue'),
          style: 'cancel',
        },
      ]);
      return;
    }
    Alert.alert(t('training.panel.finishTitle'), undefined, [
      {
        text: t('training.panel.finishSave'),
        onPress: () => enterSummary(),
      },
      {
        text: t('training.panel.finishDiscard'),
        style: 'destructive',
        onPress: () => discardSession(),
      },
      {
        text: t('training.panel.finishContinue'),
        style: 'cancel',
      },
    ]);
  }

  if (!item || !currentSet) {
    return null;
  }

  const targetLabel = formatExerciseTarget({
    sets: item.targetSets,
    kind: item.kind,
    reps: item.targetReps,
    repsMax: item.targetRepsMax,
    seconds: item.targetSeconds,
    secondsMax: item.targetSecondsMax,
    perSide: item.perSide,
    perSideLabel: item.perSide ? t('training.timer.perSide') : null,
  });

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.sessionName}>{session.templateName}</Text>
            <Text style={styles.progressLabel}>
              {t('training.panel.exerciseProgress', {
                current: exerciseIndex + 1,
                total: session.items.length,
                set: setIndex + 1,
                sets: item.sets.length,
              })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Ionicons
              name={syncIcon(syncStatus)}
              size={18}
              color={TEXT_SECONDARY}
              accessibilityLabel={t(`training.panel.sync.${syncStatus}`)}
            />
            <Text style={styles.elapsed}>{sessionElapsedLabel(session.startedAt, now)}</Text>
            <View style={styles.headerLinks}>
              <Pressable
                testID="training.overview.open"
                accessibilityRole="button"
                onPress={() => setOverviewOpen(true)}
                hitSlop={8}>
                <Text style={styles.headerLink}>{t('training.panel.overview')}</Text>
              </Pressable>
              <Pressable
                testID="training.active.finish"
                accessibilityRole="button"
                onPress={handleFinishPress}
                hitSlop={8}>
                <Text style={styles.finishLink}>{t('training.panel.finish')}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { flex: Math.max(0.001, progressRatio) }]} />
          <View style={{ flex: Math.max(0.001, 1 - progressRatio) }} />
        </View>

        <GlassCard style={styles.exerciseCard}>
          <View style={styles.exerciseTop}>
            <ExerciseThumb exercise={exerciseStubFromActive(item)} size="lg" />
            <View style={styles.exerciseMeta}>
              <Text style={styles.exerciseName}>
                {displayActiveExerciseName(item, i18n.language)}
              </Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              <Text style={styles.target}>{targetLabel}</Text>
            </View>
          </View>

          <View style={styles.setList}>
            {item.sets.map((set, index) => {
              const isCurrent = index === setIndex;
              const pendingDelete = pendingDeleteSetId === set.id;
              const canRequestDelete =
                !set.done && index === item.sets.length - 1 && item.sets.length > 1;
              const label =
                item.perSide && item.kind === 'time' && set.secondsOtherSide != null
                  ? `${set.value} / ${set.secondsOtherSide} s`
                  : item.kind === 'time'
                    ? set.done
                      ? `${set.value} s`
                      : '—'
                    : set.done
                      ? String(set.value)
                      : '—';

              return (
                <Pressable
                  key={set.id}
                  testID={`training.set.${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    if (pendingDelete) {
                      removeOpenTrailingSet(exerciseIndex, index);
                      setPendingDeleteSetId(null);
                      return;
                    }
                    setPendingDeleteSetId(null);
                    jumpTo(exerciseIndex, index);
                  }}
                  onLongPress={() => {
                    if (!canRequestDelete) {
                      return;
                    }
                    setPendingDeleteSetId(set.id);
                  }}
                  delayLongPress={400}
                  style={[
                    styles.setChip,
                    set.done && styles.setDone,
                    isCurrent && !pendingDelete && styles.setCurrent,
                    !set.done && !isCurrent && !pendingDelete && styles.setUpcoming,
                    pendingDelete && styles.setPendingDelete,
                  ]}>
                  <Text
                    style={[
                      styles.setChipText,
                      !set.done && !isCurrent && !pendingDelete && styles.setUpcomingText,
                      isCurrent && !pendingDelete && styles.setCurrentText,
                      pendingDelete && styles.setPendingDeleteText,
                    ]}>
                    {pendingDelete
                      ? t('training.panel.removeSetConfirm')
                      : `${index + 1}: ${label}`}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              testID="training.set.add"
              accessibilityRole="button"
              accessibilityLabel={t('training.panel.addSet')}
              onPress={() => {
                setPendingDeleteSetId(null);
                addSet(exerciseIndex);
              }}
              style={[styles.setChip, styles.setAddChip]}>
              <Text style={[styles.setChipText, styles.setAddChipText]}>+</Text>
            </Pressable>
          </View>
        </GlassCard>

        <TrainingSetInput
          item={item}
          set={currentSet}
          isEditingDone={isEditingDone}
          onAdjust={handleAdjust}
          onSetValue={handleSetValue}
          onSetSides={handleSetSides}
          onDone={handleDone}
          showRir={rirAvailable}
          onSetRir={setCurrentRir}
        />

      </ScrollView>

      <RestTimerBar />

      <TrainingOverviewSheet
        session={session}
        visible={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        onJump={(ei, si) => jumpTo(ei, si)}
        onSkip={(ei) => skipExercise(ei)}
        onMoveUp={(ei) => moveExercise(ei, ei - 1)}
        onMoveDown={(ei) => moveExercise(ei, ei + 1)}
        onAddSet={(ei) => addSet(ei)}
        onRemoveSet={(ei) => removeLastSet(ei)}
        onAddExercise={(exercise: Exercise) => addExerciseToSession(exercise)}
      />
    </View>
  );
}

function findNextOpen(
  session: ActiveSession,
  fromEi: number,
  fromSi: number,
): { exerciseIndex: number; setIndex: number } | null {
  for (let ei = fromEi; ei < session.items.length; ei += 1) {
    const sets = session.items[ei]!.sets;
    const startSi = ei === fromEi ? fromSi + 1 : 0;
    for (let si = startSi; si < sets.length; si += 1) {
      if (!sets[si]!.done) {
        return { exerciseIndex: ei, setIndex: si };
      }
    }
  }
  for (let ei = 0; ei <= fromEi; ei += 1) {
    const sets = session.items[ei]!.sets;
    const endSi = ei === fromEi ? fromSi : sets.length;
    for (let si = 0; si < endSi; si += 1) {
      if (!sets[si]!.done) {
        return { exerciseIndex: ei, setIndex: si };
      }
    }
  }
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 24,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  sessionName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  progressLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerLink: {
    color: TEXT_SECONDARY,
    fontWeight: '700',
    fontSize: 14,
  },
  elapsed: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
  },
  finishLink: {
    color: BRAND_INDIGO,
    fontWeight: '700',
    fontSize: 14,
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  progressFill: {
    backgroundColor: BRAND_INDIGO,
    borderRadius: 999,
  },
  exerciseCard: {
    padding: 16,
    gap: 14,
  },
  exerciseTop: {
    flexDirection: 'row',
    gap: 14,
  },
  exerciseMeta: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  note: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  target: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  setList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  setDone: {
    backgroundColor: 'rgba(124, 231, 199, 0.28)',
  },
  setCurrent: {
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
    borderWidth: 1,
    borderColor: BRAND_INDIGO,
  },
  setUpcoming: {
    opacity: 0.45,
  },
  setChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E1B4B',
    fontVariant: ['tabular-nums'],
  },
  setUpcomingText: {
    color: TEXT_TERTIARY,
  },
  setCurrentText: {
    color: BRAND_INDIGO,
  },
  setPendingDelete: {
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
    borderWidth: 1,
    borderColor: '#DC2626',
    opacity: 1,
  },
  setPendingDeleteText: {
    color: '#DC2626',
  },
  setAddChip: {
    minWidth: 40,
    alignItems: 'center',
  },
  setAddChipText: {
    color: BRAND_INDIGO,
    fontSize: 18,
    fontWeight: '700',
  },
});
