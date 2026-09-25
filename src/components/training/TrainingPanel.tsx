import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { TrainingActiveView } from '@/components/training/TrainingActiveView';
import { TrainingIdleView } from '@/components/training/TrainingIdleView';
import { TrainingSummaryView } from '@/components/training/TrainingSummaryView';
import { useLastSetsByExercise } from '@/hooks/use-last-sets-by-exercise';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { flushWorkoutSyncQueue } from '@/lib/workouts/sync-queue-runtime';
import type { ActiveSession, WorkoutTemplate } from '@/lib/workouts/types';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

type TrainingPanelProps = {
  onEditPlan?: () => void;
};

export function TrainingPanel({ onEditPlan }: TrainingPanelProps) {
  const { i18n } = useTranslation();
  const active = useWorkoutSessionStore((s) => s.active);
  const startSession = useWorkoutSessionStore((s) => s.startSession);
  const [retainedSummary, setRetainedSummary] = useState<ActiveSession | null>(null);

  useEffect(() => {
    void flushWorkoutSyncQueue().catch(() => {
      // offline / network — status reflected via sync store
    });
  }, []);

  useEffect(() => {
    if (active?.phase === 'summary') {
      setRetainedSummary(active);
    }
    if (active?.phase === 'active') {
      setRetainedSummary(null);
    }
  }, [active]);

  const requirePlan = useRequirePlan();
  const lastSetsByExercise = useLastSetsByExercise();

  function handleStart(template: WorkoutTemplate) {
    void requirePlan('startSession').then((allowed) => {
      if (allowed) {
        startSession(template, { lang: i18n.language, lastSetsByExercise });
      }
    });
  }

  const summarySession =
    active?.phase === 'summary' ? active : retainedSummary != null && active == null
      ? retainedSummary
      : null;

  return (
    <View style={styles.root}>
      {!active && !summarySession ? (
        <TrainingIdleView onStart={handleStart} onEditPlan={onEditPlan} />
      ) : null}
      {active?.phase === 'active' ? <TrainingActiveView session={active} /> : null}
      {summarySession ? (
        <TrainingSummaryView
          session={summarySession}
          onDismiss={() => setRetainedSummary(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
