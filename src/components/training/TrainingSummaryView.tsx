import * as Sentry from '@sentry/react-native';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ProgressionSuggestionCard } from '@/components/training/ProgressionSuggestionCard';
import {
  doneSetValues,
  exerciseStats,
  istDiffersFromTarget,
  medianInt,
  sessionElapsedLabel,
} from '@/components/training/training-panel-utils';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY } from '@/constants/brand';
import { adoptTargetFromMedian } from '@/lib/workouts/adopt-target';
import { openExerciseNames } from '@/lib/workouts/session-logic';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { allSetsHitUpperBound } from '@/lib/workouts/format-target';
import { applyProgression } from '@/lib/workouts/apply-progression';
import { activeItemToHistoryUnit } from '@/lib/workouts/progression-history';
import { suggestProgression, type ProgressionSuggestion } from '@/lib/workouts/progression';
import {
  isAscentKind,
  isDescentKind,
  pickCelebrationSubtitleKey,
} from '@/lib/workouts/progression-ui';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import type {
  ActiveSession,
  Exercise,
  GymIntensity,
  ProgressionEvent,
  SessionSet,
} from '@/lib/workouts/types';
import {
  fetchExerciseById,
  fetchExerciseHistory,
  fetchExerciseHistoryUnits,
  fetchLadder,
  fetchProgressionEvents,
  insertProgressionEvent,
  saveTemplate,
  type SaveTemplateExerciseInput,
} from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';
import {
  summaryDraftOf,
  useWorkoutSessionStore,
} from '@/stores/workout-session-store';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';

type TrainingSummaryViewProps = {
  session: ActiveSession;
  onDismiss?: () => void;
};

type Decision = 'accept' | 'later';

/** Beyond this the hint turns into a wall of names. */
const OPEN_NAMES_SHOWN = 3;

type SuggestionRow = {
  index: number;
  item: ActiveSession['items'][number];
  exercise: Exercise;
  suggestion: ProgressionSuggestion;
  toName: string | null;
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

export function TrainingSummaryView({ session, onDismiss }: TrainingSummaryViewProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const finishSession = useWorkoutSessionStore((s) => s.finishSession);
  const templatesQuery = useWorkoutTemplates();
  const insets = useSafeAreaInsets();
  const resumeSession = useWorkoutSessionStore((state) => state.resumeSession);

  // These four live on the session, not in component state: leaving the
  // summary (tab switch, "Zurück zur Einheit", app restart) used to discard
  // a ticked adopt box without a word.
  const updateSummaryDraft = useWorkoutSessionStore((state) => state.updateSummaryDraft);
  const draft = summaryDraftOf(session);
  const intensity = draft.intensity;
  const adopt = draft.adopt;
  const addToTemplate = draft.addToTemplate;
  const decisions = draft.decisions;

  const setIntensity = (next: GymIntensity) => updateSummaryDraft({ intensity: next });
  const setAdopt = (updater: (prev: Record<number, boolean>) => Record<number, boolean>) =>
    updateSummaryDraft({ adopt: updater(adopt) });
  const setAddToTemplate = (
    updater: (prev: Record<number, boolean>) => Record<number, boolean>,
  ) => updateSummaryDraft({ addToTemplate: updater(addToTemplate) });
  const setDecisions = (
    updater: (prev: Record<number, Decision>) => Record<number, Decision>,
  ) => updateSummaryDraft({ decisions: updater(decisions) });

  const openNames = openExerciseNames(session);
  const [saving, setSaving] = useState(false);
  const [footerHeight, setFooterHeight] = useState(96);
  const [error, setError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    kind: 'variant' | 'praise' | 'firstLevel';
    name: string;
    step?: number;
    total?: number;
    praiseKey?: string;
  } | null>(null);

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

  const historyUnitQueries = useQueries({
    queries: exerciseIds.map((exerciseId) => ({
      queryKey:
        userId != null
          ? [...workoutQueryKeys.exerciseHistory(userId, exerciseId), 'units']
          : ['workout-exercise-history-units', exerciseId],
      enabled: Boolean(userId),
      staleTime: 5 * 60 * 1000,
      queryFn: () => fetchExerciseHistoryUnits(exerciseId, 20),
    })),
  });

  const exerciseQueries = useQueries({
    queries: exerciseIds.map((exerciseId) => ({
      queryKey: ['workout-exercise', exerciseId],
      enabled: Boolean(exerciseId),
      staleTime: 30 * 60 * 1000,
      queryFn: () => fetchExerciseById(exerciseId),
    })),
  });

  const template = useMemo(
    () => templatesQuery.data?.find((row) => row.id === session.templateId) ?? null,
    [templatesQuery.data, session.templateId],
  );

  const eventsQuery = useQueries({
    queries: [
      {
        queryKey:
          userId != null && session.templateId != null
            ? [...workoutQueryKeys.progressionEvents(userId), session.templateId]
            : ['workout-progression-events'],
        enabled: Boolean(userId && session.templateId),
        staleTime: 60 * 1000,
        queryFn: () => fetchProgressionEvents({ templateId: session.templateId! }),
      },
    ],
  });

  const ladderKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const q of exerciseQueries) {
      const key = q.data?.ladderKey;
      if (key) {
        keys.add(key);
      }
    }
    return [...keys];
  }, [exerciseQueries]);

  const ladderQueries = useQueries({
    queries: ladderKeys.map((ladderKey) => ({
      queryKey: workoutQueryKeys.ladder(ladderKey),
      enabled: Boolean(ladderKey),
      staleTime: 30 * 60 * 1000,
      queryFn: () => fetchLadder(ladderKey),
    })),
  });

  const laddersByKey = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    ladderKeys.forEach((key, index) => {
      map.set(key, ladderQueries[index]?.data ?? []);
    });
    return map;
  }, [ladderKeys, ladderQueries]);

  const templateExerciseIds = useMemo(
    () => template?.exercises.map((te) => te.exerciseId) ?? session.items.map((i) => i.exerciseId),
    [template, session.items],
  );

  const allEvents = (eventsQuery[0]?.data ?? []) as ProgressionEvent[];

  const suggestionRows = useMemo((): SuggestionRow[] => {
    const rows: SuggestionRow[] = [];
    session.items.forEach((item, index) => {
      const exercise =
        exerciseQueries[index]?.data ??
        template?.exercises.find((te) => te.exerciseId === item.exerciseId)?.exercise;
      if (!exercise || exercise.progressionKind === 'none') {
        return;
      }
      const ladder =
        exercise.ladderKey != null ? (laddersByKey.get(exercise.ladderKey) ?? []) : [];
      const past = historyUnitQueries[index]?.data ?? [];
      const currentUnit = activeItemToHistoryUnit(
        item,
        session.sessionId,
        intensity ?? session.intensity,
      );
      const lastEvents = allEvents.filter(
        (ev) => ev.fromExerciseId === item.exerciseId || ev.toExerciseId === item.exerciseId,
      );
      const suggestion = suggestProgression({
        exercise,
        ladder,
        currentTarget: {
          targetSets: item.targetSets,
          targetReps: item.targetReps,
          targetRepsMax: item.targetRepsMax,
          targetSeconds: item.targetSeconds,
          targetSecondsMax: item.targetSecondsMax,
        },
        history: [currentUnit, ...past],
        templateExerciseIds,
        lastEvents,
      });
      if (!suggestion) {
        return;
      }
      let toName: string | null = null;
      if (suggestion.toExerciseId) {
        const toEx =
          ladder.find((ex) => ex.id === suggestion.toExerciseId) ??
          template?.exercises.find((te) => te.exerciseId === suggestion.toExerciseId)?.exercise;
        toName = toEx ? resolveExerciseName(toEx, i18n.language) : null;
      }
      rows.push({ index, item, exercise, suggestion, toName });
    });
    return rows;
  }, [
    session.items,
    session.sessionId,
    session.intensity,
    intensity,
    exerciseQueries,
    historyUnitQueries,
    laddersByKey,
    template,
    templateExerciseIds,
    allEvents,
    i18n.language,
  ]);

  const ascentRows = suggestionRows.filter((row) => isAscentKind(row.suggestion.kind));
  const descentRows = suggestionRows.filter((row) => isDescentKind(row.suggestion.kind));
  const progressionIndexSet = useMemo(
    () => new Set(suggestionRows.map((row) => row.index)),
    [suggestionRows],
  );

  const firstLevelHints = useMemo(() => {
    const hints: string[] = [];
    session.items.forEach((item, index) => {
      const exercise = exerciseQueries[index]?.data;
      if (!exercise?.ladderStep || !exercise.ladderKey) {
        return;
      }
      const past = historyUnitQueries[index]?.data ?? [];
      if (past.length > 0) {
        return;
      }
      const acceptedUp = allEvents.find(
        (ev) =>
          ev.status === 'accepted' &&
          ev.kind === 'variant_up' &&
          ev.toExerciseId === item.exerciseId,
      );
      if (!acceptedUp) {
        return;
      }
      hints.push(
        t('training.progression.firstOnLevel', {
          step: exercise.ladderStep,
        }),
      );
    });
    return hints;
  }, [session.items, exerciseQueries, historyUnitQueries, allEvents, t]);

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
        .filter(({ item, index }) => istDiffersFromTarget(item) && !progressionIndexSet.has(index)),
    [session.items, progressionIndexSet],
  );

  const addedCandidates = useMemo(
    () =>
      session.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.addedInSession),
    [session.items],
  );

  const upperBoundReady = useMemo(() => {
    return session.items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => {
        if (progressionIndexSet.has(index)) {
          return false;
        }
        return allSetsHitUpperBound({
          kind: item.kind,
          targetRepsMax: item.targetRepsMax,
          targetSecondsMax: item.targetSecondsMax,
          setValues: doneSetValues(item),
        });
      });
  }, [session.items, progressionIndexSet]);

  async function persistAdoptAndAdds(): Promise<void> {
    const templateId = session.templateId;
    if (!templateId || !template) {
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
        const sessionIndex = session.items.findIndex((item) => item === sessionItem);
        const shouldAdopt =
          sessionIndex >= 0 && adopt[sessionIndex] && !progressionIndexSet.has(sessionIndex);
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

        const adopted = adoptTargetFromMedian({
          kind: sessionItem.kind,
          median,
          targetRepsMax: te.targetRepsMax,
          targetSecondsMax: te.targetSecondsMax,
        });
        return {
          exerciseId: te.exerciseId,
          targetSets: sessionItem.sets.length,
          targetReps: adopted.targetReps,
          targetRepsMax: adopted.targetRepsMax,
          targetSeconds: adopted.targetSeconds,
          targetSecondsMax: adopted.targetSecondsMax,
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

  async function persistProgressions(sessionId: string): Promise<void> {
    if (!template) {
      return;
    }

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

    let didAccept = false;
    let celeb: typeof celebration = null;

    for (const row of suggestionRows) {
      const decision = decisions[row.index];
      if (decision !== 'accept' && decision !== 'later') {
        continue;
      }

      if (decision === 'accept') {
        exercises = applyProgression(exercises, row.suggestion);
        didAccept = true;

        if (row.suggestion.kind === 'variant_up' && row.suggestion.level) {
          celeb = {
            kind: 'variant',
            name: row.toName ?? row.item.name,
            step: row.suggestion.level.toStep,
            total: row.suggestion.level.total,
          };
        } else if (
          row.suggestion.kind === 'sets_up' ||
          row.suggestion.kind === 'range_up' ||
          row.suggestion.kind === 'time_up' ||
          row.suggestion.kind === 'load_up'
        ) {
          const praiseKey =
            row.suggestion.kind === 'sets_up'
              ? 'training.progression.praise.setsUp'
              : row.suggestion.kind === 'range_up'
                ? 'training.progression.praise.rangeUp'
                : row.suggestion.kind === 'time_up'
                  ? 'training.progression.praise.timeUp'
                  : 'training.progression.praise.loadUp';
          celeb = {
            kind: 'praise',
            name: row.item.name,
            praiseKey,
          };
        }
      }

      await insertProgressionEvent({
        templateId: template.id,
        sessionId,
        kind: row.suggestion.kind,
        fromExerciseId: row.suggestion.exerciseId,
        toExerciseId: row.suggestion.toExerciseId,
        fromTarget: row.suggestion.fromTarget,
        toTarget: row.suggestion.toTarget,
        status: decision === 'accept' ? 'accepted' : 'declined',
      });
    }

    if (didAccept) {
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

    if (celeb) {
      setCelebration(celeb);
    } else {
      onDismiss?.();
    }
  }

  async function handleDone() {
    if (!intensity) {
      return;
    }
    setSaving(true);
    setError(null);
    setProgressError(null);
    const sessionId = session.sessionId;
    try {
      const result = await finishSession(intensity, queryClient);
      if (!result.ok) {
        setError(t('training.panel.finishError'));
        return;
      }
      try {
        await persistAdoptAndAdds();
        await persistProgressions(sessionId);
        await queryClient.invalidateQueries({
          queryKey: userId ? workoutQueryKeys.progressionEvents(userId) : ['workout-progression-events'],
        });
        await queryClient.invalidateQueries({
          queryKey: userId ? workoutQueryKeys.templates(userId) : ['workout-templates'],
        });
      } catch (progressErr) {
        Sentry.captureException(progressErr);
        setProgressError(t('training.progression.applyError'));
      }
    } catch (error) {
      Sentry.captureException(error);
      setError(t('training.panel.finishError'));
    } finally {
      setSaving(false);
    }
  }

  if (celebration?.kind === 'variant') {
    const subtitleKey = pickCelebrationSubtitleKey(session.sessionId);
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeIn.duration(420)} style={styles.celebWrap}>
          <Image
            source={require('@/assets/images/koli-energetic.png')}
            style={styles.koliLarge}
            contentFit="contain"
          />
          <Text testID="training.progression.celebration" style={styles.celebTitle}>
            {t('training.progression.celebration.title')}
          </Text>
          <Text style={styles.celebLevel}>
            {t('training.progression.celebration.level', {
              name: celebration.name,
              step: celebration.step,
              total: celebration.total,
            })}
          </Text>
          <Text style={styles.celebSub}>{t(subtitleKey)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDismiss?.()}
            style={styles.doneBtn}>
            <Text style={styles.doneText}>{t('training.progression.celebration.continue')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    );
  }

  if (celebration?.kind === 'praise' && celebration.praiseKey) {
    const accepted = suggestionRows.find((r) => decisions[r.index] === 'accept');
    const toTarget = accepted?.suggestion.toTarget;
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeIn.duration(320)} style={styles.celebWrap}>
          <GlassCard style={styles.praiseCard}>
            <Image
              source={require('@/assets/images/koli-happy.png')}
              style={styles.koliSmall}
              contentFit="contain"
            />
            <Text style={styles.praiseText}>
              {t(celebration.praiseKey, {
                name: celebration.name,
                sets: toTarget?.targetSets ?? '',
                range:
                  toTarget?.targetSeconds != null
                    ? `${toTarget.targetSeconds}${
                        toTarget.targetSecondsMax != null
                          ? `–${toTarget.targetSecondsMax}`
                          : ''
                      } s`
                    : toTarget?.targetReps != null
                      ? `${toTarget.targetReps}${
                          toTarget.targetRepsMax != null ? `–${toTarget.targetRepsMax}` : ''
                        }`
                      : '',
              })}
            </Text>
          </GlassCard>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDismiss?.()}
            style={styles.doneBtn}>
            <Text style={styles.doneText}>{t('training.progression.celebration.continue')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: footerHeight + 24 }]}
        showsVerticalScrollIndicator={false}>
      <Image
        source={require('@/assets/images/koli-happy.png')}
        style={styles.koli}
        contentFit="contain"
      />

      <Text style={styles.title}>{session.templateName}</Text>

      {openNames.length > 0 ? (
        <Pressable
          testID="training.summary.openExercises"
          accessibilityRole="button"
          onPress={resumeSession}
          style={styles.openCard}>
          <Text style={styles.openText}>
            {t('training.panel.openExercises', {
              count: openNames.length,
              names:
                openNames.length > OPEN_NAMES_SHOWN
                  ? `${openNames.slice(0, OPEN_NAMES_SHOWN).join(', ')} ${t(
                      'training.panel.openExercisesMore',
                      { count: openNames.length - OPEN_NAMES_SHOWN },
                    )}`
                  : openNames.join(', '),
            })}
          </Text>
          <Text style={styles.openLink}>{t('training.panel.backToSession')}</Text>
        </Pressable>
      ) : null}

      {firstLevelHints.map((hint) => (
        <Text key={hint} style={styles.firstLevel}>
          {hint}
        </Text>
      ))}

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

      {ascentRows.length > 0 || upperBoundReady.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('training.progression.readyTitle')}</Text>
          {upperBoundReady.map(({ item }) => (
            <Text key={`upper-${item.exerciseId}`} style={styles.upperHint}>
              {item.name}: {t('training.panel.upperBoundHint')}
            </Text>
          ))}
          {ascentRows.map((row) => (
            <ProgressionSuggestionCard
              key={`asc-${row.index}`}
              exerciseIndex={row.index}
              name={row.item.name}
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
        </View>
      ) : null}

      {descentRows.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('training.progression.adjustedTitle')}</Text>
          {descentRows.map((row) => (
            <ProgressionSuggestionCard
              key={`desc-${row.index}`}
              exerciseIndex={row.index}
              name={row.item.name}
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
        </View>
      ) : null}

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
      {progressError ? <Text style={styles.progressHint}>{progressError}</Text> : null}
      </ScrollView>

      {/* Fixed footer: the summary grew past one screen, and a "Fertig" that
          scrolls out of reach silently loses the intensity. */}
      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {progressError ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onDismiss?.()}
            style={styles.doneBtn}>
            <Text style={styles.doneText}>{t('training.progression.celebration.continue')}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              testID="training.summary.back"
              accessibilityRole="button"
              disabled={saving}
              onPress={resumeSession}
              hitSlop={8}
              style={styles.backLink}>
              <Text style={styles.backLinkText}>{t('training.panel.backToSession')}</Text>
            </Pressable>
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
          </>
        )}
      </View>
    </View>
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
  root: {
    flex: 1,
  },
  scroll: {
    gap: 16,
    alignItems: 'stretch',
  },
  footer: {
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(79, 70, 229, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  openCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 4,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  openText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E1B4B',
  },
  openLink: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_INDIGO,
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  backLinkText: {
    color: TEXT_SECONDARY,
    fontWeight: '600',
    fontSize: 14,
  },
  koli: {
    width: 96,
    height: 96,
    alignSelf: 'center',
  },
  koliLarge: {
    width: 140,
    height: 140,
    alignSelf: 'center',
  },
  koliSmall: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  celebWrap: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 24,
  },
  celebTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  celebLevel: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_INDIGO,
    textAlign: 'center',
  },
  celebSub: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  praiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  praiseText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  firstLevel: {
    textAlign: 'center',
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 14,
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
  progressHint: {
    color: TEXT_SECONDARY,
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
