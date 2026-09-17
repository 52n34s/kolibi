/**
 * Single source of truth for macro-goal rules shared by:
 * - `macro-goals.ts` (persistence / calorie_goals writes)
 * - `macro-recommendations.ts` (editor herleitung copy)
 *
 * Callers must not re-implement these formulas.
 */

/** BMI used only as a soft mass candidate inside min() — never as a hard switch. */
export const PROTEIN_REF_BMI25 = 25;

/**
 * Floor applied only to the *target* weight candidate (not current body mass).
 * Prevents ambitious targets from collapsing protein reference too far;
 * underweight users keep their actual weight as a possible min() pick.
 */
export const PROTEIN_REF_BMI_FLOOR = 20;

/**
 * Last-resort g/kg when goal_type is null/unknown and no TDEE is available.
 *
 * 1.2 g/kg is the sedentary, no-deficit reference. Users without a set
 * goal_type are not sedentary for that reason, and in a deficit needs are
 * higher, not lower. 1.6 is the lower end of the athletic corridor and the
 * safer fallback.
 */
export const PROTEIN_PER_KG_FALLBACK = 1.6;

/**
 * Protein reference mass = min(current, BMI-25 mass, floored target).
 * Target candidate = max(target, BMI-20 mass) when height is known.
 * A hard BMI threshold (e.g. switch to target above 27) would jump the goal
 * when BMI crosses the line; min() changes continuously as inputs move.
 */
export function resolveProteinRefKg(params: {
  weightKg: number;
  heightCm: number | null;
  targetWeightKg: number | null;
}): number {
  return resolveProteinBezug(params).bezugsgewichtKg;
}

export type ProteinBezugKind = 'current' | 'bmi25' | 'target';

export type ProteinBezugResult = {
  bezugsgewichtKg: number;
  kind: ProteinBezugKind;
  /**
   * True when the min() pick was the target candidate and the BMI-20 floor
   * did not raise it — i.e. the kg is the user's stated target weight.
   */
  istZielgewicht: boolean;
  /**
   * True when the winning candidate is the target path *and* the BMI-20
   * floor raised that candidate above the stated target.
   */
  zielFloorAngewendet: boolean;
  bmi: number | null;
};

export function resolveProteinBezug(params: {
  weightKg: number;
  heightCm: number | null;
  targetWeightKg: number | null;
}): ProteinBezugResult {
  type Candidate = {
    kg: number;
    kind: ProteinBezugKind;
    zielFloorAngewendet: boolean;
  };
  const candidates: Candidate[] = [
    { kg: params.weightKg, kind: 'current', zielFloorAngewendet: false },
  ];

  let bmi: number | null = null;
  let heightM: number | null = null;
  if (params.heightCm != null && params.heightCm > 0) {
    heightM = params.heightCm / 100;
    bmi = params.weightKg / (heightM * heightM);
    candidates.push({
      kg: PROTEIN_REF_BMI25 * heightM * heightM,
      kind: 'bmi25',
      zielFloorAngewendet: false,
    });
  }

  if (params.targetWeightKg != null && params.targetWeightKg > 0) {
    let zielKandidat = params.targetWeightKg;
    let zielFloorAngewendet = false;
    // Floor only on the target candidate — never on current weight.
    if (heightM != null) {
      const floorKg = PROTEIN_REF_BMI_FLOOR * heightM * heightM;
      if (floorKg > zielKandidat) {
        zielKandidat = floorKg;
        zielFloorAngewendet = true;
      }
    }
    candidates.push({ kg: zielKandidat, kind: 'target', zielFloorAngewendet });
  }

  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i += 1) {
    const next = candidates[i]!;
    if (next.kg < best.kg) {
      best = next;
    }
  }

  return {
    bezugsgewichtKg: best.kg,
    kind: best.kind,
    istZielgewicht: best.kind === 'target' && !best.zielFloorAngewendet,
    zielFloorAngewendet: best.kind === 'target' && best.zielFloorAngewendet,
    bmi,
  };
}

/** Protein g/kg before diet multiplier — when an explicit training goal is known. */
export const PROTEIN_G_PER_KG_BY_GOAL = {
  lose_weight: 1.8,
  faster_weight_loss: 1.8,
  maintain: 1.6,
  gain_weight: 1.8,
  build_muscle: 1.8,
  endurance: 1.5,
  /** Editor / Empfohlenungs-Ziele (same numbers). */
  ABNEHMEN: 1.8,
  HALTEN: 1.6,
  MUSKELAUFBAU: 1.8,
  AUSDAUERLEISTUNG: 1.5,
} as const;

export type ProteinGoalKey = keyof typeof PROTEIN_G_PER_KG_BY_GOAL;

export function proteinPerKgForExplicitGoal(goalType: string): number | null {
  if (Object.prototype.hasOwnProperty.call(PROTEIN_G_PER_KG_BY_GOAL, goalType)) {
    return PROTEIN_G_PER_KG_BY_GOAL[goalType as ProteinGoalKey];
  }
  return null;
}

/**
 * Fallback when goal_type is null (legacy profiles / skip paths):
 * derive g/kg from calorie deficit vs TDEE.
 */
export function proteinPerKgFromDeficitShare(
  dailyCalorieGoal: number,
  tdee: number,
): number {
  const deficitShare = 1 - dailyCalorieGoal / tdee;

  if (deficitShare < 0) {
    return 1.6;
  }
  if (deficitShare < 0.1) {
    return 1.2;
  }
  if (deficitShare <= 0.2) {
    return 1.6;
  }
  return 1.8;
}

/**
 * Hybrid g/kg: explicit goal wins; otherwise deficit share when TDEE is known;
 * otherwise PROTEIN_PER_KG_FALLBACK. Never returns null.
 */
export function resolveProteinPerKgBase(params: {
  goalType: string | null;
  dailyCalorieGoal: number;
  tdee: number | null | undefined;
}): number {
  if (params.goalType != null) {
    const fromGoal = proteinPerKgForExplicitGoal(params.goalType);
    if (fromGoal != null) {
      return fromGoal;
    }
  }

  if (params.tdee != null && params.tdee > 0) {
    return proteinPerKgFromDeficitShare(params.dailyCalorieGoal, params.tdee);
  }

  return PROTEIN_PER_KG_FALLBACK;
}

/** Diet multipliers on protein (vegan ×1.12 productive; vegetarian half uplift). */
export const PROTEIN_DIET_MULTIPLIER = {
  omnivore: 1,
  pescatarian: 1,
  vegetarian: 1.06,
  vegan: 1.12,
  OMNIVOR: 1,
  VEGETARISCH: 1.06,
  VEGAN: 1.12,
} as const;

export type ProteinDietKey = keyof typeof PROTEIN_DIET_MULTIPLIER;

export function proteinDietMultiplier(dietPreference: string | null | undefined): number {
  if (dietPreference == null) {
    return 1;
  }
  if (Object.prototype.hasOwnProperty.call(PROTEIN_DIET_MULTIPLIER, dietPreference)) {
    return PROTEIN_DIET_MULTIPLIER[dietPreference as ProteinDietKey];
  }
  return 1;
}

/** Additive uplift fraction for herleitung copy (0.12 → "+12 %"). */
export function proteinDietUpliftFraction(dietPreference: string | null | undefined): number {
  const multiplier = proteinDietMultiplier(dietPreference);
  // Avoid IEEE noise from 1.12 - 1 / 1.06 - 1.
  if (multiplier === 1) return 0;
  if (multiplier === 1.06) return 0.06;
  if (multiplier === 1.12) return 0.12;
  return Math.round((multiplier - 1) * 100) / 100;
}

export const FIBER_G_PER_1000_KCAL = 14;
export const FIBER_ROUND_TO_G = 5;
/** DGE-oriented floor — low calorie goals must not push fiber below 30 g. */
export const FIBER_MIN_G = 30;

/** Fat must not fall below this per kg reference mass, whatever the calories do. */
export const FAT_G_PER_KG_FLOOR = 0.7;

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Fiber goal from basis kcal (no sport add-on):
 * max(30, round-to-5g(14 g per 1000 kcal)).
 */
export function fiberGForBasisKcal(basisKcal: number): number {
  if (!(basisKcal > 0)) {
    return FIBER_MIN_G;
  }
  const raw = (FIBER_G_PER_1000_KCAL * basisKcal) / 1000;
  const rounded = roundToNearest(raw, FIBER_ROUND_TO_G);
  return Math.max(FIBER_MIN_G, rounded);
}
