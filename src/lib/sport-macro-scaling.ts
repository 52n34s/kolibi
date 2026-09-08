/**
 * How training calories are split across carbs vs fat by intensity
 * (crossover concept: higher intensity → more carbohydrate oxidation).
 *
 * Protein is intentionally excluded — guidelines prescribe protein as g/kg
 * body mass per day, not per training bout.
 *
 * Carbohydrate is periodized to training load ("fuel for the work required").
 * Fat should stay ~20–35 % of daily energy; a fat share of sport calories
 * keeps training-day fat% from collapsing below 20 %.
 */

export const SportIntensity = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
} as const;

export type SportIntensity = (typeof SportIntensity)[keyof typeof SportIntensity];

/** Carb fraction of workout kcal by intensity. Rest → fat. */
export const SPORT_INTENSITY_CARB_FRACTION = {
  [SportIntensity.LOW]: 0.5,
  [SportIntensity.MODERATE]: 0.8,
  [SportIntensity.HIGH]: 0.95,
} as const satisfies Record<SportIntensity, number>;

/**
 * Named 80/20 split = MODERATE intensity (Prompt 2). Prefer
 * SPORT_INTENSITY_CARB_FRACTION for new intensity-aware call sites.
 */
export const SPORT_KCAL_MACRO_SPLIT = {
  carbs: SPORT_INTENSITY_CARB_FRACTION.MODERATE,
  fat: 0.2,
} as const;

/** Soft upper bound for carbohydrate goals; overflow is moved into fat. */
export const MAX_CARBS_G_PER_KG_BODY_WEIGHT = 10;

export const MACRO_KCAL_TOLERANCE = 2;

/** Ignore workouts shorter than this (avoids noisy HR spikes). */
export const MIN_SPORT_WORKOUT_DURATION_SECONDS = 5 * 60;

/** Estimated HRmax = 220 − age when no better value is stored. */
export const ESTIMATED_HR_MAX_BASE = 220;

export const HR_INTENSITY_THRESHOLDS = {
  /** Below this fraction of HRmax → LOW */
  moderateMin: 0.6,
  /** Above this fraction of HRmax → HIGH; between moderateMin and this → MODERATE */
  highMin: 0.8,
} as const;

/**
 * HKWorkoutActivityType raw values classified as LOW
 * (Spazieren, Wandern, Yoga, lockeres Radfahren, …).
 */
export const LOW_INTENSITY_WORKOUT_ACTIVITY_TYPES: ReadonlySet<number> = new Set([
  52, // walking
  24, // hiking
  57, // yoga
  13, // cycling (easy default; HR upgrades hard rides)
  29, // mindAndBody
  62, // flexibility
  66, // pilates
  72, // taiChi
  80, // cooldown
  33, // preparationAndRecovery
  70, // wheelchairWalkPace
  78, // socialDance
  58, // barre
]);

/**
 * HKWorkoutActivityType raw values classified as HIGH
 * (Intervalle, Tempoläufe/HIIT, Seilspringen, …).
 */
export const HIGH_INTENSITY_WORKOUT_ACTIVITY_TYPES: ReadonlySet<number> = new Set([
  63, // highIntensityIntervalTraining
  64, // jumpRope
  8, // boxing
  65, // kickboxing
  49, // trackAndField
  71, // wheelchairRunPace
]);

export type SportEnergySegment = {
  kcal: number;
  intensity: SportIntensity;
};

export type ScaleMacrosForSportInput = {
  basisKcal: number;
  /** Legacy: treat entire sport burn as MODERATE. Ignored when segments is set. */
  sportKcal?: number;
  /** Per-workout (and residual everyday) intensity segments. Prefer over sportKcal. */
  segments?: SportEnergySegment[];
  proteinG: number;
  fatBasisG: number;
  /** Stored base carbs; returned unchanged when sport energy === 0. */
  carbsBasisG: number;
  weightKg: number | null;
};

export type ScaleMacrosForSportSuccess = {
  ok: true;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** Extra carbs vs basis (for UI hint). 0 when no sport energy. */
  carbsFromSportG: number;
  totalKcal: number;
};

export type ScaleMacrosForSportFailure = {
  ok: false;
  reason: 'protein_fat_exceed_calories';
};

export type ScaleMacrosForSportResult =
  | ScaleMacrosForSportSuccess
  | ScaleMacrosForSportFailure;

function macroKcal(proteinG: number, fatG: number, carbsG: number): number {
  return proteinG * 4 + fatG * 9 + carbsG * 4;
}

export function estimatedMaxHeartRate(ageYears: number): number {
  return ESTIMATED_HR_MAX_BASE - ageYears;
}

export function classifyIntensityByHeartRate(
  averageHrBpm: number,
  maxHrBpm: number,
): SportIntensity {
  if (!(averageHrBpm > 0) || !(maxHrBpm > 0)) {
    return SportIntensity.MODERATE;
  }
  const fraction = averageHrBpm / maxHrBpm;
  if (fraction < HR_INTENSITY_THRESHOLDS.moderateMin) {
    return SportIntensity.LOW;
  }
  if (fraction > HR_INTENSITY_THRESHOLDS.highMin) {
    return SportIntensity.HIGH;
  }
  return SportIntensity.MODERATE;
}

/**
 * Fallback when no average HR is available.
 * Unknown activity types → MODERATE.
 */
export function classifyIntensityByWorkoutActivityType(
  activityType: number,
): SportIntensity {
  if (HIGH_INTENSITY_WORKOUT_ACTIVITY_TYPES.has(activityType)) {
    return SportIntensity.HIGH;
  }
  if (LOW_INTENSITY_WORKOUT_ACTIVITY_TYPES.has(activityType)) {
    return SportIntensity.LOW;
  }
  return SportIntensity.MODERATE;
}

export function resolveSportIntensity(params: {
  averageHrBpm: number | null;
  ageYears: number | null;
  activityType: number;
}): SportIntensity {
  if (
    params.averageHrBpm != null &&
    params.averageHrBpm > 0 &&
    params.ageYears != null &&
    params.ageYears > 0
  ) {
    return classifyIntensityByHeartRate(
      params.averageHrBpm,
      estimatedMaxHeartRate(params.ageYears),
    );
  }
  return classifyIntensityByWorkoutActivityType(params.activityType);
}

/** Continuous (unrounded) carb/fat grams from a single sport kcal block. */
export function sportKcalToMacroGrams(
  sportKcal: number,
  intensity: SportIntensity,
): { carbsG: number; fatG: number; carbsKcal: number; fatKcal: number } {
  const kcal = Math.max(0, sportKcal);
  const carbFraction = SPORT_INTENSITY_CARB_FRACTION[intensity];
  const carbsKcal = kcal * carbFraction;
  const fatKcal = kcal * (1 - carbFraction);
  return {
    carbsKcal,
    fatKcal,
    carbsG: carbsKcal / 4,
    fatG: fatKcal / 9,
  };
}

/**
 * Sum per-workout splits — never average intensities across the day.
 */
export function aggregateSportMacroEnergy(segments: SportEnergySegment[]): {
  carbsKcal: number;
  fatKcal: number;
  carbsG: number;
  fatG: number;
  totalKcal: number;
} {
  let carbsKcal = 0;
  let fatKcal = 0;
  let totalKcal = 0;
  for (const segment of segments) {
    if (!(segment.kcal > 0)) {
      continue;
    }
    const part = sportKcalToMacroGrams(segment.kcal, segment.intensity);
    carbsKcal += part.carbsKcal;
    fatKcal += part.fatKcal;
    totalKcal += segment.kcal;
  }
  return {
    carbsKcal,
    fatKcal,
    carbsG: carbsKcal / 4,
    fatG: fatKcal / 9,
    totalKcal,
  };
}

function resolveSegments(params: ScaleMacrosForSportInput): SportEnergySegment[] {
  if (params.segments != null) {
    return params.segments.filter((segment) => segment.kcal > 0);
  }
  const sportKcal = Math.max(0, params.sportKcal ?? 0);
  if (sportKcal === 0) {
    return [];
  }
  return [{ kcal: sportKcal, intensity: SportIntensity.MODERATE }];
}

/**
 * Scales fat/carbs so macro kcal sum matches basis + sport (± MACRO_KCAL_TOLERANCE).
 * Protein stays fixed. Empty sport energy returns the stored basis macros unchanged.
 */
export function scaleMacrosForSportCalories(
  params: ScaleMacrosForSportInput,
): ScaleMacrosForSportResult {
  const proteinG = Math.round(params.proteinG);
  const fatBasisG = Math.round(params.fatBasisG);
  const carbsBasisG = Math.round(params.carbsBasisG);
  const segments = resolveSegments(params);
  const aggregated = aggregateSportMacroEnergy(segments);
  const sportKcal = aggregated.totalKcal;
  const basisKcal = params.basisKcal;
  const totalKcal = basisKcal + sportKcal;

  if (sportKcal === 0) {
    return {
      ok: true,
      proteinG,
      fatG: fatBasisG,
      carbsG: carbsBasisG,
      carbsFromSportG: 0,
      totalKcal: basisKcal,
    };
  }

  // Continuous split: fat gets intensity-weighted sport share; carbs fill residual.
  let fatG = fatBasisG + aggregated.fatG;
  let carbsG = (totalKcal - proteinG * 4 - fatG * 9) / 4;

  if (carbsG < 0 || proteinG * 4 + fatG * 9 > totalKcal) {
    return { ok: false, reason: 'protein_fat_exceed_calories' };
  }

  if (params.weightKg != null && params.weightKg > 0) {
    const maxCarbsG = MAX_CARBS_G_PER_KG_BODY_WEIGHT * params.weightKg;
    if (carbsG > maxCarbsG) {
      const excessCarbsG = carbsG - maxCarbsG;
      carbsG = maxCarbsG;
      fatG += (excessCarbsG * 4) / 9;
    }
  }

  if (proteinG * 4 + fatG * 9 > totalKcal) {
    return { ok: false, reason: 'protein_fat_exceed_calories' };
  }

  let fatRounded = Math.round(fatG);
  let carbsRounded = Math.round((totalKcal - proteinG * 4 - fatRounded * 9) / 4);

  if (carbsRounded < 0) {
    return { ok: false, reason: 'protein_fat_exceed_calories' };
  }

  if (params.weightKg != null && params.weightKg > 0) {
    const maxCarbsG = Math.floor(MAX_CARBS_G_PER_KG_BODY_WEIGHT * params.weightKg);
    if (carbsRounded > maxCarbsG) {
      const excessCarbsG = carbsRounded - maxCarbsG;
      carbsRounded = maxCarbsG;
      fatRounded += Math.round((excessCarbsG * 4) / 9);
      const residualCarbs = Math.round((totalKcal - proteinG * 4 - fatRounded * 9) / 4);
      carbsRounded = Math.min(maxCarbsG, Math.max(0, residualCarbs));
    }
  }

  const maxCarbsAllowed =
    params.weightKg != null && params.weightKg > 0
      ? Math.floor(MAX_CARBS_G_PER_KG_BODY_WEIGHT * params.weightKg)
      : Number.POSITIVE_INFINITY;
  const errorFor = (carbs: number) =>
    Math.abs(macroKcal(proteinG, fatRounded, carbs) - totalKcal);
  if (
    carbsRounded + 1 <= maxCarbsAllowed &&
    errorFor(carbsRounded + 1) < errorFor(carbsRounded)
  ) {
    carbsRounded += 1;
  } else if (errorFor(carbsRounded - 1) < errorFor(carbsRounded) && carbsRounded - 1 >= 0) {
    carbsRounded -= 1;
  }

  if (errorFor(carbsRounded) > MACRO_KCAL_TOLERANCE) {
    for (const fatDelta of [1, -1]) {
      const trialFat = fatRounded + fatDelta;
      if (trialFat < 0) {
        continue;
      }
      let trialCarbs = Math.round((totalKcal - proteinG * 4 - trialFat * 9) / 4);
      if (trialCarbs < 0) {
        continue;
      }
      trialCarbs = Math.min(maxCarbsAllowed, trialCarbs);
      const trialError = (c: number) => Math.abs(macroKcal(proteinG, trialFat, c) - totalKcal);
      if (
        trialCarbs + 1 <= maxCarbsAllowed &&
        trialError(trialCarbs + 1) < trialError(trialCarbs)
      ) {
        trialCarbs += 1;
      } else if (trialError(trialCarbs - 1) < trialError(trialCarbs) && trialCarbs - 1 >= 0) {
        trialCarbs -= 1;
      }
      if (trialError(trialCarbs) < errorFor(carbsRounded)) {
        fatRounded = trialFat;
        carbsRounded = trialCarbs;
      }
    }
  }

  if (
    macroKcal(proteinG, fatRounded, carbsRounded) - totalKcal > MACRO_KCAL_TOLERANCE &&
    proteinG * 4 + fatRounded * 9 > totalKcal
  ) {
    return { ok: false, reason: 'protein_fat_exceed_calories' };
  }

  return {
    ok: true,
    proteinG,
    fatG: fatRounded,
    carbsG: carbsRounded,
    carbsFromSportG: Math.max(0, carbsRounded - carbsBasisG),
    totalKcal,
  };
}
