import { useQueryClient, useQueries } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  doneSetValues,
  exerciseStats,
  istDiffersFromTarget,
  medianInt,
  sessionElapsedLabel,
} from '@/components/training/training-panel-utils';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY } from '@/constants/brand';
import { allSetsHitUpperBound } from '@/lib/workouts/format-target';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import type { ActiveSession, GymIntensity, SessionSet } from '@/lib/workouts/types';
import {
  saveTemplate,
  fetchExerciseHistory,
  type SaveTemplateExerciseInput,
} from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';

type TrainingSummaryViewProps = {
  session: ActiveSession;
};

function bestPriorValue(history: SessionSet[], kind: 'reps' | 'weighted' | 'time'): number | null {
  let best: number | null = null;
  for (const set of history) {
    const value = kind === 'time' ? set.seconds : set.reps;
    if (value == null || !Number.isFinite(value)) {
      continue;
    }
    if (best == null || value > best) {
      best = value;
    }
  }
  return best;
}

function bestSessionValue(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

export function TrainingSummaryView({ session }: TrainingSummaryViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const finishSession = useWorkoutSessionStore((s) => s.finishSession);
  const templatesQuery = useWorkoutTemplates();

  const [intensity, setIntensity] = useState<GymIntensity | null>(null);
  const [adopt, setAdopt] = useState<Record<number, boolean>>({});
  const [addToTemplate, setAddToTemplate] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = exerciseStats(session);
  const finishedAt = session.finishedAt ? Date.parse(session.finishedAt) : Date.now();
  const durationLabel = sessionElapsedLabel(session.startedAt, finishedAt);

  const exerciseIds = useMemo(
    () => session.items.map((item) => item.exerciseId).filter(Boolean),
    [session.items],
  );

  const historyQueries = useQueries({
    queries: exerciseIds.map((exerciseId) => ({
      queryKey:
        userId != null
          ? workoutQueryKeys.exerciseHistory(userId, exerciseId)
          : ['workout-exercise-history', exerciseId],
      enabled: Boolean(userId),
      staleTime: 5 * 60 * 1000,
      queryFn: () => fetchExerciseHistory(exerciseId, 40),
    })),
  });

  const prs = useMemo(() => {
    const rows: { name: string; value: string }[] = [];
    session.items.forEach((item, index) => {
      const values = doneSetValues(item);
      const sessionBest = bestSessionValue(values);
      if (sessionBest == null) {
        return;
      }
      const prior = bestPriorValue(historyQueries[index]?.data ?? [], item.kind);
      if (prior != null && sessionBest <= prior) {
        return;
      }
      rows.push({
        name: item.name,
        value: item.kind === 'time' ? `${sessionBest} s` : String(sessionBest),
      });
    });
    return rows;
  }, [historyQueries, session.items]);

  const adoptCandidates = useMemo(
    () =>
      session.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => istDiffersFromTarget(item)),
    [session.items],
  );

  const addedCandidates = useMemo(
    () =>
      session.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.addedInSession),
    [session.items],
  );

  async function persistTemplateChanges(): Promise<void> {
    const templateId = session.templateId;
    if (!templateId) {
      return;
    }
    const template = templatesQuery.data?.find((row) => row.id === templateId);
    if (!template) {
      return;
    }

    const hasAdopt = Object.values(adopt).some(Boolean);
    const hasAdd = Object.values(addToTemplate).some(Boolean);
    if (!hasAdopt && !hasAdd) {
      return;
    }

    const exercises: SaveTemplateExerciseInput[] = template.exercises
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((te) => {
        const sessionItem = session.items.find(
          (item) => item.exerciseId === te.exerciseId && !item.addedInSession,
        );
        const sessionIndex = session.items.findIndex(
          (item) => item === sessionItem,
        );
        const shouldAdopt = sessionIndex >= 0 && adopt[sessionIndex];
        if (!shouldAdopt || !sessionItem) {
          return {
            exerciseId: te.exerciseId,
            targetSets: te.targetSets,
            targetReps: te.targetReps,
            targetRepsMax: te.targetRepsMax,
            targetSeconds: te.targetSeconds,
            targetSecondsMax: te.targetSecondsMax,
            targetWeightKg: te.targetWeightKg,
            restSeconds: te.restSeconds,
          };
        }

        const median = medianInt(doneSetValues(sessionItem));
        if (median == null) {
          return {
            exerciseId: te.exerciseId,
            targetSets: te.targetSets,
            targetReps: te.targetReps,
            targetRepsMax: te.targetRepsMax,
            targetSeconds: te.targetSeconds,
            targetSecondsMax: te.targetSecondsMax,
            targetWeightKg: te.targetWeightKg,
            restSeconds: te.restSeconds,
          };
        }

        if (sessionItem.kind === 'time') {
          const max =
            te.targetSecondsMax != null && te.targetSecondsMax > median
              ? te.targetSecondsMax
              : te.targetSecondsMax;
          return {
            exerciseId: te.exerciseId,
            targetSets: sessionItem.sets.length,
            targetReps: null,
            targetRepsMax: null,
            targetSeconds: median,
            targetSecondsMax: max,
            targetWeightKg: te.targetWeightKg,
            restSeconds: te.restSeconds,
          };
        }

        const max =
          te.targetRepsMax != null && te.targetRepsMax > median
            ? te.targetRepsMax
            : te.targetRepsMax;
        return {
          exerciseId: te.exerciseId,
          targetSets: sessionItem.sets.length,
          targetReps: median,
          targetRepsMax: max,
          targetSeconds: null,
          targetSecondsMax: null,
          targetWeightKg: te.targetWeightKg,
          restSeconds: te.restSeconds,
        };
      });

    for (const { item, index } of addedCandidates) {
      if (!addToTemplate[index]) {
        continue;
      }
      exercises.push({
        exerciseId: item.exerciseId,
        targetSets: item.sets.length,
        targetReps: item.kind === 'time' ? null : (medianInt(doneSetValues(item)) ?? item.targetReps),
        targetRepsMax: item.targetRepsMax,
        targetSeconds:
          item.kind === 'time' ? (medianInt(doneSetValues(item)) ?? item.targetSeconds) : null,
        targetSecondsMax: item.targetSecondsMax,
        targetWeightKg: item.targetWeightKg,
        restSeconds: item.restSeconds,
      });
    }

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

  async function handleDone() {
    if (!intensity) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await persistTemplateChanges();
      const result = await finishSession(intensity, queryClient);
      if (!result.ok) {
        setError(t('training.panel.finishError'));
      }
    } catch {
      setError(t('training.panel.finishError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Image
        source={require('@/assets/images/koli-happy.png')}
        style={styles.koli}
        contentFit="contain"
      />

      <Text style={styles.title}>{session.templateName}</Text>

      <GlassCard style={styles.statsCard}>
        <Stat label={t('training.panel.duration')} value={durationLabel} />
        <Stat label={t('training.panel.sets')} value={String(stats.setsDone)} />
        <Stat label={t('training.panel.reps')} value={String(stats.repsTotal)} />
        <Stat label={t('training.panel.seconds')} value={String(stats.secondsTotal)} />
      </GlassCard>

      {prs.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('training.panel.prs')}</Text>
          {prs.map((pr) => (
            <Text key={`${pr.name}-${pr.value}`} style={styles.prLine}>
              {t('training.panel.prBeat', { name: pr.name, value: pr.value })}
            </Text>
          ))}
        </View>
      ) : null}

      {session.items.map((item) => {
        const values = doneSetValues(item);
        if (
          !allSetsHitUpperBound({
            kind: item.kind,
            targetRepsMax: item.targetRepsMax,
            targetSecondsMax: item.targetSecondsMax,
            setValues: values,
          })
        ) {
          return null;
        }
        return (
          <Text key={`upper-${item.exerciseId}`} style={styles.upperHint}>
            {item.name}: {t('training.panel.upperBoundHint')}
          </Text>
        );
      })}

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t('training.panel.intensityTitle')}</Text>
        {(['easy', 'normal', 'hard'] as const).map((key) => {
          const selected = intensity === key;
          return (
            <Pressable
              key={key}
              testID={`training.summary.intensity.${key}`}
              accessibilityRole="button"
              onPress={() => setIntensity(key)}
              style={[styles.intensityRow, selected && styles.intensitySelected]}>
              <Text style={styles.intensityLabel}>
                {t(`home.training.intensity.${key}.label`)}
              </Text>
              <Text style={styles.intensityHint}>
                {t(`home.training.intensity.${key}.hint`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {adoptCandidates.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('training.panel.adoptTitle')}</Text>
          {adoptCandidates.map(({ item, index }) => {
            const median = medianInt(doneSetValues(item));
            const checked = Boolean(adopt[index]);
            return (
              <Pressable
                key={`adopt-${index}`}
                testID={`training.summary.adopt.${index}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() => setAdopt((prev) => ({ ...prev, [index]: !prev[index] }))}
                style={styles.checkRow}>
                <View style={[styles.checkbox, checked && styles.checkboxOn]} />
                <Text style={styles.checkText}>
                  {item.name}
                  {median != null ? ` → ${median}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {addedCandidates.length > 0 ? (
        <View style={styles.block}>
          {addedCandidates.map(({ item, index }) => {
            const checked = Boolean(addToTemplate[index]);
            return (
              <Pressable
                key={`add-${index}`}
                testID={`training.summary.addToTemplate.${index}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() =>
                  setAddToTemplate((prev) => ({ ...prev, [index]: !prev[index] }))
                }
                style={styles.checkRow}>
                <View style={[styles.checkbox, checked && styles.checkboxOn]} />
                <Text style={styles.checkText}>
                  {item.name}: {t('training.panel.addToTemplate')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        testID="training.summary.done"
        accessibilityRole="button"
        disabled={!intensity || saving}
        onPress={() => void handleDone()}
        style={[styles.doneBtn, (!intensity || saving) && styles.doneDisabled]}>
        <Text style={styles.doneText}>
          {error ? t('training.panel.retry') : t('training.panel.done')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
    gap: 16,
    alignItems: 'stretch',
  },
  koli: {
    width: 96,
    height: 96,
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  statsCard: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  stat: {
    width: '45%',
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  block: {
    gap: 8,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  prLine: {
    color: BRAND_MINT,
    fontWeight: '600',
    fontSize: 14,
  },
  upperHint: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  intensityRow: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    gap: 4,
  },
  intensitySelected: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderWidth: 1,
    borderColor: BRAND_INDIGO,
  },
  intensityLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  intensityHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BRAND_INDIGO,
  },
  checkboxOn: {
    backgroundColor: BRAND_INDIGO,
  },
  checkText: {
    flex: 1,
    fontSize: 15,
    color: '#1E1B4B',
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
  },
  doneBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
  },
  doneDisabled: {
    opacity: 0.45,
  },
  doneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
