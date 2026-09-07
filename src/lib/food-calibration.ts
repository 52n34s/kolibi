import { supabase } from '@/lib/supabase';
import {
  absoluteMacrosFromPer100g,
  getItemTotalGrams,
  type EditableMealItem,
} from '@/services/mealVision/types';

/**
 * When false, only personal user_food_calibration is used (current production behavior).
 * When true: personal → global median → no correction.
 * Keep false until global_food_calibration exists and has been reviewed.
 */
export const GLOBAL_CALIBRATION_ENABLED = false;

const MIN_SAMPLE_COUNT = 2;
const MIN_AVG_RATIO = 0.5;
const MAX_AVG_RATIO = 2.0;

const GLOBAL_MIN_SAMPLE_COUNT = 5;
const GLOBAL_MIN_USER_COUNT = 3;
const GLOBAL_MIN_MEDIAN_RATIO = 0.7;
const GLOBAL_MAX_MEDIAN_RATIO = 1.4;

type PersonalCalibrationRow = {
  food_name_normalized: string;
  sample_count: number;
  avg_ratio: number;
};

type GlobalCalibrationRow = {
  food_name_normalized: string;
  sample_count: number;
  user_count: number;
  median_ratio: number;
};

function normalizeFoodName(canonicalName: string | undefined): string {
  return (canonicalName ?? '').trim().toLowerCase();
}

function shouldApplyPersonalCalibration(row: PersonalCalibrationRow): boolean {
  const ratio = Number(row.avg_ratio);
  return (
    row.sample_count >= MIN_SAMPLE_COUNT &&
    Number.isFinite(ratio) &&
    ratio >= MIN_AVG_RATIO &&
    ratio <= MAX_AVG_RATIO
  );
}

function shouldApplyGlobalCalibration(row: GlobalCalibrationRow): boolean {
  const ratio = Number(row.median_ratio);
  return (
    row.sample_count >= GLOBAL_MIN_SAMPLE_COUNT &&
    row.user_count >= GLOBAL_MIN_USER_COUNT &&
    Number.isFinite(ratio) &&
    ratio >= GLOBAL_MIN_MEDIAN_RATIO &&
    ratio <= GLOBAL_MAX_MEDIAN_RATIO
  );
}

function scaleMacrosProportionally(
  item: EditableMealItem,
  fromGrams: number,
  toGrams: number,
): Pick<EditableMealItem, 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'> {
  if (!(fromGrams > 0)) {
    return {
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      fiberG: item.fiberG,
    };
  }

  const factor = toGrams / fromGrams;
  const scale = (value: number | null): number | null =>
    value == null ? null : value * factor;

  return {
    proteinG: scale(item.proteinG),
    carbsG: scale(item.carbsG),
    fatG: scale(item.fatG),
    fiberG: scale(item.fiberG),
  };
}

function applyRatioToItem(item: EditableMealItem, avgRatio: number): EditableMealItem {
  const aiGrams = getItemTotalGrams(item);
  if (!(aiGrams > 0)) {
    return item;
  }

  const correctedGrams = Math.max(0, Math.round(aiGrams * avgRatio));
  if (correctedGrams === aiGrams) {
    return item;
  }

  const isCountItem =
    item.quantityCount != null &&
    item.quantityCount > 0 &&
    item.gramsPerUnit != null &&
    item.gramsPerUnit > 0;

  const nextQuantity = isCountItem
    ? {
        quantityGrams: correctedGrams,
        gramsPerUnit: correctedGrams / item.quantityCount!,
        baselineGrams: correctedGrams,
        baselineGramsPerUnit: correctedGrams / item.quantityCount!,
      }
    : {
        quantityGrams: correctedGrams,
        baselineGrams: correctedGrams,
      };

  const kcalPer100g = item.kcalPer100g;
  const kcal =
    kcalPer100g != null && kcalPer100g > 0
      ? Math.max(0, Math.round((kcalPer100g / 100) * correctedGrams))
      : Math.max(0, Math.round((correctedGrams / aiGrams) * item.baselineKcal));

  const absoluteMacros =
    item.macrosPer100g != null
      ? absoluteMacrosFromPer100g(item.macrosPer100g, correctedGrams, {
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          fiberG: item.fiberG,
        })
      : scaleMacrosProportionally(item, aiGrams, correctedGrams);

  return {
    ...item,
    ...nextQuantity,
    kcal,
    baselineKcal: kcal,
    // Keep 'ai' so a later user edit still counts as a real correction.
    quantitySource: 'ai',
    proteinG: absoluteMacros.proteinG,
    carbsG: absoluteMacros.carbsG,
    fatG: absoluteMacros.fatG,
    fiberG: absoluteMacros.fiberG,
  };
}

async function loadPersonalCalibration(
  userId: string,
  names: string[],
): Promise<Map<string, PersonalCalibrationRow>> {
  const byName = new Map<string, PersonalCalibrationRow>();
  const { data, error } = await supabase
    .from('user_food_calibration')
    .select('food_name_normalized, sample_count, avg_ratio')
    .eq('user_id', userId)
    .in('food_name_normalized', names);

  if (error) {
    console.warn('[food-calibration] personal load failed:', error);
    return byName;
  }

  for (const row of (data ?? []) as PersonalCalibrationRow[]) {
    if (!row?.food_name_normalized) {
      continue;
    }
    byName.set(row.food_name_normalized, row);
  }

  return byName;
}

async function loadGlobalCalibration(
  names: string[],
): Promise<Map<string, GlobalCalibrationRow>> {
  const byName = new Map<string, GlobalCalibrationRow>();
  const { data, error } = await supabase
    .from('global_food_calibration')
    .select('food_name_normalized, sample_count, user_count, median_ratio')
    .in('food_name_normalized', names);

  if (error) {
    console.warn('[food-calibration] global load failed:', error);
    return byName;
  }

  for (const row of (data ?? []) as GlobalCalibrationRow[]) {
    if (!row?.food_name_normalized) {
      continue;
    }
    byName.set(row.food_name_normalized, row);
  }

  return byName;
}

/**
 * Scales AI gram estimates after resolve_foods.
 *
 * Correction order (first match wins):
 * 1. Personal user_food_calibration (sample_count >= 2, avg_ratio in [0.5, 2.0])
 * 2. Global median from global_food_calibration — only if GLOBAL_CALIBRATION_ENABLED
 *    (sample_count >= 5, user_count >= 3, median_ratio in [0.7, 1.4])
 * 3. No correction
 *
 * quantitySource stays 'ai' (calibrated value is the new AI baseline).
 */
export async function applyUserFoodCalibration(
  userId: string,
  items: EditableMealItem[],
): Promise<EditableMealItem[]> {
  const names = [
    ...new Set(
      items
        .map((item) => normalizeFoodName(item.canonicalName))
        .filter((name) => name.length > 0),
    ),
  ];

  if (names.length === 0) {
    return items;
  }

  const personalByName = await loadPersonalCalibration(userId, names);

  const namesWithoutPersonal = names.filter((name) => {
    const row = personalByName.get(name);
    return row == null || !shouldApplyPersonalCalibration(row);
  });

  // Behind the flag: inactive until GLOBAL_CALIBRATION_ENABLED is flipped.
  const globalByName =
    GLOBAL_CALIBRATION_ENABLED && namesWithoutPersonal.length > 0
      ? await loadGlobalCalibration(namesWithoutPersonal)
      : new Map<string, GlobalCalibrationRow>();

  return items.map((item) => {
    const key = normalizeFoodName(item.canonicalName);
    if (!key) {
      return item;
    }

    // 1. Personal calibration
    const personal = personalByName.get(key);
    if (personal && shouldApplyPersonalCalibration(personal)) {
      return applyRatioToItem(item, Number(personal.avg_ratio));
    }

    // 2. Global median (flag-gated)
    if (GLOBAL_CALIBRATION_ENABLED) {
      const global = globalByName.get(key);
      if (global && shouldApplyGlobalCalibration(global)) {
        return applyRatioToItem(item, Number(global.median_ratio));
      }
    }

    // 3. No correction
    return item;
  });
}
