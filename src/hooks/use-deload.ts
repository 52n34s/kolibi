import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useRecentCheckins } from '@/hooks/use-checkin';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import {
  checkinBaseline,
  rateCheckin,
  READINESS_RULES,
  type DailyCheckin,
  type ReadinessLevel,
} from '@/lib/checkin/readiness';
import { localDateKey, parseDateOnly, shiftLocalDateKey } from '@/lib/day-window';
import {
  dismissDeloadSuggestion,
  endDeload,
  hasDeloadColumns,
  startDeload,
} from '@/lib/profile';
import { profileSettingsQueryKey } from '@/lib/profile-settings-cache';
import {
  deloadSets,
  DELOAD_RULES,
  isDeloadActive,
  suggestDeload,
  type DeloadContext,
  type DeloadReadinessDay,
  type DeloadWeek,
} from '@/lib/workouts/deload';
import { bestSetByExercise } from '@/lib/workouts/progress';
import { resolveTrainingTabEnabled } from '@/lib/workouts/training-release';
import type { WorkoutSession, WorkoutTemplate } from '@/lib/workouts/types';
import { useAuthStore } from '@/stores/auth-store';

/** Same window as useRecommendations and useReadiness, so the query is shared. */
const SESSIONS_LOOKBACK_DAYS = 90;
/** A lighter week runs from today to today + 6 (one calendar week). */
export const DELOAD_WEEK_DAYS = 7;

/** True once profiles.deload_until exists — without it nothing can be stored. */
function useDeloadAvailable(): boolean {
  const query = useQuery({
    queryKey: ['schema-capability', 'profiles-deload'],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => hasDeloadColumns(),
  });
  return query.data === true;
}

export type DeloadWeekState = {
  /** The migration ran; the lighter week can be started and ended. */
  available: boolean;
  /** Local date key the week ends on; null = none. */
  deloadUntil: string | null;
  /** A week is running today (a past end date counts as over). */
  isActive: boolean;
  start: () => Promise<void>;
  dismiss: () => Promise<void>;
  end: () => Promise<void>;
};

/**
 * The running lighter week and the three writes around it. Everything reads
 * from the profile query, so starting or ending it updates every screen.
 */
export function useDeloadWeek(): DeloadWeekState {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const queryClient = useQueryClient();
  const available = useDeloadAvailable();
  const { data } = useProfileSettings(userId);
  const todayKey = localDateKey();
  const deloadUntil = data?.profile?.deload_until ?? null;

  const refresh = useCallback(async () => {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: profileSettingsQueryKey(userId) });
    }
  }, [queryClient, userId]);

  const start = useCallback(async () => {
    if (!userId) {
      return;
    }
    await startDeload({
      userId,
      deloadUntil: shiftLocalDateKey(todayKey, DELOAD_WEEK_DAYS - 1),
    });
    await refresh();
  }, [refresh, todayKey, userId]);

  const dismiss = useCallback(async () => {
    if (!userId) {
      return;
    }
    await dismissDeloadSuggestion(userId);
    await refresh();
  }, [refresh, userId]);

  const end = useCallback(async () => {
    if (!userId) {
      return;
    }
    await endDeload(userId);
    await refresh();
  }, [refresh, userId]);

  return {
    available,
    deloadUntil,
    isActive: isDeloadActive(deloadUntil, todayKey),
    start,
    dismiss,
    end,
  };
}

/** Just the flag, for the screens that only need to know whether one runs. */
export function useIsDeloadActive(): boolean {
  return useDeloadWeek().isActive;
}

/** "3. Okt." for the banner and the goals row. */
export function deloadUntilLabel(dateKey: string, locale: string): string {
  return parseDateOnly(dateKey).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export { lighterTemplate } from '@/lib/workouts/deload';

/** Monday of the week containing `dateKey`. */
function mondayKey(dateKey: string): string {
  const weekday = parseDateOnly(dateKey).getDay();
  return shiftLocalDateKey(dateKey, -(weekday === 0 ? 6 : weekday - 1));
}

function weekVolumes(sessions: readonly WorkoutSession[], todayKey: string): DeloadWeek[] {
  const thisMonday = mondayKey(todayKey);
  const weeks: DeloadWeek[] = [];
  for (let back = DELOAD_RULES.minWeeksContinuousTraining - 1; back >= 0; back -= 1) {
    const weekStartKey = shiftLocalDateKey(thisMonday, -back * 7);
    const weekEndKey = shiftLocalDateKey(weekStartKey, 6);
    const setCount = sessions
      .filter((session) => session.loggedOn >= weekStartKey && session.loggedOn <= weekEndKey)
      .reduce((acc, session) => acc + session.sets.length, 0);
    weeks.push({ weekStartKey, setCount });
  }
  return weeks;
}

/**
 * The last days as the deload rules read them: a check-in rated "low" is the
 * gentle day. Days without a check-in say nothing.
 */
function recentReadiness(checkins: readonly DailyCheckin[], todayKey: string): DeloadReadinessDay[] {
  const out: DeloadReadinessDay[] = [];
  for (let back = 0; back < DELOAD_RULES.lookbackGentleDays; back += 1) {
    const dateKey = shiftLocalDateKey(todayKey, -back);
    const checkin = checkins.find((entry) => entry.date === dateKey);
    let level: ReadinessLevel | null = null;
    if (checkin) {
      const { baseline } = checkinBaseline(checkins, dateKey);
      level = rateCheckin(checkin, baseline) === 'low' ? 'gentle' : 'normal';
    }
    out.push({ dateKey, level });
  }
  return out;
}

/** Finished units with sets, oldest first. */
function finishedUnits(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((session) => session.finishedAt != null && session.sets.length > 0)
    .sort(
      (a, b) =>
        a.loggedOn.localeCompare(b.loggedOn) || a.startedAt.localeCompare(b.startedAt),
    );
}

function unitExercises(session: WorkoutSession) {
  return bestSetByExercise(session.sets)
    .filter((best) => best.exerciseId != null)
    .map((best) => ({ exerciseId: best.exerciseId!, bestLoadOrReps: best.value }));
}

/**
 * Whether a lighter week is worth offering today (see deload.ts for the two
 * criteria). Every input is optional: while a query loads the answer is no.
 */
export function useDeloadSuggestion(): boolean {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const { available, deloadUntil } = useDeloadWeek();
  const { data: profileData } = useProfileSettings(userId);
  const { data: trainingTabFlag = false } = useFeatureFlag('training_tab');
  const trainingEnabled = resolveTrainingTabEnabled(trainingTabFlag);
  const todayKey = localDateKey();

  const sessionsQuery = useWorkoutSessionsRange({
    startKey: shiftLocalDateKey(todayKey, -SESSIONS_LOOKBACK_DAYS),
    endKey: todayKey,
    enabled: trainingEnabled && available,
  });
  const checkinsQuery = useRecentCheckins(todayKey);

  const sessions = sessionsQuery.data;
  const checkins = checkinsQuery.data;
  const lastSuggestedAt = profileData?.profile?.deload_suggested_at ?? null;

  return useMemo(() => {
    if (!available || !trainingEnabled || sessions == null) {
      return false;
    }
    const rows = checkins ?? [];
    // "Usual" is the whole check-in window, the same bar readiness uses for
    // knowing someone: below that there is no personal average to compare to.
    const averages =
      rows.length >= READINESS_RULES.baselineMin
        ? {
            energy: rows.reduce((acc, row) => acc + row.energy, 0) / rows.length,
            soreness: rows.reduce((acc, row) => acc + row.soreness, 0) / rows.length,
          }
        : null;
    const units = finishedUnits(sessions);
    const recentUnits = units.slice(-DELOAD_RULES.performanceDropUnits);
    const recentIds = new Set(recentUnits.map((session) => session.id));
    const historyByExercise = new Map<string, number[]>();
    for (const session of units) {
      if (recentIds.has(session.id)) {
        continue;
      }
      for (const exercise of unitExercises(session)) {
        const values = historyByExercise.get(exercise.exerciseId) ?? [];
        values.push(exercise.bestLoadOrReps);
        historyByExercise.set(exercise.exerciseId, values);
      }
    }

    const context: DeloadContext = {
      nowMs: Date.now(),
      todayKey,
      lastSuggestedAt,
      deloadUntil,
      trainingDayKeys: [...new Set(units.map((session) => session.loggedOn))],
      weekVolumes: weekVolumes(sessions, todayKey),
      recentReadiness: recentReadiness(rows, todayKey),
      recentUnits: recentUnits.map((session) => ({ exercises: unitExercises(session) })),
      exerciseHistory: [...historyByExercise.entries()].map(([exerciseId, values]) => ({
        exerciseId,
        values,
      })),
      recentCheckins: rows.map((row) => ({ energy: row.energy, soreness: row.soreness })),
      checkinAverages: averages,
    };

    try {
      return suggestDeload(context).shouldSuggest;
    } catch (error) {
      console.error('[useDeloadSuggestion] build failed:', error);
      return false;
    }
  }, [available, checkins, deloadUntil, lastSuggestedAt, sessions, todayKey, trainingEnabled]);
}
