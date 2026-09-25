/**
 * Editor-facing recommended macros with German herleitung copy.
 * Numeric rules live in `macro-rules.ts` — this module only formats and
 * composes UI-ready values (and keeps fat % by training goal).
 *
 * Endurance (AUSDAUERLEISTUNG): lower protein via shared g/kg table; calorie
 * deficit for this goal should stay ≤ 200 kcal (ENDURANCE_MAX_DEFICIT_KCAL) —
 * callers own the calorie target.
 */

import {
  FIBER_G_PER_1000_KCAL,
  FIBER_MIN_G,
  FIBER_ROUND_TO_G,
  PROTEIN_G_PER_KG_BY_GOAL,
  fiberGForBasisKcal,
  proteinDietUpliftFraction,
  resolveProteinBezug,
} from './macro-rules';

export const MacroEmpfehlungsZiel = {
  ABNEHMEN: 'ABNEHMEN',
  HALTEN: 'HALTEN',
  MUSKELAUFBAU: 'MUSKELAUFBAU',
  AUSDAUERLEISTUNG: 'AUSDAUERLEISTUNG',
} as const;

export type MacroEmpfehlungsZiel =
  (typeof MacroEmpfehlungsZiel)[keyof typeof MacroEmpfehlungsZiel];

export const MacroErnaehrungsform = {
  OMNIVOR: 'OMNIVOR',
  VEGETARISCH: 'VEGETARISCH',
  VEGAN: 'VEGAN',
} as const;

export type MacroErnaehrungsform =
  (typeof MacroErnaehrungsform)[keyof typeof MacroErnaehrungsform];

/** Re-export shared g/kg table keyed for Empfohlenungs-Ziele. */
export const PROTEIN_G_PER_KG_BY_ZIEL: Record<MacroEmpfehlungsZiel, number> = {
  ABNEHMEN: PROTEIN_G_PER_KG_BY_GOAL.ABNEHMEN,
  HALTEN: PROTEIN_G_PER_KG_BY_GOAL.HALTEN,
  MUSKELAUFBAU: PROTEIN_G_PER_KG_BY_GOAL.MUSKELAUFBAU,
  AUSDAUERLEISTUNG: PROTEIN_G_PER_KG_BY_GOAL.AUSDAUERLEISTUNG,
};

/** Fat as a fraction of basis calories (editor display; unchanged). */
export const FAT_FRACTION_OF_BASIS_KCAL: Record<MacroEmpfehlungsZiel, number> = {
  ABNEHMEN: 0.25,
  HALTEN: 0.28,
  MUSKELAUFBAU: 0.25,
  AUSDAUERLEISTUNG: 0.25,
};

export { FIBER_G_PER_1000_KCAL, FIBER_MIN_G, FIBER_ROUND_TO_G };

/** Max daily calorie deficit recommended for AUSDAUERLEISTUNG. */
export const ENDURANCE_MAX_DEFICIT_KCAL = 200;

export type EmpfohlenerMakroWert = {
  wert: number;
  /** Human-readable German derivation for UI. */
  herleitung: string;
  /** Machine-readable fields so the UI need not parse `herleitung`. */
  details: Record<string, number | string | boolean>;
};

export type EmpfohleneMakros = {
  protein: EmpfohlenerMakroWert;
  fett: EmpfohlenerMakroWert;
  kohlenhydrate: EmpfohlenerMakroWert;
  ballaststoffe: EmpfohlenerMakroWert;
  /** Reference mass used for protein (kg). */
  proteinBezugsgewichtKg: number;
  /** Whether min() selected the target-weight candidate. */
  proteinBezugIstZielgewicht: boolean;
  bmi: number;
};

export type EmpfohleneMakrosInput = {
  ziel: MacroEmpfehlungsZiel;
  ernaehrungsform: MacroErnaehrungsform;
  gewichtKg: number;
  zielgewichtKg: number;
  groesseCm: number;
  /** Basis daily calorie goal (without sport add-on). */
  basisKcal: number;
};

export function calculateBmi(gewichtKg: number, groesseCm: number): number {
  const heightM = groesseCm / 100;
  if (!(heightM > 0) || !(gewichtKg > 0)) {
    return Number.NaN;
  }
  return gewichtKg / (heightM * heightM);
}

export type ProteinBezug = {
  bezugsgewichtKg: number;
  istZielgewicht: boolean;
  zielFloorAngewendet: boolean;
  bmi: number;
};

/**
 * Protein reference via shared min(current, BMI-25, floored target).
 * Kept as a thin wrapper so editor tests can call the Empfohlenungs API.
 */
export function resolveProteinBezugsgewicht(params: {
  gewichtKg: number;
  zielgewichtKg: number;
  groesseCm: number;
}): ProteinBezug {
  const bezug = resolveProteinBezug({
    weightKg: params.gewichtKg,
    heightCm: params.groesseCm,
    targetWeightKg: params.zielgewichtKg,
  });
  return {
    bezugsgewichtKg: bezug.bezugsgewichtKg,
    istZielgewicht: bezug.istZielgewicht,
    zielFloorAngewendet: bezug.zielFloorAngewendet,
    bmi: bezug.bmi ?? calculateBmi(params.gewichtKg, params.groesseCm),
  };
}

function formatDeNumber(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits).replace('.', ',');
}

function proteinBezugsLabel(params: {
  istZielgewicht: boolean;
  zielFloorAngewendet: boolean;
}): string {
  if (params.zielFloorAngewendet) {
    return 'BMI-20-Gewicht';
  }
  if (params.istZielgewicht) {
    return 'Zielgewicht';
  }
  return 'Körpergewicht';
}

function proteinBezugsart(params: {
  istZielgewicht: boolean;
  zielFloorAngewendet: boolean;
}): 'zielgewicht' | 'bmi20_floor' | 'koerpergewicht' {
  if (params.zielFloorAngewendet) {
    return 'bmi20_floor';
  }
  if (params.istZielgewicht) {
    return 'zielgewicht';
  }
  return 'koerpergewicht';
}

function formatProteinHerleitung(params: {
  proteinPerKg: number;
  istZielgewicht: boolean;
  zielFloorAngewendet: boolean;
  dietUplift: number;
}): string {
  const rate = formatDeNumber(params.proteinPerKg, 1);
  const weightLabel = proteinBezugsLabel(params);
  const base = `${rate} g pro kg ${weightLabel}`;
  if (params.dietUplift <= 0) {
    return base;
  }
  const percent = Math.round(params.dietUplift * 100);
  return `${base} · +${percent} % pflanzlich`;
}

function formatFatHerleitung(fatPercent: number, basisKcal: number): string {
  const percent = Math.round(fatPercent * 100);
  return `${percent} % der Basiskalorien (${Math.round(basisKcal)} kcal)`;
}

function formatCarbsHerleitung(): string {
  return 'Rest der Basiskalorien nach Protein und Fett';
}

function formatFiberHerleitung(basisKcal: number): string {
  return `${FIBER_G_PER_1000_KCAL} g je 1000 kcal · auf ${FIBER_ROUND_TO_G} g gerundet, mind. ${FIBER_MIN_G} g (${Math.round(basisKcal)} kcal)`;
}

/**
 * Computes recommended protein / fat / carbs / fiber with UI-ready derivations.
 */
export function computeEmpfohleneMakros(input: EmpfohleneMakrosInput): EmpfohleneMakros {
  const bezug = resolveProteinBezugsgewicht({
    gewichtKg: input.gewichtKg,
    zielgewichtKg: input.zielgewichtKg,
    groesseCm: input.groesseCm,
  });

  const proteinPerKg = PROTEIN_G_PER_KG_BY_ZIEL[input.ziel];
  const dietUplift = proteinDietUpliftFraction(input.ernaehrungsform);
  const proteinRaw = proteinPerKg * bezug.bezugsgewichtKg * (1 + dietUplift);
  const proteinG = Math.round(proteinRaw);

  const fatFraction = FAT_FRACTION_OF_BASIS_KCAL[input.ziel];
  const fatG = Math.round((input.basisKcal * fatFraction) / 9);

  const carbsRaw = (input.basisKcal - proteinG * 4 - fatG * 9) / 4;
  const carbsG = Math.round(Math.max(0, carbsRaw));

  const fiberG = fiberGForBasisKcal(input.basisKcal);

  return {
    bmi: bezug.bmi,
    proteinBezugsgewichtKg: bezug.bezugsgewichtKg,
    proteinBezugIstZielgewicht: bezug.istZielgewicht,
    protein: {
      wert: proteinG,
      herleitung: formatProteinHerleitung({
        proteinPerKg,
        istZielgewicht: bezug.istZielgewicht,
        zielFloorAngewendet: bezug.zielFloorAngewendet,
        dietUplift,
      }),
      details: {
        proteinPerKg,
        bezugsgewichtKg: bezug.bezugsgewichtKg,
        bezugsart: proteinBezugsart(bezug),
        zielFloorAngewendet: bezug.zielFloorAngewendet,
        dietUplift,
        dietUpliftPercent: Math.round(dietUplift * 100),
      },
    },
    fett: {
      wert: fatG,
      herleitung: formatFatHerleitung(fatFraction, input.basisKcal),
      details: {
        fatFraction,
        fatPercent: Math.round(fatFraction * 100),
        basisKcal: input.basisKcal,
      },
    },
    kohlenhydrate: {
      wert: carbsG,
      herleitung: formatCarbsHerleitung(),
      details: {
        basisKcal: input.basisKcal,
        proteinKcal: proteinG * 4,
        fatKcal: fatG * 9,
      },
    },
    ballaststoffe: {
      wert: fiberG,
      herleitung: formatFiberHerleitung(input.basisKcal),
      details: {
        gPer1000Kcal: FIBER_G_PER_1000_KCAL,
        roundToG: FIBER_ROUND_TO_G,
        minG: FIBER_MIN_G,
        basisKcal: input.basisKcal,
      },
    },
  };
}

export type ProfileGoalForZiel =
  | 'lose_weight'
  | 'faster_weight_loss'
  | 'maintain'
  | 'gain_weight'
  | 'build_muscle'
  | 'strength'
  | 'endurance';

const PROFILE_GOALS_FOR_ZIEL = [
  'lose_weight',
  'faster_weight_loss',
  'maintain',
  'gain_weight',
  'build_muscle',
  'strength',
  'endurance',
] as const satisfies readonly ProfileGoalForZiel[];

function isProfileGoalForZiel(value: string): value is ProfileGoalForZiel {
  return (PROFILE_GOALS_FOR_ZIEL as readonly string[]).includes(value);
}

/**
 * Maps recommendation ziel into profiles.goal_type.
 *
 * Several goal types share one ziel (gain_weight/build_muscle/strength → MUSKELAUFBAU,
 * lose_weight/faster_weight_loss → ABNEHMEN), so `currentGoalType` keeps the
 * one the user already has. Without it, saving macros silently rewrites their
 * goal — and with it their calorie target — to this function's default pick.
 */
export function mapEmpfehlungsZielToProfileGoal(
  ziel: MacroEmpfehlungsZiel,
  currentGoalType?: string | null,
): ProfileGoalForZiel {
  if (
    currentGoalType != null &&
    isProfileGoalForZiel(currentGoalType) &&
    mapProfileGoalToEmpfehlungsZiel(currentGoalType) === ziel
  ) {
    return currentGoalType;
  }

  switch (ziel) {
    case MacroEmpfehlungsZiel.ABNEHMEN:
      return 'lose_weight';
    case MacroEmpfehlungsZiel.HALTEN:
      return 'maintain';
    case MacroEmpfehlungsZiel.MUSKELAUFBAU:
      return 'gain_weight';
    case MacroEmpfehlungsZiel.AUSDAUERLEISTUNG:
      return 'endurance';
    default: {
      const _exhaustive: never = ziel;
      return _exhaustive;
    }
  }
}

/** Maps stored onboarding / profile goal_type into the recommendation enum. */
export function mapProfileGoalToEmpfehlungsZiel(
  goalType: string | null | undefined,
): MacroEmpfehlungsZiel | null {
  switch (goalType) {
    case 'lose_weight':
    case 'faster_weight_loss':
      return MacroEmpfehlungsZiel.ABNEHMEN;
    case 'maintain':
      return MacroEmpfehlungsZiel.HALTEN;
    case 'gain_weight':
    case 'build_muscle':
    case 'strength':
      return MacroEmpfehlungsZiel.MUSKELAUFBAU;
    case 'endurance':
    case 'AUSDAUERLEISTUNG':
      return MacroEmpfehlungsZiel.AUSDAUERLEISTUNG;
    default:
      return null;
  }
}

/** Maps stored diet_preference into the recommendation enum. */
export function mapProfileDietToErnaehrungsform(
  dietPreference: string | null | undefined,
): MacroErnaehrungsform | null {
  switch (dietPreference) {
    case 'omnivore':
    case 'pescatarian':
      return MacroErnaehrungsform.OMNIVOR;
    case 'vegetarian':
      return MacroErnaehrungsform.VEGETARISCH;
    case 'vegan':
      return MacroErnaehrungsform.VEGAN;
    default:
      return null;
  }
}
