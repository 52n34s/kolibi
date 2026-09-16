import { fetchCalorieGoalForDate, type CalorieGoalForDate } from '@/lib/calorie-goals';
import { localDateKey, localDayWindow, parseDateOnly } from '@/lib/day-window';
import { MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY } from '@/lib/macros-goals-editor-math';
import { scaleMacrosForSportCalories } from '@/lib/sport-macro-scaling';
import { supabase } from '@/lib/supabase';
import { getUserPreferenceOrDefault } from '@/lib/user-preferences';
import { trailingMovingAverage, WEIGHT_ETA_MA_WINDOW_DAYS } from '@/lib/weight-goal-eta';

export type WeightLogEntry = {
  weight_kg: number;
  logged_at: string;
};

export type DailyCalorieTotal = {
  date: string;
  totalCalories: number;
};

export type HistoryDayMacros = {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

export type HistoryDayRow = {
  date: string;
  totalCalories: number;
  hasMeals: boolean;
  macros: HistoryDayMacros;
  goal: CalorieGoalForDate | null;
  /** Sport-scaled carb/fat/protein goals when adapt-to-training is on. */
  scaledGoal: {
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fiberG: number | null;
    calorieGoal: number | null;
  } | null;
  activeEnergyKcal: number | null;
};

export type HistoryData = {
  weightLogs: WeightLogEntry[];
  /** Full lookback for charts / ETA (includes today). */
  days: HistoryDayRow[];
  targetWeightKg: number | null;
  adaptMacrosToTraining: boolean;
};

export type HistoryRangeDays = 7 | 30;

const WEIGHT_LOOKBACK_DAYS = 60;

/** Dev-only sample data for chart layout previews when real data is empty. */
export const DEV_PREVIEW_WEIGHT_LOGS: WeightLogEntry[] = [
  { weight_kg: 82.4, logged_at: daysAgoIso(26) },
  { weight_kg: 81.9, logged_at: daysAgoIso(20) },
  { weight_kg: 81.5, logged_at: daysAgoIso(14) },
  { weight_kg: 81.1, logged_at: daysAgoIso(7) },
  { weight_kg: 80.8, logged_at: daysAgoIso(1) },
];

export const DEV_PREVIEW_DAILY_CALORIES = [1240, 980, 0, 1860, 2105, 1420, 1675];

function daysAgoIso(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function getLookbackDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDayWindow(date).startISO;
}

function buildDateKeys(days: number): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    keys.push(localDateKey(date));
  }
  return keys;
}

function macroOrEmpty(kcal: number, value: number): number | null {
  if (kcal > 0 && value === 0) {
    return null;
  }
  return value;
}

export async function fetchHistoryData(
  userId: string,
  rangeDays: HistoryRangeDays = 7,
): Promise<HistoryData> {
  const dateKeys = buildDateKeys(rangeDays);
  const sinceMeals = localDayWindow(parseDateOnly(dateKeys[0]!)).startISO;
  const sinceWeight = getLookbackDate(WEIGHT_LOOKBACK_DAYS);

  const [
    weightResult,
    profileResult,
    mealsResult,
    healthResult,
    adaptMacrosToTraining,
  ] = await Promise.all([
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', sinceWeight)
      .order('logged_at', { ascending: true }),
    supabase.from('profiles').select('target_weight_kg').eq('id', userId).maybeSingle(),
    supabase
      .from('meals')
      .select('eaten_at, total_kcal, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
      .eq('user_id', userId)
      .gte('eaten_at', sinceMeals)
      .order('eaten_at', { ascending: true }),
    supabase
      .from('daily_health_stats')
      .select('day, active_energy_kcal')
      .eq('user_id', userId)
      .gte('day', dateKeys[0]!)
      .lte('day', dateKeys[dateKeys.length - 1]!),
    getUserPreferenceOrDefault(userId, MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY, true),
  ]);

  if (weightResult.error) {
    throw weightResult.error;
  }
  if (profileResult.error) {
    throw profileResult.error;
  }
  if (mealsResult.error) {
    throw mealsResult.error;
  }
  if (healthResult.error) {
    throw healthResult.error;
  }

  const caloriesByDate = new Map<string, number>();
  const macrosByDate = new Map<
    string,
    { protein: number; carbs: number; fat: number; fiber: number }
  >();

  for (const row of mealsResult.data ?? []) {
    const dateKey = localDateKey(new Date(row.eaten_at));
    caloriesByDate.set(
      dateKey,
      (caloriesByDate.get(dateKey) ?? 0) + Number(row.total_kcal ?? 0),
    );
    const macros = macrosByDate.get(dateKey) ?? {
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    };
    macros.protein += Number(row.total_protein_g ?? 0);
    macros.carbs += Number(row.total_carbs_g ?? 0);
    macros.fat += Number(row.total_fat_g ?? 0);
    macros.fiber += Number(row.total_fiber_g ?? 0);
    macrosByDate.set(dateKey, macros);
  }

  const energyByDate = new Map<string, number | null>();
  for (const row of healthResult.data ?? []) {
    energyByDate.set(
      String(row.day),
      row.active_energy_kcal == null ? null : Number(row.active_energy_kcal),
    );
  }

  const weightLogs: WeightLogEntry[] = (weightResult.data ?? []).map((row) => ({
    weight_kg: Number(row.weight_kg),
    logged_at: String(row.logged_at),
  }));
  const latestWeightKg =
    weightLogs.length > 0 ? weightLogs[weightLogs.length - 1]!.weight_kg : null;

  const goals = await Promise.all(
    dateKeys.map((dateKey) => fetchCalorieGoalForDate(userId, dateKey)),
  );

  const days: HistoryDayRow[] = dateKeys.map((dateKey, index) => {
    const totalCalories = caloriesByDate.get(dateKey) ?? 0;
    const hasMeals = caloriesByDate.has(dateKey);
    const raw = macrosByDate.get(dateKey);
    const macros: HistoryDayMacros = raw
      ? {
          proteinG: macroOrEmpty(totalCalories, raw.protein),
          carbsG: macroOrEmpty(totalCalories, raw.carbs),
          fatG: macroOrEmpty(totalCalories, raw.fat),
          fiberG: macroOrEmpty(totalCalories, raw.fiber),
        }
      : { proteinG: null, carbsG: null, fatG: null, fiberG: null };

    const goal = goals[index] ?? null;
    const activeEnergyKcal = energyByDate.get(dateKey) ?? null;

    let scaledGoal: HistoryDayRow['scaledGoal'] = null;
    if (goal != null) {
      const basisKcal = goal.dailyCalorieGoal;
      const baseProtein = goal.proteinG;
      const baseFat = goal.fatG;
      const baseCarbs = goal.carbsG;
      let proteinG = baseProtein;
      let fatG = baseFat;
      let carbsG = baseCarbs;
      let calorieGoal = basisKcal;

      if (
        adaptMacrosToTraining &&
        baseProtein != null &&
        baseFat != null &&
        baseCarbs != null
      ) {
        const sportKcal = activeEnergyKcal ?? 0;
        const scaled = scaleMacrosForSportCalories({
          basisKcal,
          sportKcal,
          proteinG: baseProtein,
          fatBasisG: baseFat,
          carbsBasisG: baseCarbs,
          weightKg: latestWeightKg,
        });
        if (scaled.ok) {
          proteinG = scaled.proteinG;
          fatG = scaled.fatG;
          carbsG = scaled.carbsG;
          calorieGoal = scaled.totalKcal;
        } else if (adaptMacrosToTraining && activeEnergyKcal != null) {
          calorieGoal = basisKcal + activeEnergyKcal;
        }
      } else if (adaptMacrosToTraining && activeEnergyKcal != null) {
        calorieGoal = basisKcal + activeEnergyKcal;
      }

      scaledGoal = {
        proteinG,
        carbsG,
        fatG,
        fiberG: goal.fiberG,
        calorieGoal,
      };
    }

    return {
      date: dateKey,
      totalCalories,
      hasMeals,
      macros,
      goal,
      scaledGoal,
      activeEnergyKcal,
    };
  });

  return {
    weightLogs,
    days,
    targetWeightKg:
      profileResult.data?.target_weight_kg == null
        ? null
        : Number(profileResult.data.target_weight_kg),
    adaptMacrosToTraining,
  };
}

export function resolveHistoryPreviewData(data: HistoryData): HistoryData {
  if (!__DEV__) {
    return data;
  }

  const weightLogs =
    data.weightLogs.length > 0 ? data.weightLogs : DEV_PREVIEW_WEIGHT_LOGS;

  const hasCalorieData = data.days.some((day) => day.totalCalories > 0);
  if (hasCalorieData) {
    return { ...data, weightLogs };
  }

  const days = data.days.map((day, index) => ({
    ...day,
    totalCalories: DEV_PREVIEW_DAILY_CALORIES[index % DEV_PREVIEW_DAILY_CALORIES.length] ?? 0,
    hasMeals:
      (DEV_PREVIEW_DAILY_CALORIES[index % DEV_PREVIEW_DAILY_CALORIES.length] ?? 0) > 0,
  }));

  return { ...data, weightLogs, days };
}

export function getLatestWeightKg(weightLogs: WeightLogEntry[]): number | null {
  if (weightLogs.length === 0) {
    return null;
  }
  return weightLogs[weightLogs.length - 1]?.weight_kg ?? null;
}

/** Trailing 7-day mean of the most recent weigh-in in `weightLogs`.
 * Returns null when there are no logs. With fewer than 3 daily samples
 * in the MA window, falls back to the latest value in the given list.
 */
export function getTrendWeightKg(weightLogs: WeightLogEntry[]): number | null {
  if (weightLogs.length === 0) {
    return null;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const byDay = new Map<number, { day: number; weightKg: number; at: Date }>();
  for (const entry of weightLogs) {
    const at = startOfLocalDay(new Date(entry.logged_at));
    const day = Math.round(at.getTime() / msPerDay);
    const existing = byDay.get(day);
    if (existing == null || at.getTime() >= existing.at.getTime()) {
      byDay.set(day, { day, weightKg: entry.weight_kg, at });
    }
  }
  const daily = [...byDay.values()].sort((a, b) => a.day - b.day);
  const averaged = trailingMovingAverage(daily, 3);
  if (averaged.length === 0) {
    return daily[daily.length - 1]?.weightKg ?? null;
  }
  return averaged[averaged.length - 1]!.weightKg;
}

/** Weight logs whose local calendar day falls in [startKey, endKey]. */
export function filterWeightLogsInRange(
  weightLogs: WeightLogEntry[],
  startKey: string,
  endKey: string,
): WeightLogEntry[] {
  return weightLogs.filter((entry) => {
    const key = localDateKey(new Date(entry.logged_at));
    return key >= startKey && key <= endKey;
  });
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function countWeighDaysInLastMonth(
  weightLogs: WeightLogEntry[],
  today: Date = new Date(),
): number {
  const cutoff = new Date(today);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 30);
  const days = new Set<string>();
  for (const log of weightLogs) {
    const at = new Date(log.logged_at);
    if (at >= cutoff) {
      days.add(localDateKey(at));
    }
  }
  return days.size;
}

export type HistorySummaryStats = {
  calorieAvg: number | null;
  calorieGoalAvg: number | null;
  proteinHitDays: number;
  proteinTrackedDays: number;
  carbsAvg: number | null;
  carbsGoalAvg: number | null;
  fatAvg: number | null;
  fatGoalAvg: number | null;
  fiberAvg: number | null;
  fiberGoalAvg: number | null;
  loggedDays: number;
  /** Closed days in the range (today excluded while in progress). */
  rangeDayCount: number;
};

/**
 * Summary over closed days only (excludes today). Days without meals are
 * omitted from averages but counted in the denominator for "X of Y logged".
 */
export function buildHistorySummaryStats(
  days: HistoryDayRow[],
  todayKey: string = localDateKey(),
): HistorySummaryStats {
  const closed = days.filter((day) => day.date !== todayKey);
  const logged = closed.filter((day) => day.hasMeals);

  const avg = (values: number[]): number | null => {
    if (values.length === 0) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  let proteinHitDays = 0;
  let proteinTrackedDays = 0;

  for (const day of logged) {
    const goal = day.scaledGoal?.proteinG ?? day.goal?.proteinG ?? null;
    const actual = day.macros.proteinG;
    if (goal != null && actual != null) {
      proteinTrackedDays += 1;
      if (actual >= goal) {
        proteinHitDays += 1;
      }
    }
  }

  return {
    calorieAvg: avg(logged.map((day) => day.totalCalories)),
    calorieGoalAvg: avg(
      logged
        .map((day) => day.scaledGoal?.calorieGoal ?? day.goal?.dailyCalorieGoal ?? null)
        .filter((value): value is number => value != null),
    ),
    proteinHitDays,
    proteinTrackedDays,
    carbsAvg: avg(
      logged
        .map((day) => day.macros.carbsG)
        .filter((value): value is number => value != null),
    ),
    carbsGoalAvg: avg(
      logged
        .map((day) => day.scaledGoal?.carbsG ?? day.goal?.carbsG ?? null)
        .filter((value): value is number => value != null),
    ),
    fatAvg: avg(
      logged
        .map((day) => day.macros.fatG)
        .filter((value): value is number => value != null),
    ),
    fatGoalAvg: avg(
      logged
        .map((day) => day.scaledGoal?.fatG ?? day.goal?.fatG ?? null)
        .filter((value): value is number => value != null),
    ),
    fiberAvg: avg(
      logged
        .map((day) => day.macros.fiberG)
        .filter((value): value is number => value != null),
    ),
    fiberGoalAvg: avg(
      logged
        .map((day) => day.scaledGoal?.fiberG ?? day.goal?.fiberG ?? null)
        .filter((value): value is number => value != null),
    ),
    loggedDays: logged.length,
    rangeDayCount: closed.length,
  };
}

export function weightChangeInRange(
  weightLogs: WeightLogEntry[],
  rangeStartKey: string,
  rangeEndKey: string,
): { deltaKg: number; spanDays: number } | null {
  const inRange = weightLogs.filter((log) => {
    const key = localDateKey(new Date(log.logged_at));
    return key >= rangeStartKey && key <= rangeEndKey;
  });
  if (inRange.length < 2) {
    return null;
  }
  const first = inRange[0]!;
  const last = inRange[inRange.length - 1]!;
  const firstDay = parseDateOnly(localDateKey(new Date(first.logged_at)));
  const lastDay = parseDateOnly(localDateKey(new Date(last.logged_at)));
  const spanDays = Math.max(
    1,
    Math.round((lastDay.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000)),
  );
  return {
    deltaKg: last.weight_kg - first.weight_kg,
    spanDays,
  };
}

export { WEIGHT_ETA_MA_WINDOW_DAYS };
