import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import {
  fetchCheckinSettings,
  fetchRecentCheckins,
  saveCheckin,
  updateCheckinSettings,
  UNAVAILABLE_CHECKIN_SETTINGS,
  type CheckinSettings,
} from '@/lib/checkin/checkin-api';
import { readCheckinSkippedOn, writeCheckinSkippedOn } from '@/lib/checkin/checkin-local';
import { syncCheckinReminder } from '@/lib/checkin/checkin-reminder';
import { resolveTodayCheckinStatus, type TodayCheckinStatus } from '@/lib/checkin/checkin-status';
import {
  computeReadiness,
  type CheckinAnswers,
  type DailyCheckin,
  type ReadinessNutritionDay,
  type ReadinessResult,
} from '@/lib/checkin/readiness';
import { localDateKey, shiftLocalDateKey } from '@/lib/day-window';
import { fetchHistoryData } from '@/lib/history';
import { pickNextTemplate } from '@/lib/workouts/next-template';
import { useAuthStore } from '@/stores/auth-store';

export const checkinQueryKeys = {
  settings: (userId: string) => ['checkin-settings', userId] as const,
  recent: (userId: string, todayKey: string) => ['checkin-recent', userId, todayKey] as const,
  recentAll: (userId: string) => ['checkin-recent', userId] as const,
};

/** Same window as TrainingIdleView, so the sessions query is shared. */
const SESSIONS_LOOKBACK_DAYS = 90;
/** Today + the 14 check-ins before it, with some room for gaps. */
const CHECKIN_LOOKBACK_DAYS = 30;

type SkipState = {
  byUser: Record<string, string | null>;
  skip: (userId: string, dateKey: string) => void;
};

/** In-memory mirror of the MMKV "Heute nicht" day so every hook user re-renders. */
const useSkipStore = create<SkipState>((set) => ({
  byUser: {},
  skip: (userId, dateKey) => {
    writeCheckinSkippedOn(userId, dateKey);
    set((state) => ({ byUser: { ...state.byUser, [userId]: dateKey } }));
  },
}));

function useSkippedOn(userId: string | undefined): string | null {
  const cached = useSkipStore((state) => (userId ? state.byUser[userId] : undefined));
  if (!userId) {
    return null;
  }
  return cached !== undefined ? cached : readCheckinSkippedOn(userId);
}

type OpenRequestState = {
  /** Local day on which the questions were asked for (recommendation "Check-in starten"). */
  requestedOn: string | null;
  request: (dateKey: string) => void;
};

const useOpenRequestStore = create<OpenRequestState>((set) => ({
  requestedOn: null,
  request: (dateKey) => set({ requestedOn: dateKey }),
}));

/** Shows the check-in questions again today, also after the 12:00 window. */
export function useRequestCheckinQuestions() {
  const request = useOpenRequestStore((state) => state.request);
  return useCallback(() => request(localDateKey()), [request]);
}

export function useCheckinQuestionsRequested(): boolean {
  const requestedOn = useOpenRequestStore((state) => state.requestedOn);
  return requestedOn != null && requestedOn === localDateKey();
}

export function useCheckinSettings() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  return useQuery({
    queryKey: userId ? checkinQueryKeys.settings(userId) : ['checkin-settings'],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchCheckinSettings(userId!),
  });
}

export function useRecentCheckins(todayKey: string = localDateKey()) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const settings = useCheckinSettings();
  const available = settings.data?.available === true;
  return useQuery({
    queryKey: userId ? checkinQueryKeys.recent(userId, todayKey) : ['checkin-recent'],
    enabled: Boolean(userId) && available,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchRecentCheckins(userId!, shiftLocalDateKey(todayKey, -CHECKIN_LOOKBACK_DAYS)),
  });
}

export type TodayCheckinState = {
  status: TodayCheckinStatus;
  todayCheckin: DailyCheckin | null;
  /** Still loading settings or check-ins; status is "disabled" meanwhile. */
  isLoading: boolean;
};

/**
 * answered / skipped / open / disabled for today — e.g. for "Check-in noch
 * offen" in the recommendations.
 */
export function useTodayCheckinState(): TodayCheckinState {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const todayKey = localDateKey();
  const settings = useCheckinSettings();
  const recent = useRecentCheckins(todayKey);
  const skippedOn = useSkippedOn(userId);
  const data = settings.data ?? UNAVAILABLE_CHECKIN_SETTINGS;
  const todayCheckin = recent.data?.find((entry) => entry.date === todayKey) ?? null;
  const isLoading = settings.isLoading || (data.available && recent.isLoading);

  const status = isLoading
    ? 'disabled'
    : resolveTodayCheckinStatus({
        available: data.available,
        enabled: data.enabled,
        answeredToday: todayCheckin != null,
        skippedOn,
        todayKey,
      });
  return { status, todayCheckin, isLoading };
}

export function useTodayCheckinStatus(): TodayCheckinStatus {
  return useTodayCheckinState().status;
}

export function useSkipCheckinToday() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const skip = useSkipStore((state) => state.skip);
  return useCallback(() => {
    if (userId) {
      skip(userId, localDateKey());
    }
  }, [skip, userId]);
}

export function useSaveCheckin() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: CheckinAnswers) => {
      if (!userId) {
        throw new Error('Missing user id');
      }
      await saveCheckin(userId, localDateKey(), answers);
    },
    onSuccess: async () => {
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: checkinQueryKeys.recentAll(userId) });
      }
    },
  });
}

export function useUpdateCheckinSettings() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { enabled?: boolean; reminderTime?: string | null }) => {
      if (!userId) {
        throw new Error('Missing user id');
      }
      await updateCheckinSettings(userId, patch);
      return patch;
    },
    onMutate: async (patch) => {
      if (!userId) {
        return;
      }
      const key = checkinQueryKeys.settings(userId);
      const previous = queryClient.getQueryData<CheckinSettings>(key);
      if (previous) {
        const next: CheckinSettings = {
          ...previous,
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.reminderTime !== undefined ? { reminderTime: patch.reminderTime } : {}),
        };
        queryClient.setQueryData(key, next);
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (userId && context?.previous) {
        queryClient.setQueryData(checkinQueryKeys.settings(userId), context.previous);
      }
    },
    onSettled: async () => {
      if (!userId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: checkinQueryKeys.settings(userId) });
      const settings = queryClient.getQueryData<CheckinSettings>(checkinQueryKeys.settings(userId));
      if (settings) {
        await syncCheckinReminder(settings);
      }
    },
  });
}

/**
 * Re-schedules (or cancels) the daily reminder once the settings are known —
 * on every app start and after sign-in. Signed out, the reminder is cancelled.
 */
export function useCheckinReminderSync(userId: string | null) {
  const settings = useCheckinSettings();
  const data = settings.data;
  const available = data?.available;
  const enabled = data?.enabled;
  const reminderTime = data?.reminderTime;
  useEffect(() => {
    if (!userId) {
      void syncCheckinReminder(UNAVAILABLE_CHECKIN_SETTINGS);
      return;
    }
    if (available == null || enabled == null) {
      return;
    }
    void syncCheckinReminder({ available, enabled, reminderTime: reminderTime ?? null });
  }, [userId, available, enabled, reminderTime]);
}

function useReadinessNutrition(userId: string | undefined, todayKey: string) {
  return useQuery({
    // Under the 'history' prefix so meal saves and the day rollover refresh it.
    queryKey: ['history', userId, 'readiness', todayKey],
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ReadinessNutritionDay[]> => {
      const data = await fetchHistoryData(userId!, 7);
      return data.days.map((day) => ({
        date: day.date,
        calories: day.hasMeals ? day.totalCalories : null,
        calorieTarget: day.scaledGoal?.calorieGoal ?? day.goal?.dailyCalorieGoal ?? null,
        proteinG: day.hasMeals ? day.macros.proteinG : null,
        proteinTargetG: day.scaledGoal?.proteinG ?? day.goal?.proteinG ?? null,
      }));
    },
  });
}

/**
 * Today's readiness (bereit · normal · schonen). null while the check-in is
 * unavailable (migration not run) or data is still loading — callers then
 * behave exactly as before.
 */
export function useReadiness(): ReadinessResult | null {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const todayKey = localDateKey();
  const settings = useCheckinSettings();
  const available = settings.data?.available === true;
  const recent = useRecentCheckins(todayKey);
  const sessionsQuery = useWorkoutSessionsRange({
    startKey: shiftLocalDateKey(todayKey, -SESSIONS_LOOKBACK_DAYS),
    endKey: todayKey,
    enabled: available,
  });
  const templatesQuery = useWorkoutTemplates(available);
  const nutritionQuery = useReadinessNutrition(available ? userId : undefined, todayKey);

  return useMemo(() => {
    if (!available || recent.data == null || sessionsQuery.data == null) {
      return null;
    }
    const checkins = recent.data;
    const today = checkins.find((entry) => entry.date === todayKey) ?? null;
    const sessions = sessionsQuery.data;
    const planned = pickNextTemplate(templatesQuery.data ?? [], sessions, todayKey);
    return computeReadiness({
      todayKey,
      checkin: today,
      pastCheckins: checkins.filter((entry) => entry.date < todayKey),
      sessions,
      nutrition: nutritionQuery.data ?? [],
      // Muscle profiles arrive with another block; until then only the
      // general soreness hint is possible.
      plannedUnit: planned ? { id: planned.id, name: planned.name, muscles: [] } : null,
    });
  }, [
    available,
    recent.data,
    sessionsQuery.data,
    templatesQuery.data,
    nutritionQuery.data,
    todayKey,
  ]);
}
