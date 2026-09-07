import * as Sentry from '@sentry/react-native';

import { localDateKey } from '@/lib/day-window';
import { computeMacroGoals, isMacroGoalPlausible } from '@/lib/macro-goals';
import { supabase } from '@/lib/supabase';

type ExistingMacroRow = {
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  protein_per_kg: number | null;
  protein_ref_kg: number | null;
  macro_goal_source: string | null;
};

type MacroUpsertFields = {
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  protein_per_kg: number | null;
  protein_ref_kg: number | null;
  macro_goal_source: string | null;
  goal_type: string | null;
};

type LatestCalorieGoalRow = ExistingMacroRow & {
  daily_calorie_goal: number;
  source: string;
  effective_from: string;
  goal_type: string | null;
};

function fiberGForCalories(dailyCalorieGoal: number): number {
  return Math.round(Math.max(30, (14 * dailyCalorieGoal) / 1000));
}

/** Shared fat / carbs / fiber derivation from protein + calories (custom + calculated preserve path). */
export function recalculateFatCarbsFiber(params: {
  dailyCalorieGoal: number;
  proteinG: number;
  proteinRefKg: number;
}): { fatG: number; carbsG: number; fiberG: number } {
  const fatFromCalories = (0.25 * params.dailyCalorieGoal) / 9;
  const fatFloor = 0.7 * params.proteinRefKg;
  const fatG = Math.round(Math.max(fatFromCalories, fatFloor));
  const fiberG = fiberGForCalories(params.dailyCalorieGoal);
  const carbsG = Math.round(
    Math.max(0, (params.dailyCalorieGoal - params.proteinG * 4 - fatG * 9) / 4),
  );
  return { fatG, carbsG, fiberG };
}

export type CustomProteinGoalValidation =
  | { status: 'ok' }
  | { status: 'blocked'; reason: 'non_positive' | 'above_max' }
  | { status: 'warning'; reason: string };

/** Single validation entry for custom protein goal UI (hard block vs soft warning). */
export function validateCustomProteinGoal(params: {
  proteinG: number;
  proteinRefKg: number;
  dailyCalorieGoal: number;
}): CustomProteinGoalValidation {
  if (!(params.proteinG > 0)) {
    return { status: 'blocked', reason: 'non_positive' };
  }

  if (params.proteinG > 3.5 * params.proteinRefKg) {
    return { status: 'blocked', reason: 'above_max' };
  }

  const derived = recalculateFatCarbsFiber({
    dailyCalorieGoal: params.dailyCalorieGoal,
    proteinG: params.proteinG,
    proteinRefKg: params.proteinRefKg,
  });

  const plausibility = isMacroGoalPlausible(
    params.proteinG,
    derived.fatG,
    params.dailyCalorieGoal,
  );

  if (!plausibility.ok) {
    return {
      status: 'warning',
      reason: plausibility.reason ?? 'implausible',
    };
  }

  return { status: 'ok' };
}

async function fetchLatestCalorieGoalRow(userId: string): Promise<LatestCalorieGoalRow | null> {
  const { data, error } = await supabase
    .from('calorie_goals')
    .select(
      'daily_calorie_goal, source, effective_from, goal_type, protein_g, fat_g, carbs_g, fiber_g, protein_per_kg, protein_ref_kg, macro_goal_source',
    )
    .eq('user_id', userId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle<LatestCalorieGoalRow>();

  if (error) {
    throw error;
  }

  if (data?.daily_calorie_goal == null) {
    return null;
  }

  return data;
}

export type MacroGoalEditorState = {
  dailyCalorieGoal: number;
  proteinG: number | null;
  proteinRefKg: number | null;
  macroGoalSource: string | null;
  recommendedProteinG: number | null;
};

export async function fetchMacroGoalEditorState(
  userId: string,
): Promise<MacroGoalEditorState | null> {
  const latest = await fetchLatestCalorieGoalRow(userId);
  if (latest == null) {
    return null;
  }

  const dailyCalorieGoal = Number(latest.daily_calorie_goal);
  const context = await loadMacroContext(userId);
  const recommended = computeMacroGoals({
    dailyCalorieGoal,
    weightKg: context.weightKg,
    heightCm: context.heightCm,
    targetWeightKg: context.targetWeightKg,
    goalType: context.goalType,
    dietPreference: context.dietPreference,
    birthDate: context.birthDate,
    tdee: null,
  });

  const storedRefKg =
    latest.protein_ref_kg == null ? null : Number(latest.protein_ref_kg);

  return {
    dailyCalorieGoal,
    proteinG: latest.protein_g == null ? null : Number(latest.protein_g),
    proteinRefKg: storedRefKg ?? recommended.proteinRefKg,
    macroGoalSource: latest.macro_goal_source ?? null,
    recommendedProteinG: recommended.proteinG,
  };
}

/**
 * Re-runs macro derivation for the latest calorie goal without changing kcal or source.
 * No-op when no calorie_goals row exists. Relies on upsertDailyCalorieGoal custom-protein preserve.
 */
export async function refreshMacrosKeepingCalorieGoal(userId: string): Promise<void> {
  const latest = await fetchLatestCalorieGoalRow(userId);
  if (latest == null) {
    return;
  }

  const source =
    latest.source === 'custom' || latest.source === 'calculated'
      ? latest.source
      : 'custom';

  await upsertDailyCalorieGoal({
    userId,
    dailyCalorieGoal: Number(latest.daily_calorie_goal),
    source,
    effectiveFrom: localDateKey(),
  });
}

export async function saveCustomProteinGoal(params: {
  userId: string;
  proteinG: number;
}): Promise<void> {
  const latest = await fetchLatestCalorieGoalRow(params.userId);
  if (latest == null) {
    throw new Error('no_calorie_goal');
  }

  const dailyCalorieGoal = Number(latest.daily_calorie_goal);
  const context = await loadMacroContext(params.userId);

  let proteinRefKg =
    latest.protein_ref_kg == null ? null : Number(latest.protein_ref_kg);

  if (proteinRefKg == null) {
    const computed = computeMacroGoals({
      dailyCalorieGoal,
      weightKg: context.weightKg,
      heightCm: context.heightCm,
      targetWeightKg: context.targetWeightKg,
      goalType: context.goalType,
      dietPreference: context.dietPreference,
      birthDate: context.birthDate,
      tdee: null,
    });
    proteinRefKg = computed.proteinRefKg;
  }

  if (proteinRefKg == null || !(proteinRefKg > 0)) {
    throw new Error('missing_protein_ref_kg');
  }

  const validation = validateCustomProteinGoal({
    proteinG: params.proteinG,
    proteinRefKg,
    dailyCalorieGoal,
  });

  if (validation.status === 'blocked') {
    throw new Error(`protein_goal_${validation.reason}`);
  }

  const derived = recalculateFatCarbsFiber({
    dailyCalorieGoal,
    proteinG: params.proteinG,
    proteinRefKg,
  });

  const effectiveFromDate = localDateKey();
  const { error } = await supabase.from('calorie_goals').upsert(
    {
      user_id: params.userId,
      daily_calorie_goal: dailyCalorieGoal,
      source: latest.source === 'custom' || latest.source === 'calculated' ? latest.source : 'custom',
      effective_from: effectiveFromDate,
      protein_g: params.proteinG,
      protein_per_kg: params.proteinG / proteinRefKg,
      protein_ref_kg: proteinRefKg,
      macro_goal_source: 'custom',
      fat_g: derived.fatG,
      carbs_g: derived.carbsG,
      fiber_g: derived.fiberG,
      goal_type: latest.goal_type ?? context.goalType,
    },
    { onConflict: 'user_id,effective_from' },
  );

  if (error) {
    throw error;
  }
}

export async function resetMacroGoalToCalculated(userId: string): Promise<void> {
  const latest = await fetchLatestCalorieGoalRow(userId);
  if (latest == null) {
    throw new Error('no_calorie_goal');
  }

  const dailyCalorieGoal = Number(latest.daily_calorie_goal);
  const context = await loadMacroContext(userId);
  const computed = computeMacroGoals({
    dailyCalorieGoal,
    weightKg: context.weightKg,
    heightCm: context.heightCm,
    targetWeightKg: context.targetWeightKg,
    goalType: context.goalType,
    dietPreference: context.dietPreference,
    birthDate: context.birthDate,
    tdee: null,
  });

  const effectiveFromDate = localDateKey();
  const { error } = await supabase.from('calorie_goals').upsert(
    {
      user_id: userId,
      daily_calorie_goal: dailyCalorieGoal,
      source: latest.source === 'custom' || latest.source === 'calculated' ? latest.source : 'custom',
      effective_from: effectiveFromDate,
      protein_g: computed.proteinG,
      fat_g: computed.fatG,
      carbs_g: computed.carbsG,
      fiber_g: computed.fiberG,
      protein_per_kg: computed.proteinPerKg,
      protein_ref_kg: computed.proteinRefKg,
      macro_goal_source: 'calculated',
      goal_type: context.goalType,
    },
    { onConflict: 'user_id,effective_from' },
  );

  if (error) {
    throw error;
  }
}

async function loadMacroContext(userId: string): Promise<{
  weightKg: number | null;
  heightCm: number | null;
  targetWeightKg: number | null;
  goalType: string | null;
  dietPreference: string | null;
  birthDate: string | null;
}> {
  const [profileResult, weightResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('height_cm, target_weight_kg, goal_type, diet_preference, birth_date')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('weight_logs')
      .select('weight_kg')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (weightResult.error) {
    throw weightResult.error;
  }

  const profile = profileResult.data;

  return {
    weightKg:
      weightResult.data?.weight_kg == null ? null : Number(weightResult.data.weight_kg),
    heightCm: profile?.height_cm == null ? null : Number(profile.height_cm),
    targetWeightKg:
      profile?.target_weight_kg == null ? null : Number(profile.target_weight_kg),
    goalType: profile?.goal_type ?? null,
    dietPreference: profile?.diet_preference ?? null,
    birthDate: profile?.birth_date ?? null,
  };
}

export async function upsertDailyCalorieGoal(params: {
  userId: string;
  dailyCalorieGoal: number;
  source: 'custom' | 'calculated';
  effectiveFrom?: string;
  tdee?: number | null;
}) {
  const effectiveFromDate = params.effectiveFrom ?? localDateKey();

  let macroFields: MacroUpsertFields = {
    protein_g: null,
    fat_g: null,
    carbs_g: null,
    fiber_g: null,
    protein_per_kg: null,
    protein_ref_kg: null,
    macro_goal_source: null,
    goal_type: null,
  };

  const { data: existingRow, error: existingError } = await supabase
    .from('calorie_goals')
    .select(
      'protein_g, fat_g, carbs_g, fiber_g, protein_per_kg, protein_ref_kg, macro_goal_source',
    )
    .eq('user_id', params.userId)
    .eq('effective_from', effectiveFromDate)
    .maybeSingle<ExistingMacroRow>();

  if (existingError) {
    throw existingError;
  }

  try {
    const context = await loadMacroContext(params.userId);
    macroFields.goal_type = context.goalType;

    if (existingRow?.macro_goal_source === 'custom') {
      const proteinG =
        existingRow.protein_g == null ? null : Number(existingRow.protein_g);
      const proteinPerKg =
        existingRow.protein_per_kg == null ? null : Number(existingRow.protein_per_kg);
      const proteinRefKg =
        existingRow.protein_ref_kg == null ? null : Number(existingRow.protein_ref_kg);

      macroFields.protein_g = proteinG;
      macroFields.protein_per_kg = proteinPerKg;
      macroFields.protein_ref_kg = proteinRefKg;
      macroFields.macro_goal_source = 'custom';
      macroFields.fiber_g = fiberGForCalories(params.dailyCalorieGoal);

      if (proteinG != null && proteinRefKg != null) {
        const derived = recalculateFatCarbsFiber({
          dailyCalorieGoal: params.dailyCalorieGoal,
          proteinG,
          proteinRefKg,
        });
        macroFields.fat_g = derived.fatG;
        macroFields.carbs_g = derived.carbsG;
        macroFields.fiber_g = derived.fiberG;
      } else {
        macroFields.fat_g = null;
        macroFields.carbs_g = null;
      }
    } else {
      const computed = computeMacroGoals({
        dailyCalorieGoal: params.dailyCalorieGoal,
        weightKg: context.weightKg,
        heightCm: context.heightCm,
        targetWeightKg: context.targetWeightKg,
        goalType: context.goalType,
        dietPreference: context.dietPreference,
        birthDate: context.birthDate,
        tdee: params.tdee ?? null,
      });

      macroFields = {
        protein_g: computed.proteinG,
        fat_g: computed.fatG,
        carbs_g: computed.carbsG,
        fiber_g: computed.fiberG,
        protein_per_kg: computed.proteinPerKg,
        protein_ref_kg: computed.proteinRefKg,
        macro_goal_source: 'calculated',
        goal_type: context.goalType,
      };
    }
  } catch (profileReadError) {
    console.error('[calorie-goals] macro profile read failed:', profileReadError);
    Sentry.captureMessage('macro_goal_profile_read_failed', {
      level: 'info',
      tags: { reason: 'macro_goal_profile_read_failed' },
    });
    macroFields = {
      protein_g: null,
      fat_g: null,
      carbs_g: null,
      fiber_g: null,
      protein_per_kg: null,
      protein_ref_kg: null,
      macro_goal_source: null,
      goal_type: null,
    };
  }

  // Upsert on (user_id, effective_from) — safe for multiple HealthKit toggles same day.
  const { error } = await supabase.from('calorie_goals').upsert(
    {
      user_id: params.userId,
      daily_calorie_goal: params.dailyCalorieGoal,
      source: params.source,
      effective_from: effectiveFromDate,
      ...macroFields,
    },
    { onConflict: 'user_id,effective_from' },
  );

  if (error) {
    throw error;
  }
}

/**
 * Goal active on a given local calendar day: latest row with effective_from <= dateKey.
 * Returns null when no goal existed yet (same as Home "Not set").
 */
export type CalorieGoalForDate = {
  dailyCalorieGoal: number;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
};

export async function fetchCalorieGoalForDate(
  userId: string,
  dateKey: string,
): Promise<CalorieGoalForDate | null> {
  const { data, error } = await supabase
    .from('calorie_goals')
    .select('daily_calorie_goal, protein_g, fat_g, carbs_g, fiber_g')
    .eq('user_id', userId)
    .lte('effective_from', dateKey)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.daily_calorie_goal == null) {
    return null;
  }

  return {
    dailyCalorieGoal: Number(data.daily_calorie_goal),
    proteinG: data.protein_g == null ? null : Number(data.protein_g),
    fatG: data.fat_g == null ? null : Number(data.fat_g),
    carbsG: data.carbs_g == null ? null : Number(data.carbs_g),
    fiberG: data.fiber_g == null ? null : Number(data.fiber_g),
  };
}

export function logCalorieGoalSaveError(context: string, error: unknown) {
  console.error(`[${context}] save failed:`, error);

  if (error && typeof error === 'object') {
    const supabaseError = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };

    console.error(`[${context}] save failed details:`, {
      code: supabaseError.code,
      message: supabaseError.message,
      details: supabaseError.details,
      hint: supabaseError.hint,
    });
  }
}

export function getCalorieGoalErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}
