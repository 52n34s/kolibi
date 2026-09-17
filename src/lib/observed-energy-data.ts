import { localDateKey, localDayWindow, parseDateOnly } from '@/lib/day-window';
import {
  applyGoalAdjustment,
  calculateMaintenanceCalories,
  CalorieSource,
  HARD_MINIMUM_DAILY_CALORIES,
  type ActivityLevel,
  type BiologicalSex,
  type GoalType,
} from '@/lib/calorie-goal-math';
import { upsertDailyCalorieGoal } from '@/lib/calorie-goals';
import {
  buildObservedWindowDateKeys,
  computeObservedEnergy,
  OBSERVED_WINDOW_DAYS,
  type ObservedEnergyResult,
  type ObservedMealInput,
  type ObservedWeightInput,
} from '@/lib/observed-energy';
import { WEIGHT_ETA_MA_WINDOW_DAYS } from '@/lib/weight-goal-eta';
import { supabase } from '@/lib/supabase';

export type ObservedEnergyEstimate = ObservedEnergyResult & {
  /** BMR×activity (or Health BMR) maintenance used for comparison / plausibility. */
  estimatedMaintenanceKcal: number;
};

/**
 * Loads meals + weights for the closed 28-day window and computes observed energy.
 */
export async function fetchObservedEnergyEstimate(params: {
  userId: string;
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  healthConnected: boolean;
  today?: Date;
}): Promise<ObservedEnergyEstimate> {
  const today = params.today ?? new Date();
  const dateKeys = buildObservedWindowDateKeys(today);
  const windowStart = parseDateOnly(dateKeys[0]!);
  const windowEnd = parseDateOnly(dateKeys[dateKeys.length - 1]!);
  const mealsFrom = localDayWindow(windowStart).startISO;
  const mealsTo = localDayWindow(windowEnd).endISO;

  const weightLookback = new Date(windowStart);
  weightLookback.setDate(weightLookback.getDate() - (WEIGHT_ETA_MA_WINDOW_DAYS - 1));
  const weightFrom = localDayWindow(weightLookback).startISO;

  const [mealsResult, weightsResult] = await Promise.all([
    supabase
      .from('meals')
      .select('eaten_at, total_kcal, total_protein_g')
      .eq('user_id', params.userId)
      .gte('eaten_at', mealsFrom)
      .lt('eaten_at', mealsTo)
      .order('eaten_at', { ascending: true }),
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', params.userId)
      .gte('logged_at', weightFrom)
      .lte('logged_at', localDayWindow(windowEnd).endISO)
      .order('logged_at', { ascending: true }),
  ]);

  if (mealsResult.error) {
    throw mealsResult.error;
  }
  if (weightsResult.error) {
    throw weightsResult.error;
  }

  const meals: ObservedMealInput[] = (mealsResult.data ?? []).map((row) => ({
    dateKey: localDateKey(new Date(row.eaten_at)),
    totalKcal: Number(row.total_kcal ?? 0),
    proteinG:
      row.total_protein_g == null ? null : Number(row.total_protein_g),
  }));

  const weights: ObservedWeightInput[] = (weightsResult.data ?? []).map((row) => ({
    weightKg: Number(row.weight_kg),
    loggedAt: String(row.logged_at),
  }));

  // Plausibility always against activity-factor TDEE (BMR-based estimate).
  const estimatedMaintenanceKcal = calculateMaintenanceCalories({
    biologicalSex: params.biologicalSex,
    birthDate: params.birthDate,
    heightCm: params.heightCm,
    weightKg: params.weightKg,
    activityLevel: params.activityLevel,
    calorieSource: CalorieSource.ACTIVITY_FACTOR,
    today,
  });

  const result = computeObservedEnergy({
    meals,
    weights,
    estimatedMaintenanceKcal,
    today,
  });

  return { ...result, estimatedMaintenanceKcal };
}

/** Rebuild the daily goal from observed maintenance and upsert (user-confirmed). */
export async function applyObservedMaintenanceToCalorieGoal(params: {
  userId: string;
  observedKcal: number;
  weightKg: number;
  goalType: Exclude<GoalType, 'custom'>;
}): Promise<number> {
  const adjusted = applyGoalAdjustment({
    weightKg: params.weightKg,
    maintenanceCalories: params.observedKcal,
    goalType: params.goalType,
  });
  const dailyCalorieGoal = Math.max(adjusted, HARD_MINIMUM_DAILY_CALORIES);

  await upsertDailyCalorieGoal({
    userId: params.userId,
    dailyCalorieGoal,
    source: 'calculated',
    effectiveFrom: localDateKey(),
    tdee: params.observedKcal,
  });

  return dailyCalorieGoal;
}

export { OBSERVED_WINDOW_DAYS };
