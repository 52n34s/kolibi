import { fetchTodayConsumedCalories, type TodayConsumedMacros } from '@/lib/meals';
import type { MovementGoalPeriod, MovementGoalType } from '@/lib/profile';
import {
  CalorieSource,
  resolveDailyGoalFloor,
  resolveEffectiveDailyCalorieGoal,
} from '@/lib/calorie-goal-math';
import { supabase } from '@/lib/supabase';

export type HomeProfile = {
  calorie_goal_source: 'calculated' | 'custom' | null;
  target_weight_kg: number | null;
  diet_preference: string | null;
  movement_goal_type: MovementGoalType | null;
  movement_goal_value: number | null;
  movement_goal_period: MovementGoalPeriod | null;
  birth_date: string | null;
  training_sessions_per_week: number | null;
};

export type HomeCalorieGoal = {
  daily_calorie_goal: number;
  effective_from: string;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  macro_goal_source: string | null;
};

export type HomeLatestWeight = {
  weight_kg: number;
  logged_at: string;
};

export type HomeDashboardData = {
  profile: HomeProfile | null;
  latestCalorieGoal: HomeCalorieGoal | null;
  latestWeight: HomeLatestWeight | null;
  /** Oldest weight_logs row (optionally from progress_start_date) — Home weight progress baseline. */
  startWeightKg: number | null;
  /** `YYYY-MM-DD` from profiles.progress_start_date, else null. */
  progressStartDate: string | null;
  /** Chronological weigh-ins for `resolveDisplayWeight`. */
  weightLogs: HomeLatestWeight[];
  consumedCaloriesToday: number;
  consumedMacrosToday: TodayConsumedMacros;
};

const EMPTY_MACROS: TodayConsumedMacros = {
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
};

export async function fetchHomeDashboard(userId: string): Promise<HomeDashboardData> {
  const [profileResult, calorieGoalResult, weightLogsResult, consumptionResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'calorie_goal_source, target_weight_kg, diet_preference, movement_goal_type, movement_goal_value, movement_goal_period, progress_start_date, birth_date, training_sessions_per_week',
      )
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('calorie_goals')
      .select(
        'daily_calorie_goal, effective_from, protein_g, fat_g, carbs_g, fiber_g, macro_goal_source',
      )
      .eq('user_id', userId)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: true }),
    fetchTodayConsumedCalories(userId).catch(() => ({
      kcal: 0,
      ...EMPTY_MACROS,
    })),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (calorieGoalResult.error) {
    throw calorieGoalResult.error;
  }

  if (weightLogsResult.error) {
    throw weightLogsResult.error;
  }

  const progressStartDate =
    typeof profileResult.data?.progress_start_date === 'string'
      ? profileResult.data.progress_start_date
      : null;

  const weightLogs: HomeLatestWeight[] = (weightLogsResult.data ?? [])
    .map((row) => ({
      weight_kg: Number(row.weight_kg),
      logged_at: String(row.logged_at),
    }))
    .filter((row) => Number.isFinite(row.weight_kg));

  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1]! : null;
  const startLog =
    progressStartDate == null
      ? weightLogs[0]
      : weightLogs.find((row) => localDateKeyFromLoggedAt(row.logged_at) >= progressStartDate);
  const startWeightKg = startLog?.weight_kg ?? null;

  return {
    profile: profileResult.data
      ? {
          calorie_goal_source: profileResult.data.calorie_goal_source,
          target_weight_kg: profileResult.data.target_weight_kg,
          diet_preference: profileResult.data.diet_preference ?? null,
          movement_goal_type: parseMovementGoalType(profileResult.data.movement_goal_type),
          movement_goal_value: parseMovementGoalValue(profileResult.data.movement_goal_value),
          movement_goal_period: parseMovementGoalPeriod(
            profileResult.data.movement_goal_period,
          ),
          birth_date:
            typeof profileResult.data.birth_date === 'string'
              ? profileResult.data.birth_date
              : null,
          training_sessions_per_week: (() => {
            const raw = profileResult.data.training_sessions_per_week;
            if (raw == null) {
              return null;
            }
            const parsed = Number(raw);
            return Number.isFinite(parsed) && parsed >= 1 && parsed <= 14 ? parsed : null;
          })(),
        }
      : null,
    latestCalorieGoal: calorieGoalResult.data
      ? {
          daily_calorie_goal: Number(calorieGoalResult.data.daily_calorie_goal),
          effective_from: calorieGoalResult.data.effective_from,
          protein_g:
            calorieGoalResult.data.protein_g == null
              ? null
              : Number(calorieGoalResult.data.protein_g),
          fat_g:
            calorieGoalResult.data.fat_g == null
              ? null
              : Number(calorieGoalResult.data.fat_g),
          carbs_g:
            calorieGoalResult.data.carbs_g == null
              ? null
              : Number(calorieGoalResult.data.carbs_g),
          fiber_g:
            calorieGoalResult.data.fiber_g == null
              ? null
              : Number(calorieGoalResult.data.fiber_g),
          macro_goal_source: calorieGoalResult.data.macro_goal_source ?? null,
        }
      : null,
    latestWeight,
    startWeightKg:
      startWeightKg != null && Number.isFinite(startWeightKg) ? startWeightKg : null,
    progressStartDate,
    weightLogs,
    consumedCaloriesToday: consumptionResult.kcal,
    consumedMacrosToday: {
      proteinG: consumptionResult.proteinG,
      carbsG: consumptionResult.carbsG,
      fatG: consumptionResult.fatG,
      fiberG: consumptionResult.fiberG,
    },
  };
}

function localDateKeyFromLoggedAt(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseMovementGoalType(value: unknown): MovementGoalType | null {
  if (value === 'steps' || value === 'running_km' || value === 'distance_km') {
    return value;
  }
  return null;
}

function parseMovementGoalPeriod(value: unknown): MovementGoalPeriod | null {
  if (value === 'day' || value === 'week') {
    return value;
  }
  return null;
}

function parseMovementGoalValue(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  mode?: 'static' | 'dynamic';
  activeEnergyBurned?: number;
};

export function getCalorieGoalDisplay(
  dailyGoal: number,
  consumedToday: number,
  bmr?: number | null,
): CalorieGoalDisplay {
  const flooredGoal = Math.max(dailyGoal, resolveDailyGoalFloor(bmr));
  const remaining = flooredGoal - consumedToday;
  const isOverGoal = remaining < 0;
  const overAmount = isOverGoal ? Math.abs(remaining) : 0;

  return {
    dailyGoal: flooredGoal,
    consumedToday,
    remaining,
    isOverGoal,
    overAmount,
    mainValue: isOverGoal ? overAmount : remaining,
    dailyGoalContextValue: flooredGoal,
    showOverLabel: isOverGoal,
    mode: 'static',
  };
}

export function getDynamicCalorieGoalDisplay(
  dailyGoal: number,
  consumedToday: number,
  activeEnergyBurned: number,
  bmr?: number | null,
): CalorieGoalDisplay {
  const activeEnergy = Math.max(0, activeEnergyBurned);
  const effectiveDailyGoal = resolveEffectiveDailyCalorieGoal({
    calorieSource: CalorieSource.HEALTH,
    baseDailyGoal: dailyGoal,
    activeEnergyBurnedKcal: activeEnergy,
    bmr,
  });
  const display = getCalorieGoalDisplay(effectiveDailyGoal, consumedToday);

  return {
    ...display,
    // The floor may have lifted the target — keep base + active energy equal to
    // what is shown, because the UI renders that sum.
    dailyGoal: effectiveDailyGoal - activeEnergy,
    dailyGoalContextValue: effectiveDailyGoal - activeEnergy,
    mode: 'dynamic',
    activeEnergyBurned: activeEnergy,
  };
}
