import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useExercises } from '@/hooks/use-exercises';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { localDateKey, shiftLocalDateKey } from '@/lib/day-window';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import {
  computeSkillGoalForecast,
  type SkillGoalForecast,
} from '@/lib/workouts/skill-goal-forecast';
import {
  fetchActiveSkillGoal,
  markSkillGoalAchieved,
  type SkillGoal,
} from '@/lib/workouts/skill-goals-api';
import type { Exercise } from '@/lib/workouts/types';
import { useAuthStore } from '@/stores/auth-store';

/** Same window as the training tab's session query, so both share the cache. */
export const SKILL_GOAL_SESSIONS_DAYS = 90;

export type SkillGoalView = {
  /** False until the migration has run: render nothing. */
  available: boolean;
  goal: SkillGoal | null;
  exercise: Exercise | null;
  forecast: SkillGoalForecast | null;
  exercises: Exercise[];
  /** Exercise ids trained in the session window, newest first. */
  recentExerciseIds: string[];
};

export function useSkillGoalState() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  return useQuery({
    queryKey: userId ? workoutQueryKeys.skillGoal(userId) : ['workout-skill-goal'],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: fetchActiveSkillGoal,
  });
}

export function useSkillGoal(): SkillGoalView {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const queryClient = useQueryClient();
  const todayKey = localDateKey();
  const startKey = shiftLocalDateKey(todayKey, -SKILL_GOAL_SESSIONS_DAYS);
  const { data: state } = useSkillGoalState();
  const available = state?.available === true;
  const goal = state?.goal ?? null;
  const { data: exercises = [] } = useExercises(available);
  const { data: sessions = [] } = useWorkoutSessionsRange({
    startKey,
    endKey: todayKey,
    enabled: available,
  });

  const exercise = useMemo(
    () => (goal ? (exercises.find((row) => row.id === goal.exerciseId) ?? null) : null),
    [exercises, goal],
  );

  const forecast = useMemo(() => {
    if (!goal || !exercise) {
      return null;
    }
    return computeSkillGoalForecast({
      goalExerciseId: goal.exerciseId,
      targetValue: goal.targetValue,
      exercises,
      units: sessions,
      todayKey,
      sinceKey: goal.createdAt ? localDateKey(new Date(goal.createdAt)) : null,
    });
  }, [exercise, exercises, goal, sessions, todayKey]);

  const recentExerciseIds = useMemo(() => {
    const ordered = sessions
      .slice()
      .sort((a, b) => b.loggedOn.localeCompare(a.loggedOn))
      .flatMap((session) => session.sets.map((set) => set.exerciseId))
      .filter((id): id is string => id != null);
    return [...new Set(ordered)];
  }, [sessions]);

  const reachedNow = forecast?.status === 'achieved' && goal != null && goal.achievedAt == null;
  useEffect(() => {
    if (!reachedNow || !goal || !userId) {
      return;
    }
    void markSkillGoalAchieved(goal.id)
      .then(() => queryClient.invalidateQueries({ queryKey: workoutQueryKeys.skillGoal(userId) }))
      .catch(() => undefined);
  }, [goal, queryClient, reachedNow, userId]);

  return { available, goal, exercise, forecast, exercises, recentExerciseIds };
}
