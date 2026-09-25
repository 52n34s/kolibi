import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { TrainingActiveView } from '@/components/training/TrainingActiveView';
import { TrainingIdleView } from '@/components/training/TrainingIdleView';
import { TrainingSummaryView } from '@/components/training/TrainingSummaryView';
import { BRAND_INDIGO } from '@/constants/brand';
import { deloadUntilLabel, useDeloadWeek } from '@/hooks/use-deload';
import { localDateKey } from '@/lib/day-window';
import { templateForStart } from '@/lib/workouts/deload';
import { useLastSetsByExercise } from '@/hooks/use-last-sets-by-exercise';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { DELOAD_TEXT_KEYS } from '@/lib/workouts/deload';
import { flushWorkoutSyncQueue } from '@/lib/workouts/sync-queue-runtime';
import type { ActiveSession, WorkoutTemplate } from '@/lib/workouts/types';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

type TrainingPanelProps = {
  onEditPlan?: () => void;
};

export function TrainingPanel({ onEditPlan }: TrainingPanelProps) {
  const { t, i18n } = useTranslation();
  const deload = useDeloadWeek();
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
        startSession(templateForStart(template, deload.deloadUntil, localDateKey()), {
          lang: i18n.language,
          lastSetsByExercise,
        });
      }
    });
  }

  const summarySession =
    active?.phase === 'summary' ? active : retainedSummary != null && active == null
      ? retainedSummary
      : null;

  return (
    <View style={styles.root}>
      {deload.isActive && deload.deloadUntil ? (
        <View testID="training.deload.banner" style={styles.deloadBanner}>
          <Text style={styles.deloadBannerText}>
            {t(DELOAD_TEXT_KEYS.banner, {
              date: deloadUntilLabel(deload.deloadUntil, i18n.language),
            })}
          </Text>
        </View>
      ) : null}
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
  deloadBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.10)',
  },
  deloadBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_INDIGO,
    textAlign: 'center',
  },
});
