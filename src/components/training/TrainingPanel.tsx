import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { TrainingActiveView } from '@/components/training/TrainingActiveView';
import { TrainingIdleView } from '@/components/training/TrainingIdleView';
import { TrainingSummaryView } from '@/components/training/TrainingSummaryView';
import { useTrainingKeepAwake } from '@/hooks/use-training-keep-awake';
import { flushWorkoutSyncQueue } from '@/lib/workouts/sync-queue-runtime';
import type { WorkoutTemplate } from '@/lib/workouts/types';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

type TrainingPanelProps = {
  onEditPlan?: () => void;
};

export function TrainingPanel({ onEditPlan }: TrainingPanelProps) {
  const { i18n } = useTranslation();
  const active = useWorkoutSessionStore((s) => s.active);
  const startSession = useWorkoutSessionStore((s) => s.startSession);

  const sessionActive = active?.phase === 'active';
  useTrainingKeepAwake(Boolean(sessionActive));

  useEffect(() => {
    void flushWorkoutSyncQueue().catch(() => {
      // offline / network — status reflected via sync store
    });
  }, []);

  function handleStart(template: WorkoutTemplate) {
    startSession(template, { lang: i18n.language });
  }

  return (
    <View style={styles.root}>
      {!active ? (
        <TrainingIdleView onStart={handleStart} onEditPlan={onEditPlan} />
      ) : null}
      {active?.phase === 'active' ? <TrainingActiveView session={active} /> : null}
      {active?.phase === 'summary' ? <TrainingSummaryView session={active} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
