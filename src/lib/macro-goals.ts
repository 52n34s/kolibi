import {
  fiberGForBasisKcal,
  proteinDietMultiplier,
  resolveProteinPerKgBase,
  resolveProteinRefKg,
} from './macro-rules';

export type MacroGoalsInput = {
  dailyCalorieGoal: number;
  weightKg: number | null;
  heightCm: number | null;
  targetWeightKg: number | null;
  goalType: string | null;
  dietPreference: string | null;
  birthDate: string | null;
  tdee?: number | null;
};

export type MacroGoalsResult = {
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  proteinPerKg: number | null;
  proteinRefKg: number | null;
};

export type MacroGoalPlausibility = {
  ok: boolean;
  reason?: string;
};

/** Calendar age from YYYY-MM-DD; null if missing or unparseable. */
function ageFromBirthDate(birthDate: string | null): number | null {
  if (birthDate == null) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const monthIndex = month - 1;
  if (
    today.getMonth() < monthIndex ||
    (today.getMonth() === monthIndex && today.getDate() < day)
  ) {
    age -= 1;
  }

  return age;
}

export function computeMacroGoals(input: MacroGoalsInput): MacroGoalsResult {
  const nullResult: MacroGoalsResult = {
    proteinG: null,
    fatG: null,
    carbsG: null,
    fiberG: null,
    proteinPerKg: null,
    proteinRefKg: null,
  };

  if (input.weightKg == null) {
    return nullResult;
  }

  const proteinRefKg = resolveProteinRefKg({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    targetWeightKg: input.targetWeightKg,
  });

  let proteinPerKg = resolveProteinPerKgBase({
    goalType: input.goalType,
    dailyCalorieGoal: input.dailyCalorieGoal,
    tdee: input.tdee,
  });

  const age = ageFromBirthDate(input.birthDate);
  if (age != null && age >= 65) {
    proteinPerKg = proteinPerKg * 1.2;
  }

  proteinPerKg = proteinPerKg * proteinDietMultiplier(input.dietPreference);

  const proteinG = Math.round(proteinPerKg * proteinRefKg);
  const fatFromCalories = (0.25 * input.dailyCalorieGoal) / 9;
  const fatFloor = 0.7 * proteinRefKg;
  const fatG = Math.round(Math.max(fatFromCalories, fatFloor));
  const fiberG = fiberGForBasisKcal(input.dailyCalorieGoal);
  const carbsRaw = (input.dailyCalorieGoal - proteinG * 4 - fatG * 9) / 4;
  const carbsG = Math.round(Math.max(0, carbsRaw));

  return {
    proteinG,
    fatG,
    carbsG,
    fiberG,
    proteinPerKg: Math.round(proteinPerKg * 100) / 100,
    proteinRefKg,
  };
}

export function isMacroGoalPlausible(
  proteinG: number,
  fatG: number,
  dailyCalorieGoal: number,
): MacroGoalPlausibility {
  if (proteinG * 4 + fatG * 9 > 0.85 * dailyCalorieGoal) {
    return {
      ok: false,
      reason: 'protein_and_fat_exceed_85_percent_of_calories',
    };
  }

  return { ok: true };
}

/**
 * Suggested target_weight_kg from onboarding weight + goal_type.
 * Rounded to 0.5 kg. Floor at BMI 20 when height is known.
 */
export function suggestInitialTargetWeightKg(params: {
  weightKg: number;
  heightCm: number | null;
  goalType: string | null;
}): number {
  let factor = 1;
  switch (params.goalType) {
    case 'lose_weight':
      factor = 0.95;
      break;
    case 'faster_weight_loss':
      factor = 0.9;
      break;
    case 'gain_weight':
      factor = 1.05;
      break;
    default:
      // maintain, custom, null, unknown → unchanged
      factor = 1;
      break;
  }

  let suggested = params.weightKg * factor;

  if (params.heightCm != null && params.heightCm > 0) {
    const heightM = params.heightCm / 100;
    const bmi20Kg = 20 * heightM * heightM;
    if (suggested < bmi20Kg) {
      suggested = bmi20Kg;
    }
  }

  return Math.round(suggested * 2) / 2;
}
