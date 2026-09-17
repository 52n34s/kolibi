import type { BiologicalSex } from '@/lib/calorie-goal-math';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';

export const MIN_BODY_FAT_PCT = 3;
export const MAX_BODY_FAT_PCT = 70;

/** Long-term sustainable floors used in target-weight copy. */
export const SUSTAINABLE_BODY_FAT_PCT = {
  male: 8,
  female: 15,
} as const;

/**
 * Conservative floor when sex is unknown / prefer_not_to_say — use the higher
 * (female) threshold so we never understate risk.
 */
export function sustainableBodyFatFloorPct(
  biologicalSex: BiologicalSex | null | undefined,
): number {
  return biologicalSex === 'male'
    ? SUSTAINABLE_BODY_FAT_PCT.male
    : SUSTAINABLE_BODY_FAT_PCT.female;
}

export type BodyFatSource = 'manual' | 'healthkit';

export type BodyFatLogEntry = {
  body_fat_pct: number;
  logged_at: string;
  logged_on?: string;
  source?: BodyFatSource;
  source_bundle?: string | null;
};

export function parseBodyFatInputToPct(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= MIN_BODY_FAT_PCT || parsed >= MAX_BODY_FAT_PCT) {
    return null;
  }
  return Math.round(parsed * 10) / 10;
}

/**
 * HealthKit `%` quantities are usually 0–1 fractions; some apps write 0–100.
 */
export function normalizeHealthKitBodyFatPct(quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  const asPercent = quantity <= 1 ? quantity * 100 : quantity;
  if (asPercent <= MIN_BODY_FAT_PCT || asPercent >= MAX_BODY_FAT_PCT) {
    return null;
  }
  return Math.round(asPercent * 10) / 10;
}

function loggedAtForDay(loggedOn: string): string {
  const loggedAt = parseDateOnly(loggedOn);
  loggedAt.setHours(12, 0, 0, 0);
  return loggedAt.toISOString();
}

export async function upsertBodyFatLog(params: {
  userId: string;
  bodyFatPct: number;
  loggedOn: string;
  source: BodyFatSource;
  sourceBundle?: string | null;
}): Promise<void> {
  if (!(params.bodyFatPct > 0)) {
    return;
  }

  const loggedOn = params.loggedOn;

  // Manual entries always win — HealthKit must not replace them for that day.
  if (params.source === 'healthkit') {
    const { data: existing, error: existingError } = await supabase
      .from('body_fat_logs')
      .select('source')
      .eq('user_id', params.userId)
      .eq('logged_on', loggedOn)
      .maybeSingle();
    if (existingError) {
      throw existingError;
    }
    if (existing?.source === 'manual') {
      return;
    }
  }

  const payload = {
    body_fat_pct: params.bodyFatPct,
    source: params.source,
    source_bundle: params.sourceBundle ?? null,
    logged_at: loggedAtForDay(loggedOn),
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from('body_fat_logs')
    .update(payload)
    .eq('user_id', params.userId)
    .eq('logged_on', loggedOn)
    .select('id');

  if (updateError) {
    throw updateError;
  }

  if (updatedRows?.length) {
    return;
  }

  const { error: insertError } = await supabase.from('body_fat_logs').insert({
    user_id: params.userId,
    ...payload,
    logged_on: loggedOn,
  });

  if (insertError) {
    throw insertError;
  }
}

export async function fetchLatestBodyFatLog(
  userId: string,
): Promise<BodyFatLogEntry | null> {
  const { data, error } = await supabase
    .from('body_fat_logs')
    .select('body_fat_pct, logged_at, logged_on, source, source_bundle')
    .eq('user_id', userId)
    .order('logged_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data?.body_fat_pct == null) {
    return null;
  }

  return {
    body_fat_pct: Number(data.body_fat_pct),
    logged_at: String(data.logged_at),
    logged_on: data.logged_on == null ? undefined : String(data.logged_on),
    source: data.source === 'healthkit' ? 'healthkit' : 'manual',
    source_bundle: data.source_bundle == null ? null : String(data.source_bundle),
  };
}

export async function fetchBodyFatPctForDay(
  userId: string,
  loggedOn: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('body_fat_logs')
    .select('body_fat_pct')
    .eq('user_id', userId)
    .eq('logged_on', loggedOn)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data?.body_fat_pct == null) {
    return null;
  }
  const pct = Number(data.body_fat_pct);
  return Number.isFinite(pct) && pct > 0 ? pct : null;
}

export function fatMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (bodyFatPct / 100);
}

export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100);
}

/** Implied body-fat % at target weight if lean mass stays constant. */
export function impliedBodyFatAtTarget(params: {
  currentWeightKg: number;
  currentBodyFatPct: number;
  targetWeightKg: number;
  extraLeanMassKg?: number;
}): number | null {
  const { currentWeightKg, currentBodyFatPct, targetWeightKg } = params;
  if (
    !(currentWeightKg > 0) ||
    !(targetWeightKg > 0) ||
    !(currentBodyFatPct > 0) ||
    !(currentBodyFatPct < 100)
  ) {
    return null;
  }

  const ffm =
    leanMassKg(currentWeightKg, currentBodyFatPct) + (params.extraLeanMassKg ?? 0);
  if (ffm >= targetWeightKg) {
    return null;
  }

  return Math.round(((targetWeightKg - ffm) / targetWeightKg) * 1000) / 10;
}

export type BodyFatChangeSummary = {
  deltaPp: number;
  spanDays: number;
  currentPct: number;
  fatMassDeltaKg: number | null;
  weightDeltaKg: number | null;
};

/**
 * Needs two logs ≥14 days apart. Prefer oldest+newest in the lookback.
 * Weight pairing uses nearest weight log on/before each body-fat day.
 */
export function computeBodyFatChangeSummary(params: {
  bodyFatLogs: BodyFatLogEntry[];
  weightLogs: Array<{ weight_kg: number; logged_at: string }>;
  minSpanDays?: number;
}): BodyFatChangeSummary | null {
  const minSpanDays = params.minSpanDays ?? 14;
  const sorted = [...params.bodyFatLogs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
  );
  if (sorted.length < 2) {
    return null;
  }

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const spanDays = Math.round(
    (new Date(last.logged_at).getTime() - new Date(first.logged_at).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if (spanDays < minSpanDays) {
    return null;
  }

  const deltaPp = Math.round((last.body_fat_pct - first.body_fat_pct) * 10) / 10;

  const weightFor = (at: string): number | null => {
    const target = new Date(at).getTime();
    let best: { weight: number; dist: number } | null = null;
    for (const log of params.weightLogs) {
      const t = new Date(log.logged_at).getTime();
      if (t > target + 24 * 60 * 60 * 1000) {
        continue;
      }
      const dist = Math.abs(target - t);
      if (best == null || dist < best.dist) {
        best = { weight: log.weight_kg, dist };
      }
    }
    return best?.weight ?? null;
  };

  const w0 = weightFor(first.logged_at);
  const w1 = weightFor(last.logged_at);
  let fatMassDeltaKg: number | null = null;
  let weightDeltaKg: number | null = null;
  if (w0 != null && w1 != null) {
    weightDeltaKg = Math.round((w1 - w0) * 10) / 10;
    fatMassDeltaKg =
      Math.round(
        (fatMassKg(w1, last.body_fat_pct) - fatMassKg(w0, first.body_fat_pct)) * 10,
      ) / 10;
  }

  return {
    deltaPp,
    spanDays,
    currentPct: last.body_fat_pct,
    fatMassDeltaKg,
    weightDeltaKg,
  };
}

export function formatBodyFatPct(pct: number, locale: string): string {
  return `${pct.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatBodyFatDeltaPp(deltaPp: number, locale: string): string {
  const sign = deltaPp > 0 ? '+' : deltaPp < 0 ? '−' : '';
  const abs = Math.abs(deltaPp).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return `${sign}${abs} pp`;
}
