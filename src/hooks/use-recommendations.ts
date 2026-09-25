import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { useDeferredProgressions } from '@/components/training/IdleProgressionOverlay';
import { useReadiness, useTodayCheckinStatus } from '@/hooks/use-checkin';
import { useDeloadSuggestion } from '@/hooks/use-deload';
import { useExercises } from '@/hooks/use-exercises';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useTrainingSessionsWeek } from '@/hooks/use-training-sessions-week';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { fetchBodyMeasurementsSince } from '@/lib/body-measurements';
import { usesMeasurements as usesMeasurementsCore } from '@/lib/body-measurements-core';
import { localDateKey, shiftLocalDateKey } from '@/lib/day-window';
import { goalCategoryForGoalType } from '@/lib/goal-category';
import {
  readDismissals,
  writeDismissal,
  type RecommendationDismissals,
} from '@/lib/recommendations/dismissals';
import { recommendationStorage } from '@/lib/recommendations/dismissals-storage';
import {
  buildRecommendations,
  type MuscleDeficit,
  type NextLevelReady,
  type Recommendation,
  type RecommendationKind,
  isTrainingDay,
} from '@/lib/recommendations/recommendations';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { hasEnoughMuscleData, recommendForMuscles } from '@/lib/workouts/muscle-recommendation';
import {
  countMuscleSets,
  muscleStatus,
  visibleMuscleGroups,
  weeklySetTarget,
  type MuscleSetInput,
} from '@/lib/workouts/muscle-volume';
import { unitMuscleProfile } from '@/lib/workouts/muscles';
import { isAscentKind } from '@/lib/workouts/progression-ui';
import { pickNextTemplateForReadiness } from '@/lib/workouts/progression-readiness';
import { resolveTrainingTabEnabled } from '@/lib/workouts/training-release';
import { readStoredPlanEquipment } from '@/lib/workouts/plan-wizard-storage';
import { useAuthStore } from '@/stores/auth-store';

/** Same window as TrainingIdleView and useReadiness, so the sessions query is shared. */
const SESSIONS_LOOKBACK_DAYS = 90;
/** Muscle hints only for people who trained within this many days. */
const MUSCLE_HINT_RECENT_DAYS = 14;
/** body_measurements lookback for "uses measurements" and the last day. */
const MEASUREMENTS_LOOKBACK_DAYS = 365;
/** Re-evaluate the time curve every 5 minutes while open. */
const CLOCK_REFRESH_MS = 5 * 60 * 1000;

type DismissState = {
  byUser: Record<string, RecommendationDismissals>;
  dismiss: (userId: string, kind: RecommendationKind) => void;
};

/** In-memory mirror of the MMKV dismissals so every hook user re-renders. */
const useDismissStore = create<DismissState>((set) => ({
  byUser: {},
  dismiss: (userId, kind) => {
    const next = writeDismissal(recommendationStorage, userId, kind, new Date());
    set((state) => ({ byUser: { ...state.byUser, [userId]: next } }));
  },
}));

function useDismissals(userId: string | undefined): RecommendationDismissals {
  const cached = useDismissStore((state) => (userId ? state.byUser[userId] : undefined));
  return useMemo(() => {
    if (!userId) {
      return {};
    }
    return cached ?? readDismissals(recommendationStorage, userId);
  }, [cached, userId]);
}

/** Wall clock that follows the day: refreshes every few minutes and on return to the app. */
function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_REFRESH_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(new Date());
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return now;
}

function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Today's recommendations (at most three) plus `dismiss(kind)`.
 * Every input is optional: while a query loads or fails, the rules that need
 * it stay quiet and the list is simply shorter.
 */
export function useRecommendations(): {
  recommendations: Recommendation[];
  dismiss: (kind: RecommendationKind) => void;
} {
  const { t, i18n } = useTranslation();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const now = useClock();
  const todayKey = localDateKey(now);

  const dashboard = useHomeDashboard();
  const { data: profileSettings } = useProfileSettings(userId);
  const goalType = profileSettings?.profile?.goal_type ?? null;
  const goalCategory = goalCategoryForGoalType(goalType);
  const focusAreas = profileSettings?.profile?.focus_areas ?? null;
  const sessionsPerWeek = profileSettings?.profile?.training_sessions_per_week ?? null;
  const hasTrainingGoal = sessionsPerWeek != null && sessionsPerWeek >= 1;

  const { data: trainingTabFlag = false } = useFeatureFlag('training_tab');
  const trainingEnabled = resolveTrainingTabEnabled(trainingTabFlag);

  const readiness = useReadiness();
  const checkinStatus = useTodayCheckinStatus();

  const templatesQuery = useWorkoutTemplates(trainingEnabled);
  const sessionsQuery = useWorkoutSessionsRange({
    startKey: shiftLocalDateKey(todayKey, -SESSIONS_LOOKBACK_DAYS),
    endKey: todayKey,
    enabled: trainingEnabled,
  });
  const exercisesQuery = useExercises(trainingEnabled);
  // Also for nutrition-only people: the hint after a logged run lives here.
  const { data: trainingRowsWeek = [] } = useTrainingSessionsWeek(
    hasTrainingGoal || trainingEnabled,
  );
  const deloadSuggested = useDeloadSuggestion();

  const templates = useMemo(
    () => (trainingEnabled ? (templatesQuery.data ?? []) : []),
    [templatesQuery.data, trainingEnabled],
  );
  const sessions = useMemo(
    () => (trainingEnabled ? (sessionsQuery.data ?? []) : []),
    [sessionsQuery.data, trainingEnabled],
  );
  const exercises = useMemo(() => exercisesQuery.data ?? [], [exercisesQuery.data]);

  const nextTemplate = useMemo(
    () =>
      trainingEnabled
        ? pickNextTemplateForReadiness(templates, sessions, todayKey, readiness).template
        : null,
    [readiness, sessions, templates, todayKey, trainingEnabled],
  );
  const deferredProgressions = useDeferredProgressions(nextTemplate);

  const measurementsQuery = useQuery({
    // Under ['history', userId] so every measurement save refreshes it too.
    queryKey: ['history', userId, 'recommendations-measurements', todayKey],
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
    queryFn: () =>
      fetchBodyMeasurementsSince(userId!, shiftLocalDateKey(todayKey, -MEASUREMENTS_LOOKBACK_DAYS)),
  });

  const dismissals = useDismissals(userId);
  const dismissInStore = useDismissStore((state) => state.dismiss);
  const dismiss = useCallback(
    (kind: RecommendationKind) => {
      if (userId) {
        dismissInStore(userId, kind);
      }
    },
    [dismissInStore, userId],
  );

  const trainingDay = useMemo(() => {
    const weekday = isoWeekday(now);
    return isTrainingDay({
      units: templates,
      sessionDays: sessions.map((session) => session.loggedOn),
      todayKey,
      weekday,
      weekStartKey: shiftLocalDateKey(todayKey, -(weekday - 1)),
      sessionsPerWeek,
    });
  }, [now, sessions, sessionsPerWeek, templates, todayKey]);
  const trainedToday = useMemo(
    () => sessions.some((session) => session.loggedOn === todayKey),
    [sessions, todayKey],
  );

  /**
   * The last training of today: a finished unit or a logged row, whichever is
   * later. A unit shows up in both, and both say strength.
   */
  const lastTraining = useMemo(() => {
    const candidates: { kind: 'strength' | 'endurance'; atMs: number }[] = [];
    const add = (kind: 'strength' | 'endurance', at: string | null) => {
      const atMs = at == null ? NaN : Date.parse(at);
      if (Number.isFinite(atMs)) {
        candidates.push({ kind, atMs });
      }
    };
    for (const session of sessions) {
      if (session.loggedOn === todayKey) {
        add('strength', session.finishedAt);
      }
    }
    for (const row of trainingRowsWeek) {
      if (row.loggedOn === todayKey) {
        add(row.activity === 'strength' ? 'strength' : 'endurance', row.createdAt);
      }
    }
    candidates.sort((a, b) => b.atMs - a.atMs);
    return candidates[0] ?? null;
  }, [sessions, todayKey, trainingRowsWeek]);

  const nextLevel = useMemo((): NextLevelReady | null => {
    const row = deferredProgressions.find((item) => isAscentKind(item.suggestion.kind));
    if (!row) {
      return null;
    }
    return {
      exerciseId: row.exercise.id,
      exerciseName: resolveExerciseName(row.exercise, i18n.language),
    };
  }, [deferredProgressions, i18n.language]);

  const muscleDeficits = useMemo((): MuscleDeficit[] => {
    if (templates.length === 0 || exercises.length === 0) {
      return [];
    }
    const recentFrom = shiftLocalDateKey(todayKey, -MUSCLE_HINT_RECENT_DAYS);
    if (!sessions.some((session) => session.loggedOn >= recentFrom)) {
      return [];
    }
    const sessionDays = sessions
      .filter((session) => session.sets.length > 0)
      .map((session) => session.loggedOn);
    if (!hasEnoughMuscleData(sessionDays, todayKey)) {
      return [];
    }
    try {
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
      const lookup = (exerciseId: string) => byId.get(exerciseId);
      const setInputs: MuscleSetInput[] = sessions.flatMap((session) =>
        session.sets.map((set) => ({
          exerciseId: set.exerciseId,
          loggedOn: session.loggedOn,
          reps: set.reps,
          seconds: set.seconds,
          rir: (set as { rir?: number | null }).rir ?? null,
        })),
      );
      const counts7 = countMuscleSets({ sets: setInputs, resolve: lookup, todayKey, days: 7 });
      const counts30 = countMuscleSets({ sets: setInputs, resolve: lookup, todayKey, days: 30 });
      const groups = visibleMuscleGroups([
        counts30,
        ...templates.map((unit) => unitMuscleProfile(unit, lookup)),
      ]);
      const rows = muscleStatus(counts7, weeklySetTarget(goalType), groups);
      const recentSets = sessions.flatMap((session) =>
        session.sets.map((set) => ({ exerciseId: set.exerciseId, completedAt: set.completedAt })),
      );
      return recommendForMuscles(rows, {
        units: templates,
        recentSets,
        exercises,
        equipment: readStoredPlanEquipment(userId),
      }).map((rec) => ({
        group: rec.group,
        groupName: t(`muscles.groups.${rec.group}`),
        setsToAdd: rec.setsToAdd,
        exerciseId: rec.exercise.id,
        exerciseName: resolveExerciseName(rec.exercise, i18n.language),
      }));
    } catch (error) {
      console.error('[useRecommendations] muscle deficits failed:', error);
      return [];
    }
  }, [exercises, goalType, i18n.language, sessions, t, templates, todayKey]);

  const dashboardData = dashboard.data;
  const measurementRows = measurementsQuery.data;

  const recommendations = useMemo(() => {
    if (!userId) {
      return [];
    }
    const goal = dashboardData?.latestCalorieGoal ?? null;
    const macros = dashboardData?.consumedMacrosToday ?? null;
    // No meals yet today: the macros read null, but nothing eaten is a known 0.
    const nothingLogged = dashboardData != null && dashboardData.consumedCaloriesToday === 0;
    const consumed =
      dashboardData && macros
        ? {
            proteinG: macros.proteinG ?? (nothingLogged ? 0 : null),
            carbsG: macros.carbsG ?? (nothingLogged ? 0 : null),
            fiberG: macros.fiberG ?? (nothingLogged ? 0 : null),
            fatG: macros.fatG ?? (nothingLogged ? 0 : null),
          }
        : null;
    const latestWeight = dashboardData?.latestWeight ?? null;
    const measuredOn = (measurementRows ?? []).map((row) => row.measured_on).sort();

    try {
      return buildRecommendations({
        goalCategory,
        hour: now.getHours(),
        minute: now.getMinutes(),
        todayKey,
        nowMs: now.getTime(),
        trainingDay: trainingEnabled && trainingDay,
        trainedToday,
        trainedTodayKind: lastTraining?.kind ?? null,
        hoursSinceTraining:
          lastTraining == null ? null : (now.getTime() - lastTraining.atMs) / 3_600_000,
        focusAreas,
        deloadSuggested,
        consumed,
        targets: goal
          ? {
              kcal: goal.daily_calorie_goal,
              proteinG: goal.protein_g,
              carbsG: goal.carbs_g,
              fiberG: goal.fiber_g,
              fatG: goal.fat_g,
            }
          : null,
        readiness: trainingEnabled ? (readiness?.level ?? null) : null,
        nextLevel: trainingEnabled ? nextLevel : null,
        muscleDeficits: trainingEnabled ? muscleDeficits : [],
        lastWeightDateKey:
          dashboardData == null
            ? undefined
            : latestWeight
              ? localDateKey(new Date(latestWeight.logged_at))
              : null,
        lastMeasurementDateKey:
          measurementRows == null ? undefined : (measuredOn[measuredOn.length - 1] ?? null),
        usesMeasurements: measurementRows != null && usesMeasurementsCore(measurementRows),
        checkinStatus,
        dismissals,
      });
    } catch (error) {
      console.error('[useRecommendations] build failed:', error);
      return [];
    }
  }, [
    checkinStatus,
    dashboardData,
    deloadSuggested,
    dismissals,
    focusAreas,
    goalCategory,
    lastTraining,
    measurementRows,
    muscleDeficits,
    nextLevel,
    now,
    readiness?.level,
    todayKey,
    trainedToday,
    trainingDay,
    trainingEnabled,
    userId,
  ]);

  return { recommendations, dismiss };
}
