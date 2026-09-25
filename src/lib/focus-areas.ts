/**
 * The up to three topics someone picks for themselves in the goals screen.
 *
 * The goal already orders the recommendations (goal-focus.ts). Focus areas sit
 * on top of it: a chosen topic pulls its recommendations forward without
 * silencing anything else. The boost is one fixed step per topic and never
 * stacks — two focus areas hitting the same kind still move it by one step, so
 * inside the boosted group the goal's own order stays intact.
 *
 * The map is keyed by strings, not by a union: it covers both recommendation
 * kinds (recommendations.ts) and focus topics (goal-focus.ts), and a key that
 * no engine knows simply never matches.
 */

export const FOCUS_AREA_IDS = [
  'more_protein',
  'more_fiber',
  'more_training_energy',
  'better_recovery',
  'more_regular_meals',
] as const;

export type FocusAreaId = (typeof FOCUS_AREA_IDS)[number];

/** Three at a time — more and nothing stands out any more. */
export const FOCUS_AREA_MAX = 3;

/** How far a chosen topic moves up; ranks are sorted ascending. */
export const FOCUS_AREA_BOOST = 10;

/**
 * Which recommendation kinds and focus topics belong to each focus area.
 *
 * more_regular_meals has no rule of its own yet: it boosts the check-in (the
 * daily rhythm) and the meal distribution over the day, which is where meal
 * timing will land.
 */
export const FOCUS_AREA_TOPICS: Record<FocusAreaId, readonly string[]> = {
  more_protein: ['protein', 'meal_distribution'],
  more_fiber: ['fiber'],
  more_training_energy: [
    'carbs_training',
    'carbs_around_training',
    'carbs_before_training',
    'carbs_on_run_days',
  ],
  better_recovery: ['rest_day', 'checkin', 'recovery', 'daily_readiness'],
  more_regular_meals: ['checkin', 'meal_distribution', 'meal_gap'],
};

function isFocusAreaId(id: string): id is FocusAreaId {
  return (FOCUS_AREA_IDS as readonly string[]).includes(id);
}

/** Known ids only, without duplicates, at most FOCUS_AREA_MAX, order kept. */
export function clampFocusAreas(ids: readonly string[]): FocusAreaId[] {
  const out: FocusAreaId[] = [];
  for (const id of ids) {
    if (isFocusAreaId(id) && !out.includes(id)) {
      out.push(id);
    }
    if (out.length === FOCUS_AREA_MAX) {
      break;
    }
  }
  return out;
}

/**
 * topic → rank delta (negative: further up). Nothing chosen, or nothing
 * valid, gives an empty map, and the ranking stays as the goal had it.
 */
export function focusAreaBoost(
  focusAreas: readonly FocusAreaId[] | null | undefined,
): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const area of clampFocusAreas(focusAreas ?? [])) {
    for (const topic of FOCUS_AREA_TOPICS[area]) {
      out[topic] = -FOCUS_AREA_BOOST;
    }
  }
  return out;
}
