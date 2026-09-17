import {
  EXPECTED_MAINTENANCE_AE_WINDOW_DAYS,
  type RecentActiveEnergy,
} from '@/lib/calorie-goal-math';
import { localDateKey } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';

export type DailyHealthStatsRow = {
  active_energy_kcal: number | null;
  health_connected: boolean;
  backfilled: boolean;
};

export async function fetchDailyHealthStatsForDate(
  userId: string,
  dateKey: string,
): Promise<DailyHealthStatsRow | null> {
  const { data, error } = await supabase
    .from('daily_health_stats')
    .select('active_energy_kcal, health_connected, backfilled')
    .eq('user_id', userId)
    .eq('day', dateKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    active_energy_kcal:
      data.active_energy_kcal == null ? null : Number(data.active_energy_kcal),
    health_connected: data.health_connected === true,
    backfilled: data.backfilled === true,
  };
}

/**
 * Mean active energy over the closed days before today. Days without a Health
 * row do not count as zero — they are days we know nothing about, and folding
 * them in as zeros would drag the expected day down toward the BMR.
 */
export async function fetchRecentActiveEnergy(
  userId: string,
  windowDays: number = EXPECTED_MAINTENANCE_AE_WINDOW_DAYS,
  today: Date = new Date(),
): Promise<RecentActiveEnergy> {
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (windowDays - 1));

  const { data, error } = await supabase
    .from('daily_health_stats')
    .select('active_energy_kcal')
    .eq('user_id', userId)
    .gte('day', localDateKey(start))
    .lte('day', localDateKey(end));

  if (error) {
    throw error;
  }

  const values = (data ?? [])
    .map((row) => (row.active_energy_kcal == null ? null : Number(row.active_energy_kcal)))
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);

  if (values.length === 0) {
    return { avgKcal: 0, days: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return { avgKcal: total / values.length, days: values.length };
}
