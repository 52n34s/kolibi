import { fetchDailyCalorieTotals } from '@/lib/meals';
import { supabase } from '@/lib/supabase';

export type WeightLogEntry = {
  weight_kg: number;
  logged_at: string;
};

export type DailyCalorieTotal = {
  date: string;
  totalCalories: number;
};

export type HistoryData = {
  weightLogs: WeightLogEntry[];
  dailyCalories: DailyCalorieTotal[];
  targetWeightKg: number | null;
};

const WEIGHT_LOOKBACK_DAYS = 30;
const CALORIE_LOOKBACK_DAYS = 7;

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

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getLookbackDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function buildEmptyCalorieDays(days: number): DailyCalorieTotal[] {
  const result: DailyCalorieTotal[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    result.push({
      date: formatDateKey(date),
      totalCalories: 0,
    });
  }

  return result;
}

export async function fetchHistoryData(userId: string): Promise<HistoryData> {
  const sinceWeight = getLookbackDate(WEIGHT_LOOKBACK_DAYS);

  const [weightResult, profileResult, dailyCalories] = await Promise.all([
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', sinceWeight)
      .order('logged_at', { ascending: true }),
    supabase.from('profiles').select('target_weight_kg').eq('id', userId).maybeSingle(),
    fetchDailyCalorieTotals({
      userId,
      days: CALORIE_LOOKBACK_DAYS,
    }).catch(() => buildEmptyCalorieDays(CALORIE_LOOKBACK_DAYS)),
  ]);

  if (weightResult.error) {
    throw weightResult.error;
  }

  if (profileResult.error) {
    throw profileResult.error;
  }

  return {
    weightLogs: weightResult.data ?? [],
    dailyCalories,
    targetWeightKg:
      profileResult.data?.target_weight_kg == null
        ? null
        : Number(profileResult.data.target_weight_kg),
  };
}

export function resolveHistoryPreviewData(data: HistoryData): HistoryData {
  if (!__DEV__) {
    return data;
  }

  const weightLogs =
    data.weightLogs.length > 0 ? data.weightLogs : DEV_PREVIEW_WEIGHT_LOGS;

  const hasCalorieData = data.dailyCalories.some((day) => day.totalCalories > 0);
  const dailyCalories = hasCalorieData
    ? data.dailyCalories
    : data.dailyCalories.map((day, index) => ({
        ...day,
        totalCalories: DEV_PREVIEW_DAILY_CALORIES[index] ?? 0,
      }));

  return { weightLogs, dailyCalories, targetWeightKg: data.targetWeightKg };
}

export function getLatestWeightKg(weightLogs: WeightLogEntry[]): number | null {
  if (weightLogs.length === 0) {
    return null;
  }

  return weightLogs[weightLogs.length - 1]?.weight_kg ?? null;
}
