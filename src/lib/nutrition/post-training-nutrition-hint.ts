/**
 * The hint right after a finished session: what is still open on the plate.
 *
 * Fixed rules, no model. Only the two macros that matter after training get a
 * line, and only when enough is still missing to be worth saying. The order
 * follows the training kind — after strength protein leads, after a run the
 * carbs do.
 *
 * Every threshold lives in POST_TRAINING_HINT_RULES so tests and the report
 * point at the same numbers. A missing input (null) means unknown, and
 * unknown stays quiet.
 */

export type PostTrainingNutritionHintContext = {
  /** 'strength' | 'endurance' (running/cardio from manual or Health) */
  trainingKind: 'strength' | 'endurance';
  consumed: { proteinG: number | null; carbsG: number | null; fatG: number | null };
  targets: { proteinG: number | null; carbsG: number | null; fatG: number | null };
};

export type PostTrainingNutritionHintLine =
  | { kind: 'protein'; grams: number; messageKey: string; params: { g: number } }
  | { kind: 'carbs'; grams: number; messageKey: string; params: { g: number } }
  | { kind: 'fat'; messageKey: string };

export const POST_TRAINING_HINT_RULES = {
  /** Smallest open protein gap worth a line (grams). */
  minProteinG: 15,
  /** Smallest open carbs gap worth a line (grams). */
  minCarbsG: 30,
  /** Fat counts as "almost there" from 85 % of the day target. */
  fatAlmostRatio: 0.85,
} as const;

/** At most this many macro gap lines; the fat line comes on top. */
export const POST_TRAINING_MAX_MACRO_LINES = 2;

const K = 'postTraining';

type MacroKey = 'proteinG' | 'carbsG' | 'fatG';

/** Grams still missing to the day target, or null when unknown / too small. */
function gap(ctx: PostTrainingNutritionHintContext, macro: MacroKey, minRemaining: number): number | null {
  const consumed = ctx.consumed[macro];
  const target = ctx.targets[macro];
  if (consumed == null || !Number.isFinite(consumed) || consumed < 0) {
    return null;
  }
  if (target == null || !Number.isFinite(target) || target <= 0) {
    return null;
  }
  const remaining = Math.round(target - consumed);
  return remaining >= minRemaining ? remaining : null;
}

function proteinLine(ctx: PostTrainingNutritionHintContext): PostTrainingNutritionHintLine | null {
  const grams = gap(ctx, 'proteinG', POST_TRAINING_HINT_RULES.minProteinG);
  return grams == null
    ? null
    : { kind: 'protein', grams, messageKey: `${K}.protein`, params: { g: grams } };
}

function carbsLine(ctx: PostTrainingNutritionHintContext): PostTrainingNutritionHintLine | null {
  const grams = gap(ctx, 'carbsG', POST_TRAINING_HINT_RULES.minCarbsG);
  return grams == null
    ? null
    : { kind: 'carbs', grams, messageKey: `${K}.carbs`, params: { g: grams } };
}

/** Fat close to the target: what is left of the day fits leaner. */
function fatLine(ctx: PostTrainingNutritionHintContext): PostTrainingNutritionHintLine | null {
  const consumed = ctx.consumed.fatG;
  const target = ctx.targets.fatG;
  if (consumed == null || !Number.isFinite(consumed) || consumed < 0) {
    return null;
  }
  if (target == null || !Number.isFinite(target) || target <= 0) {
    return null;
  }
  return consumed / target >= POST_TRAINING_HINT_RULES.fatAlmostRatio
    ? { kind: 'fat', messageKey: `${K}.fat` }
    : null;
}

/**
 * At most two macro gap lines (protein ≥ 15 g open, carbs ≥ 30 g open),
 * ordered by training kind; optional fat line when fat ≥ 85 % of target.
 */
export function postTrainingNutritionHint(
  ctx: PostTrainingNutritionHintContext,
): PostTrainingNutritionHintLine[] {
  const protein = proteinLine(ctx);
  const carbs = carbsLine(ctx);
  const ordered = ctx.trainingKind === 'endurance' ? [carbs, protein] : [protein, carbs];
  const lines = ordered
    .filter((line): line is PostTrainingNutritionHintLine => line != null)
    .slice(0, POST_TRAINING_MAX_MACRO_LINES);
  const fat = fatLine(ctx);
  if (fat) {
    lines.push(fat);
  }
  return lines;
}
