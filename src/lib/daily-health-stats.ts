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
