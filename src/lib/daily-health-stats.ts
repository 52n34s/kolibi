import {
  EXPECTED_MAINTENANCE_AE_WINDOW_DAYS,
  type RecentActiveEnergy,
} from '@/lib/calorie-goal-math';
import { createSchemaProbe } from '@/lib/db-schema-errors';
import { localDateKey } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';

export type DailyHealthStatsRow = {
  active_energy_kcal: number | null;
  /** Active Energy plus the counted training of that day; null before the column / write. */
  sport_energy_kcal: number | null;
  health_connected: boolean;
  backfilled: boolean;
};

/** daily_health_stats.sport_energy_kcal (20260927103000_daily_health_stats_sport_energy). */
export const hasSportEnergyKcalColumn = createSchemaProbe(() =>
  supabase.from('daily_health_stats').select('sport_energy_kcal').limit(0),
);

const ENERGY_SELECT = 'day, active_energy_kcal';

/** `day, active_energy_kcal`, with sport_energy_kcal once the column exists. */
export async function dailyEnergySelect(): Promise<string> {
  return (await hasSportEnergyKcalColumn())
    ? `${ENERGY_SELECT}, sport_energy_kcal`
    : ENERGY_SELECT;
}

function numberOrNull(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchDailyHealthStatsForDate(
  userId: string,
  dateKey: string,
): Promise<DailyHealthStatsRow | null> {
  const withSportEnergy = await hasSportEnergyKcalColumn();
  const { data, error } = await supabase
    .from('daily_health_stats')
    .select(
      withSportEnergy
        ? 'active_energy_kcal, sport_energy_kcal, health_connected, backfilled'
        : 'active_energy_kcal, health_connected, backfilled',
    )
    .eq('user_id', userId)
    .eq('day', dateKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as Record<string, unknown>;
  return {
    active_energy_kcal: numberOrNull(row.active_energy_kcal),
    sport_energy_kcal: numberOrNull(row.sport_energy_kcal),
    health_connected: row.health_connected === true,
    backfilled: row.backfilled === true,
  };
}

/**
 * Keeps the day's sport energy next to Active Energy, so History shows the
 * same burn Today showed. Fire and forget: without the column, offline or on
 * any error the read it came from stays untouched and History falls back to
 * Active Energy alone.
 */
export async function saveSportEnergyKcal(params: {
  userId: string;
  dateKey: string;
  sportEnergyKcal: number;
}): Promise<void> {
  if (!Number.isFinite(params.sportEnergyKcal) || params.sportEnergyKcal < 0) {
    return;
  }
  try {
    if (!(await hasSportEnergyKcalColumn())) {
      return;
    }
    const { error } = await supabase.from('daily_health_stats').upsert(
      {
        user_id: params.userId,
        day: params.dateKey,
        sport_energy_kcal: Math.round(params.sportEnergyKcal),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' },
    );
    if (error) {
      console.warn('[Health] sport_energy_kcal save failed:', error.message);
    }
  } catch (error) {
    console.warn('[Health] sport_energy_kcal save failed:', error);
  }
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
