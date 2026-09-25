import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressionSuggestionCard } from '@/components/training/ProgressionSuggestionCard';
import {
  countDoneSets,
  doneSetValues,
  exerciseStats,
  istDiffersFromTarget,
  medianInt,
  sessionElapsedLabel,
} from '@/components/training/training-panel-utils';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY } from '@/constants/brand';
import { ShareStickerSheet } from '@/components/share/ShareStickerSheet';
import {
  buildExerciseSticker,
  buildLevelSticker,
  buildSessionSticker,
  exerciseMilestone,
  formatSetsCompact,
  type ExerciseMilestone,
  type ExerciseStickerData,
  type LevelStickerData,
  type SessionStickerData,
  type StickerData,
} from '@/lib/share/sticker-data';
import { postTrainingNutritionHint } from '@/lib/nutrition/post-training-nutrition-hint';
import { adoptTargetFromMedian } from '@/lib/workouts/adopt-target';
import {
  openExerciseNames,
  sessionDurationMinutes,
  sessionEndIso,
} from '@/lib/workouts/session-logic';
import {
  displayActiveExerciseName,
  resolveExerciseName,
} from '@/lib/workouts/exercise-name';
import { allSetsHitUpperBound } from '@/lib/workouts/format-target';
import { applyProgression } from '@/lib/workouts/apply-progression';
import { suggestGymIntensityFromSetPace } from '@/lib/workouts/intensity-pace';
import { afterProgress, finishOutcome } from '@/lib/workouts/summary-done';
import { activeItemToHistoryUnit, withoutSession } from '@/lib/workouts/progression-history';
import {
  buildCelebration,
  CELEBRATION_LEVEL_KEY,
  CELEBRATION_MULTI_TITLE_KEY,
  type AcceptedProgression,
  type Celebration,
  type ProgressionToTarget,
} from '@/lib/workouts/celebration';
import { bestPriorValue, bestSessionValue } from '@/lib/workouts/session-bests';
import { suggestProgression, type ProgressionSuggestion } from '@/lib/workouts/progression';
import {
  isTooHardStreak,
  normalizeShortfallReasons,
  sessionHasClearShortfall,
  SHORTFALL_REASONS,
  toggleShortfallReason,
} from '@/lib/workouts/shortfall';
import { useSchemaCapability } from '@/hooks/use-schema-capability';
import {
  isAscentKind,
  isDescentKind,
  pickCelebrationSubtitleKey,
} from '@/lib/workouts/progression-ui';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import type {
  ActiveExercise,
  ActiveSession,
  Exercise,
  GymIntensity,
  ProgressionEvent,
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
import { useReadiness } from '@/hooks/use-checkin';
import { useIsDeloadActive } from '@/hooks/use-deload';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { gateSuggestionByReadiness } from '@/lib/workouts/progression-readiness';

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

export function TrainingSummaryView({ session, onDismiss }: TrainingSummaryViewProps) {
  const { t, i18n } = useTranslation();
  const labelOf = (item: ActiveExercise) =>
    displayActiveExerciseName(item, i18n.language);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  // The home container pads the bottom by this much; the fade reaches into
  // it so it ends at the screen edge instead of in a visible seam.
  const containerBottomPad = Math.max(insets.bottom, 24);
  const userId = useAuthStore((s) => s.session?.user?.id);
  const finishSession = useWorkoutSessionStore((s) => s.finishSession);
  const templatesQuery = useWorkoutTemplates();
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

  // "Was war los?": once per session, only after a clear shortfall and only
  // once shortfall_reasons exists — without the column there is no place to keep it.
  const shortfallAvailable = useSchemaCapability('workoutSessionsShortfallReasons');
  const showShortfall = shortfallAvailable && sessionHasClearShortfall(session.items);
  const shortfallPicked = draft.shortfallReasons;
  const shortfallReasons = normalizeShortfallReasons(shortfallPicked);

  useEffect(() => {
    if (intensity != null) {
      return;
    }
    const suggested = suggestGymIntensityFromSetPace({
      durationMinutes: sessionDurationMinutes(session),
      doneSetCount: countDoneSets(session).done,
    });
    if (suggested != null) {
      setIntensity(suggested);
    }
    // Prefill once when the summary opens without a choice yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session identity + empty intensity
  }, [session.sessionId, intensity]);

  const openNames = openExerciseNames(session);
  const [saving, setSaving] = useState(false);
  const [footerHeight, setFooterHeight] = useState(96);
  const [error, setError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  // What is still open on the plate right after the session.
  const dashboard = useHomeDashboard();
  const nutritionHint = useMemo(() => {
    const data = dashboard.data;
    const targets = data?.latestCalorieGoal;
    const macros = data?.consumedMacrosToday;
    if (!data || !targets || !macros) {
      return [];
    }
    // Nothing eaten yet is a known 0, not unknown.
    const zeroDay = data.consumedCaloriesToday === 0;
    const eaten = (value: number | null) => value ?? (zeroDay ? 0 : null);
    return postTrainingNutritionHint({
      trainingKind: 'strength',
      consumed: {
        proteinG: eaten(macros.proteinG),
        carbsG: eaten(macros.carbsG),
        fatG: eaten(macros.fatG),
      },
      targets: {
        proteinG: targets.protein_g,
        carbsG: targets.carbs_g,
        fatG: targets.fat_g,
      },
    });
  }, [dashboard.data]);
  const [sticker, setSticker] = useState<StickerData | null>(null);

  const stats = exerciseStats(session);
  // Ends at the last set, so the time spent here does not keep counting.
  const finishedAt = Date.parse(
    session.finishedAt ?? sessionEndIso(session, new Date().toISOString()),
  );
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

  const readiness = useReadiness();

  const deloadActive = useIsDeloadActive();

  const { suggestionRows, heldBackIndexes } = useMemo(() => {
    // A lighter week changes no targets — neither up nor down.
    if (deloadActive) {
      return { suggestionRows: [] as SuggestionRow[], heldBackIndexes: new Set<number>() };
    }
    const rows: SuggestionRow[] = [];
    // Level-ups today's readiness holds back (schonen, or normal without a clear success).
    const heldBack = new Set<number>();
    session.items.forEach((item, index) => {
      const exercise =
        exerciseQueries[index]?.data ??
        template?.exercises.find((te) => te.exerciseId === item.exerciseId)?.exercise;
      if (!exercise || exercise.progressionKind === 'none') {
        return;
      }
      const ladder =
        exercise.ladderKey != null ? (laddersByKey.get(exercise.ladderKey) ?? []) : [];
      const past = withoutSession(historyUnitQueries[index]?.data ?? [], session.sessionId);
      const currentUnit = activeItemToHistoryUnit(
        item,
        session.sessionId,
        intensity ?? session.intensity,
      );
      const lastEvents = allEvents.filter(
        (ev) => ev.fromExerciseId === item.exerciseId || ev.toExerciseId === item.exerciseId,
      );
      const tooHardStreak =
        shortfallAvailable &&
        isTooHardStreak(item, [
          { ...currentUnit, shortfallReasons: normalizeShortfallReasons(shortfallPicked) },
          ...past,
        ]);
      const raw = suggestProgression({
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
        tooHardStreak,
      });
      const suggestion = gateSuggestionByReadiness(raw, readiness, currentUnit);
      if (raw && !suggestion) {
        heldBack.add(index);
      }
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
    return { suggestionRows: rows, heldBackIndexes: heldBack };
  }, [
    deloadActive,
    readiness,
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
    shortfallAvailable,
    shortfallPicked,
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
      const past = withoutSession(historyUnitQueries[index]?.data ?? [], session.sessionId);
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
  }, [session.items, session.sessionId, exerciseQueries, historyUnitQueries, allEvents, t]);

  // First executions get "Zum ersten Mal", not a best: there is nothing to beat.
  const milestones = useMemo(
    (): ExerciseMilestone[] =>
      session.items.map((item, index) =>
        exerciseMilestone({
          sessionBest: bestSessionValue(doneSetValues(item)),
          priorBest: bestPriorValue(
            withoutSession(historyQueries[index]?.data ?? [], session.sessionId),
            item.kind,
          ),
          historyLoaded: historyQueries[index]?.isSuccess === true,
        }),
      ),
    [historyQueries, session.items, session.sessionId],
  );

  const prs = useMemo(() => {
    const rows: { index: number; name: string; value: string }[] = [];
    session.items.forEach((item, index) => {
      const sessionBest = bestSessionValue(doneSetValues(item));
      if (sessionBest == null || milestones[index] !== 'newBest') {
        return;
      }
      rows.push({
        index,
        name: labelOf(item),
        value: item.kind === 'time' ? `${sessionBest} s` : String(sessionBest),
      });
    });
    return rows;
  }, [milestones, session.items, i18n.language]);

  const exerciseRows = session.items
    .map((item, index) => ({
      item,
      index,
      sets: formatSetsCompact(doneSetValues(item), item.kind),
    }))
    .filter((row) => row.sets.length > 0);

  function exerciseSticker(index: number): ExerciseStickerData {
    const item = session.items[index];
    const exercise = exerciseQueries[index]?.data;
    return buildExerciseSticker({
      exercise,
      fallbackName: labelOf(item),
      lang: i18n.language,
      exerciseKind: item.kind,
      perSide: item.perSide,
      values: doneSetValues(item),
      ladder: exercise?.ladderKey != null ? (laddersByKey.get(exercise.ladderKey) ?? []) : [],
      milestone: milestones[index] ?? null,
    });
  }

  function sessionSticker(): SessionStickerData {
    return buildSessionSticker({
      name: session.templateName,
      dateKey: session.loggedOn,
      durationMinutes: sessionDurationMinutes(session),
      totals: { reps: stats.repsTotal, seconds: stats.secondsTotal },
      items: session.items.map((item) => ({
        exerciseId: item.exerciseId,
        name: labelOf(item),
        exerciseKind: item.kind,
        values: doneSetValues(item),
      })),
      bestsCount: prs.length,
      suggestions: suggestionRows.map((row) => ({ index: row.index, kind: row.suggestion.kind })),
      decisions,
    });
  }

  function levelStickerFor(row: SuggestionRow): LevelStickerData | undefined {
    const ladder =
      row.exercise.ladderKey != null ? (laddersByKey.get(row.exercise.ladderKey) ?? []) : [];
    return (
      buildLevelSticker({
        toExercise: ladder.find((ex) => ex.id === row.suggestion.toExerciseId),
        fromExercise: row.exercise,
        lang: i18n.language,
        ladder,
      }) ?? undefined
    );
  }

  /** "Ab jetzt 4 Sätze …" — the sentence for one accepted small step. */
  function praiseText(praise: { name: string; praiseKey: string; toTarget?: ProgressionToTarget }) {
    const toTarget = praise.toTarget;
    return t(praise.praiseKey, {
      name: praise.name,
      sets: toTarget?.targetSets ?? '',
      range:
        toTarget?.targetSeconds != null
          ? `${toTarget.targetSeconds}${
              toTarget.targetSecondsMax != null ? `–${toTarget.targetSecondsMax}` : ''
            } s`
          : toTarget?.targetReps != null
            ? `${toTarget.targetReps}${
                toTarget.targetRepsMax != null ? `–${toTarget.targetRepsMax}` : ''
              }`
            : '',
    });
  }

  const shareSheet = <ShareStickerSheet data={sticker} onClose={() => setSticker(null)} allowStory />;

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
        if (progressionIndexSet.has(index) || heldBackIndexes.has(index)) {
          return false;
        }
        return allSetsHitUpperBound({
          kind: item.kind,
          targetRepsMax: item.targetRepsMax,
          targetSecondsMax: item.targetSecondsMax,
          setValues: doneSetValues(item),
        });
      });
  }, [session.items, progressionIndexSet, heldBackIndexes]);

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
      // The plan changed while the unit ran: nothing to write, but the
      // summary must still close (it used to stay open with "Fertig").
      onDismiss?.();
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
    // Every accepted step, not just the last one — buildCelebration decides
    // what the screen becomes.
    const accepted: AcceptedProgression[] = [];

    for (const row of suggestionRows) {
      const decision = decisions[row.index];
      if (decision !== 'accept' && decision !== 'later') {
        continue;
      }

      if (decision === 'accept') {
        exercises = applyProgression(exercises, row.suggestion);
        didAccept = true;

        if (row.suggestion.kind === 'variant_up' && row.suggestion.level) {
          accepted.push({
            kind: 'variant_up',
            name: row.toName ?? labelOf(row.item),
            step: row.suggestion.level.toStep,
            total: row.suggestion.level.total,
            levelSticker: levelStickerFor(row) ?? null,
          });
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
          accepted.push({
            kind: 'praise',
            name: labelOf(row.item),
            praiseKey,
            toTarget: row.suggestion.toTarget ?? undefined,
          });
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

    const next = afterProgress({ templateFound: true, celebration: buildCelebration(accepted) });
    if (next.kind === 'celebrate') {
      setCelebration(next.celebration);
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
      const outcome = finishOutcome(result);
      if (outcome === 'alreadySaved') {
        // Saved on an earlier tap; the summary only stayed open.
        onDismiss?.();
        return;
      }
      if (outcome === 'failed') {
        setError(t('training.panel.finishError'));
        return;
      }
      try {
        await persistAdoptAndAdds();
        await persistProgressions(sessionId);
        if (userId) {
          await invalidateTrainingQueries(queryClient, userId);
        }
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

  if (celebration?.mode === 'single_level') {
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
            {t(CELEBRATION_LEVEL_KEY, {
              name: celebration.name,
              step: celebration.step,
              total: celebration.total,
            })}
          </Text>
          <Text style={styles.celebSub}>{t(subtitleKey)}</Text>
          {celebration.levelSticker ? (
            <Pressable
              testID="training.progression.celebration.share"
              accessibilityRole="button"
              onPress={() => setSticker(celebration.levelSticker as StickerData)}
              style={styles.shareBtn}>
              <Ionicons name="share-outline" size={18} color={BRAND_INDIGO} />
              <Text style={styles.shareText}>{t('share.actions.share')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => onDismiss?.()}
            style={styles.doneBtn}>
            <Text style={styles.doneText}>{t('training.progression.celebration.continue')}</Text>
          </Pressable>
        </Animated.View>
        {shareSheet}
      </ScrollView>
    );
  }

  if (celebration?.mode === 'multi_level') {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeIn.duration(420)} style={styles.celebWrap}>
          <Image
            source={require('@/assets/images/koli-energetic.png')}
            style={styles.koliLarge}
            contentFit="contain"
          />
          <Text testID="training.progression.celebration" style={styles.celebTitle}>
            {t(CELEBRATION_MULTI_TITLE_KEY, { count: celebration.count })}
          </Text>
          <View style={styles.celebLevelList}>
            {celebration.levels.map((level, index) => (
              <View key={`${level.name}-${index}`} style={styles.celebLevelRow}>
                <Text style={styles.celebLevelRowText}>
                  {t(CELEBRATION_LEVEL_KEY, {
                    name: level.name,
                    step: level.step,
                    total: level.total,
                  })}
                </Text>
                {level.levelSticker ? (
                  <Pressable
                    testID={`training.progression.celebration.share.${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('share.actions.share')}
                    hitSlop={8}
                    onPress={() => setSticker(level.levelSticker as StickerData)}>
                    <Ionicons name="share-outline" size={18} color={BRAND_INDIGO} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          {celebration.praiseLine ? (
            <Text style={styles.celebSub}>{praiseText(celebration.praiseLine)}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => onDismiss?.()}
            style={styles.doneBtn}>
            <Text style={styles.doneText}>{t('training.progression.celebration.continue')}</Text>
          </Pressable>
        </Animated.View>
        {shareSheet}
      </ScrollView>
    );
  }

  if (celebration?.mode === 'praise_only') {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeIn.duration(320)} style={styles.celebWrap}>
          <GlassCard style={styles.praiseCard}>
            <Image
              source={require('@/assets/images/koli-happy.png')}
              style={styles.koliSmall}
              contentFit="contain"
            />
            <Text style={styles.praiseText}>{praiseText(celebration)}</Text>
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

      {nutritionHint.length > 0 ? (
        <View testID="training.summary.nutritionHint" style={styles.nutritionHintCard}>
          {nutritionHint.map((line) => (
            <Text key={line.kind} style={styles.nutritionHintText}>
              {t(line.messageKey, line.kind === 'fat' ? undefined : line.params)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>{t('training.panel.intensityTitle')}</Text>
          <Text style={styles.blockHint}>{t('training.panel.intensityHint')}</Text>
        </View>
        {(['easy', 'normal', 'hard'] as const).map((key) => {
          const selected = intensity === key;
          return (
            <Pressable
              key={key}
              testID={`training.summary.intensity.${key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setIntensity(key)}
              style={[styles.intensityOption, selected && styles.intensityOptionOn]}>
              <View style={styles.intensityText}>
                <Text style={styles.intensityShort}>
                  {t(`training.panel.intensityOption.${key}.short`)}
                </Text>
                <Text style={styles.intensityDescription}>
                  {t(`training.panel.intensityOption.${key}.description`)}
                </Text>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={BRAND_INDIGO} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {showShortfall ? (
        <View style={styles.block} testID="training.summary.shortfall">
          <Text style={styles.blockTitle}>{t('rir.shortfallTitle')}</Text>
          <View style={styles.shortfallChips}>
            {SHORTFALL_REASONS.map((reason) => {
              const selected = shortfallReasons.includes(reason);
              return (
                <Pressable
                  key={reason}
                  testID={`training.summary.shortfall.${reason}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    updateSummaryDraft({
                      shortfallReasons: toggleShortfallReason(shortfallReasons, reason),
                    })
                  }
                  style={[styles.shortfallChip, selected && styles.shortfallChipSelected]}>
                  <Text
                    style={[
                      styles.shortfallChipText,
                      selected && styles.shortfallChipTextSelected,
                    ]}>
                    {t(`rir.reason.${reason}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {firstLevelHints.map((hint) => (
        <Text key={hint} style={styles.firstLevel}>
          {hint}
        </Text>
      ))}

      {heldBackIndexes.size > 0 ? (
        <Text testID="training.summary.readinessWaiting" style={styles.readinessWaiting}>
          {t('checkin.progression.waiting')}
        </Text>
      ) : null}

      {ascentRows.length > 0 || upperBoundReady.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('training.progression.readyTitle')}</Text>
          {upperBoundReady.map(({ item }) => (
            <Text key={`upper-${item.exerciseId}`} style={styles.upperHint}>
              {labelOf(item)}: {t('training.panel.upperBoundHint')}
            </Text>
          ))}
          {ascentRows.map((row) => (
            <ProgressionSuggestionCard
              key={`asc-${row.index}`}
              exerciseIndex={row.index}
              name={labelOf(row.item)}
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
              name={labelOf(row.item)}
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
                  {labelOf(item)}
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
                  {labelOf(item)}: {t('training.panel.addToTemplate')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <GlassCard style={styles.statsCard}>
        <Stat label={t('training.panel.duration')} value={durationLabel} />
        <Stat label={t('training.panel.sets')} value={String(stats.setsDone)} />
        <Stat label={t('training.panel.reps')} value={String(stats.repsTotal)} />
        <Stat label={t('training.panel.seconds')} value={String(stats.secondsTotal)} />
      </GlassCard>

      {exerciseRows.length > 0 ? (
        <View style={styles.block} testID="training.summary.exercises">
          <Text style={styles.blockTitle}>{t('share.exercisesTitle')}</Text>
          {exerciseRows.map(({ item, index, sets }) => (
            <View key={`${item.exerciseId}-${index}`} style={styles.exerciseRow}>
              <View style={styles.exerciseNameCol}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {labelOf(item)}
                </Text>
                {milestones[index] ? (
                  <Text style={styles.exerciseMilestone}>
                    {milestones[index] === 'newBest' ? t('share.newBest') : t('share.firstTime')}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.exerciseSets}>{sets}</Text>
              <Pressable
                testID={`training.summary.shareExercise.${index}`}
                accessibilityRole="button"
                accessibilityLabel={t('share.shareExercise', { name: labelOf(item) })}
                hitSlop={8}
                onPress={() => setSticker(exerciseSticker(index))}
                style={styles.exerciseShare}>
                <Ionicons name="share-outline" size={18} color={BRAND_INDIGO} />
              </Pressable>
            </View>
          ))}
          <Pressable
            testID="training.summary.shareSession"
            accessibilityRole="button"
            onPress={() => setSticker(sessionSticker())}
            style={styles.shareBtn}>
            <Ionicons name="share-outline" size={18} color={BRAND_INDIGO} />
            <Text style={styles.shareText}>{t('share.actions.share')}</Text>
          </Pressable>
        </View>
      ) : null}

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

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {progressError ? <Text style={styles.progressHint}>{progressError}</Text> : null}
      </ScrollView>

      {/* Fixed footer: the summary grew past one screen, and a "Fertig" that
          scrolls out of reach silently loses the intensity. No box of its own:
          the content fades out into the background above the buttons, over the
          full screen width. The home container already pads the safe area. */}
      <View
        onLayout={(event) =>
          setFooterHeight(
            event.nativeEvent.layout.height - containerBottomPad - FOOTER_FADE_OVERSHOOT,
          )
        }
        style={[
          styles.footer,
          // Overshoots the screen edge: outer containers add their own bottom
          // space, and a fade that stops short shows as a line.
          {
            bottom: -(containerBottomPad + FOOTER_FADE_OVERSHOOT),
            paddingBottom: containerBottomPad + FOOTER_FADE_OVERSHOOT + 4,
          },
        ]}>
        <LinearGradient
          pointerEvents="none"
          colors={FOOTER_FADE_COLORS}
          locations={FOOTER_FADE_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
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
      {shareSheet}
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

/** Horizontal padding of the home tab around the panel (px-6). */
const SCREEN_GUTTER = 24;
/** Transparent → background (SURFACE_BASE, white) behind the footer buttons. */
const FOOTER_FADE_COLORS = [
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0.9)',
  'rgba(255, 255, 255, 0.97)',
  'rgba(255, 255, 255, 0.97)',
] as const;
// Opaque enough by the "Zurück zur Einheit" link that content never reads through.
const FOOTER_FADE_LOCATIONS = [0, 0.14, 0.25, 1] as const;
const FOOTER_FADE_OVERSHOOT = 60;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    gap: 16,
    alignItems: 'stretch',
  },
  footer: {
    position: 'absolute',
    left: -SCREEN_GUTTER,
    right: -SCREEN_GUTTER,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 36,
    gap: 8,
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
  nutritionHintCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  nutritionHintText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#064E3B',
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
    alignItems: 'stretch',
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
  celebLevelList: {
    alignSelf: 'stretch',
    gap: 8,
    paddingHorizontal: 12,
  },
  celebLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  celebLevelRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_INDIGO,
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
  readinessWaiting: {
    textAlign: 'center',
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 12,
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
  // Every section: the same title, 8 pt extra before (on top of the scroll
  // gap) and 10 pt between title and content.
  block: {
    gap: 10,
    marginTop: 8,
  },
  blockTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  blockHeader: {
    gap: 2,
  },
  blockHint: {
    fontSize: 14,
    color: TEXT_SECONDARY,
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
  // Pills like "Übernehmen" / "Später": light, borderless at rest; the
  // transparent border keeps the size when the selected border appears.
  intensityOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
  },
  intensityOptionOn: {
    borderColor: BRAND_INDIGO,
    backgroundColor: 'rgba(79, 70, 229, 0.14)',
  },
  intensityText: {
    flex: 1,
    gap: 1,
  },
  intensityShort: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  intensityDescription: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  shortfallChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shortfallChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  shortfallChipSelected: {
    backgroundColor: BRAND_INDIGO,
  },
  shortfallChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_INDIGO,
  },
  shortfallChipTextSelected: {
    color: '#FFFFFF',
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
    alignSelf: 'stretch',
    paddingHorizontal: 28,
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
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  exerciseNameCol: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 14,
    color: '#1E1B4B',
  },
  exerciseMilestone: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
    color: BRAND_INDIGO,
  },
  exerciseSets: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  exerciseShare: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79,70,229,0.1)',
  },
  shareBtn: {
    marginTop: 4,
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79,70,229,0.1)',
  },
  shareText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
    fontSize: 15,
  },
});
