import * as Sentry from '@sentry/react-native';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProgressionSuggestionCard } from '@/components/training/ProgressionSuggestionCard';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { applyProgression } from '@/lib/workouts/apply-progression';
import { suggestProgression, type ProgressionSuggestion } from '@/lib/workouts/progression';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import type { Exercise, ProgressionEvent, WorkoutTemplate } from '@/lib/workouts/types';
import {
  fetchExerciseHistoryUnits,
  fetchLadder,
  fetchProgressionEvents,
  insertProgressionEvent,
  saveTemplate,
  type SaveTemplateExerciseInput,
} from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';

export type IdleProgressionRow = {
  teId: string;
  exercise: Exercise;
  suggestion: ProgressionSuggestion;
  toName: string | null;
  index: number;
};

export function useDeferredProgressions(template: WorkoutTemplate | null | undefined) {
  const userId = useAuthStore((s) => s.session?.user?.id);
  const { i18n } = useTranslation();
  const exercises = template?.exercises ?? [];

  const eventsQuery = useQueries({
    queries: [
      {
        queryKey:
          userId && template
            ? [...workoutQueryKeys.progressionEvents(userId), template.id, 'idle']
            : ['workout-progression-events-idle'],
        enabled: Boolean(userId && template),
        staleTime: 60 * 1000,
        queryFn: () => fetchProgressionEvents({ templateId: template!.id }),
      },
    ],
  });

  const historyQueries = useQueries({
    queries: exercises.map((te) => ({
      queryKey:
        userId != null
          ? [...workoutQueryKeys.exerciseHistory(userId, te.exerciseId), 'units', 'idle']
          : ['idle-history', te.exerciseId],
      enabled: Boolean(userId && template),
      staleTime: 5 * 60 * 1000,
      queryFn: () => fetchExerciseHistoryUnits(te.exerciseId, 20),
    })),
  });

  const ladderKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const te of exercises) {
      if (te.exercise.ladderKey) {
        keys.add(te.exercise.ladderKey);
      }
    }
    return [...keys];
  }, [exercises]);

  const ladderQueries = useQueries({
    queries: ladderKeys.map((key) => ({
      queryKey: workoutQueryKeys.ladder(key),
      enabled: Boolean(key),
      staleTime: 30 * 60 * 1000,
      queryFn: () => fetchLadder(key),
    })),
  });

  const laddersByKey = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    ladderKeys.forEach((key, index) => {
      map.set(key, ladderQueries[index]?.data ?? []);
    });
    return map;
  }, [ladderKeys, ladderQueries]);

  const allEvents = (eventsQuery[0]?.data ?? []) as ProgressionEvent[];
  const templateExerciseIds = exercises.map((te) => te.exerciseId);

  const rows = useMemo((): IdleProgressionRow[] => {
    if (!template) {
      return [];
    }
    const out: IdleProgressionRow[] = [];
    exercises.forEach((te, index) => {
      const exercise = te.exercise;
      if (exercise.progressionKind === 'none') {
        return;
      }
      const lastForExercise = allEvents.filter(
        (ev) => ev.fromExerciseId === te.exerciseId || ev.toExerciseId === te.exerciseId,
      );
      const last = lastForExercise[0];
      if (last == null || last.status !== 'declined') {
        return;
      }
      const ladder =
        exercise.ladderKey != null ? (laddersByKey.get(exercise.ladderKey) ?? []) : [];
      const history = historyQueries[index]?.data ?? [];
      const suggestion = suggestProgression({
        exercise,
        ladder,
        currentTarget: {
          targetSets: te.targetSets,
          targetReps: te.targetReps,
          targetRepsMax: te.targetRepsMax,
          targetSeconds: te.targetSeconds,
          targetSecondsMax: te.targetSecondsMax,
        },
        history,
        templateExerciseIds,
        lastEvents: lastForExercise,
      });
      if (!suggestion || suggestion.kind !== last.kind) {
        return;
      }
      let toName: string | null = null;
      if (suggestion.toExerciseId) {
        const toEx = ladder.find((ex) => ex.id === suggestion.toExerciseId);
        toName = toEx ? resolveExerciseName(toEx, i18n.language) : null;
      }
      out.push({
        teId: te.id,
        exercise,
        suggestion,
        toName,
        index,
      });
    });
    return out;
  }, [
    template,
    exercises,
    allEvents,
    laddersByKey,
    historyQueries,
    templateExerciseIds,
    i18n.language,
  ]);

  return rows;
}

type IdleProgressionOverlayProps = {
  template: WorkoutTemplate;
  rows: IdleProgressionRow[];
  onClose: () => void;
};

export function IdleProgressionOverlay({
  template,
  rows,
  onClose,
}: IdleProgressionOverlayProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [decisions, setDecisions] = useState<Record<number, 'accept' | 'later'>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let exercises: SaveTemplateExerciseInput[] = template.exercises
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((te) => ({
          exerciseId: te.exerciseId,
          targetSets: te.targetSets,
          targetReps: te.targetReps,
          targetRepsMax: te.targetRepsMax,
          targetSeconds: te.targetSeconds,
          targetSecondsMax: te.targetSecondsMax,
          targetWeightKg: te.targetWeightKg,
          restSeconds: te.restSeconds,
        }));

      let changed = false;
      for (const row of rows) {
        const decision = decisions[row.index];
        if (decision !== 'accept' && decision !== 'later') {
          continue;
        }
        if (decision === 'accept') {
          exercises = applyProgression(exercises, row.suggestion);
          changed = true;
        }
        await insertProgressionEvent({
          templateId: template.id,
          sessionId: null,
          kind: row.suggestion.kind,
          fromExerciseId: row.suggestion.exerciseId,
          toExerciseId: row.suggestion.toExerciseId,
          fromTarget: row.suggestion.fromTarget,
          toTarget: row.suggestion.toTarget,
          status: decision === 'accept' ? 'accepted' : 'declined',
        });
      }

      if (changed) {
        await saveTemplate({
          id: template.id,
          name: template.name,
          shortLabel: template.shortLabel,
          colorKey: template.colorKey,
          weekdays: template.weekdays,
          position: template.position,
          exercises,
        });
      }

      if (userId) {
        await queryClient.invalidateQueries({
          queryKey: workoutQueryKeys.templates(userId),
        });
        await queryClient.invalidateQueries({
          queryKey: workoutQueryKeys.progressionEvents(userId),
        });
      }
      onClose();
    } catch (err) {
      Sentry.captureException(err);
      setError(t('training.progression.applyError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('training.progression.readyTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>{t('training.panel.overviewClose')}</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {rows.map((row) => (
            <ProgressionSuggestionCard
              key={row.teId}
              exerciseIndex={row.index}
              name={resolveExerciseName(row.exercise, i18n.language)}
              toName={row.toName}
              exercise={row.exercise}
              suggestion={row.suggestion}
              decision={decisions[row.index] ?? null}
              onAccept={() =>
                setDecisions((prev) => ({ ...prev, [row.index]: 'accept' }))
              }
              onLater={() => setDecisions((prev) => ({ ...prev, [row.index]: 'later' }))}
            />
          ))}
        </ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void handleSave()}
          style={[styles.save, saving && styles.saveDisabled]}>
          <Text style={styles.saveText}>{t('training.progression.saveChoices')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 27, 75, 0.35)',
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  close: {
    color: BRAND_INDIGO,
    fontWeight: '600',
  },
  list: {
    flexGrow: 0,
  },
  error: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  save: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
