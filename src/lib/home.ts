import { fetchTodayConsumedCalories } from '@/lib/meals';
import { supabase } from '@/lib/supabase';

export type HomeProfile = {
  calorie_goal_source: 'calculated' | 'custom' | null;
  target_weight_kg: number | null;
};

export type HomeCalorieGoal = {
  daily_calorie_goal: number;
  effective_from: string;
};

export type HomeLatestWeight = {
  weight_kg: number;
  logged_at: string;
};

export type HomeDashboardData = {
  profile: HomeProfile | null;
  latestCalorieGoal: HomeCalorieGoal | null;
  latestWeight: HomeLatestWeight | null;
  consumedCaloriesToday: number;
};

export async function fetchHomeDashboard(userId: string): Promise<HomeDashboardData> {
  const [profileResult, calorieGoalResult, weightResult, consumedCaloriesToday] = await Promise.all([
    supabase
      .from('profiles')
      .select('calorie_goal_source, target_weight_kg')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('calorie_goals')
      .select('daily_calorie_goal, effective_from')
      .eq('user_id', userId)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchTodayConsumedCalories(userId).catch(() => 0),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (calorieGoalResult.error) {
    throw calorieGoalResult.error;
  }

  if (weightResult.error) {
    throw weightResult.error;
  }

  return {
    profile: profileResult.data,
    latestCalorieGoal: calorieGoalResult.data,
    latestWeight: weightResult.data,
    consumedCaloriesToday,
  };
}

export function resolveDisplayName(params: {
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
}): string | null {
  const trimmedFullName = params.fullName?.trim();
  if (trimmedFullName) {
    return trimmedFullName;
  }

  const trimmedName = params.name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  const emailLocalPart = params.email?.split('@')[0]?.trim();
  return emailLocalPart || null;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export function getTimeOfDay(date = new Date()): TimeOfDay {
  const hour = date.getHours();

  if (hour < 12) {
    return 'morning';
  }

  if (hour < 18) {
    return 'afternoon';
  }

  return 'evening';
}

export type CalorieGoalDisplay = {
  dailyGoal: number;
  consumedToday: number;
  remaining: number;
  isOverGoal: boolean;
  overAmount: number;
  mainValue: number;
  /** Shared label-style context line for both normal and over-goal states. */
  dailyGoalContextValue: number;
  showOverLabel: boolean;
};

export function getCalorieGoalDisplay(
  dailyGoal: number,
  consumedToday: number,
): CalorieGoalDisplay {
  const remaining = dailyGoal - consumedToday;
  const isOverGoal = remaining < 0;
  const overAmount = isOverGoal ? Math.abs(remaining) : 0;

  return {
    dailyGoal,
    consumedToday,
    remaining,
    isOverGoal,
    overAmount,
    mainValue: isOverGoal ? overAmount : remaining,
    dailyGoalContextValue: dailyGoal,
    showOverLabel: isOverGoal,
  };
}
