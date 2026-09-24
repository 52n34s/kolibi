/**
 * Catalog ladder integrity helpers.
 *
 * Progression (`stepNeighbor`) looks up `ladderStep ± 1`. Gaps or duplicates
 * silently stop variant_up / variant_down with no error and no log.
 */

export type LadderStepEntry = {
  ladderKey: string;
  ladderStep: number;
  catalogSlug?: string;
};

/**
 * Assert every ladder_key has steps 1..n with no gaps and no duplicates.
 * Throws AssertionError-style Error with a clear message on failure.
 */
export function assertContiguousLadderSteps(entries: readonly LadderStepEntry[]): void {
  const byKey = new Map<string, LadderStepEntry[]>();
  for (const entry of entries) {
    const list = byKey.get(entry.ladderKey) ?? [];
    list.push(entry);
    byKey.set(entry.ladderKey, list);
  }

  for (const [ladderKey, list] of [...byKey.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const steps = list.map((e) => e.ladderStep).sort((a, b) => a - b);
    const seen = new Set<number>();
    for (const step of steps) {
      if (seen.has(step)) {
        const slug = list.find((e) => e.ladderStep === step)?.catalogSlug;
        throw new Error(
          `ladder "${ladderKey}": duplicate ladder_step ${step}` +
            (slug ? ` (slug ${slug})` : ''),
        );
      }
      seen.add(step);
    }
    for (let expected = 1; expected <= steps.length; expected += 1) {
      if (steps[expected - 1] !== expected) {
        throw new Error(
          `ladder "${ladderKey}": expected contiguous steps 1..${steps.length}, got [${steps.join(', ')}]`,
        );
      }
    }
  }
}

/**
 * Expected catalog ladders after 20260924152000_beginner_ladder_steps.sql.
 * Keep in sync when adding or renumbering rungs.
 */
export const CATALOG_LADDER_RUNGS: Readonly<Record<string, readonly string[]>> = {
  pull_vertical: [
    'dead_hang',
    'active_hang',
    'negative_pull_up',
    'chin_up',
    'pull_up',
    'archer_pull_up',
  ],
  push_horizontal: [
    'wall_push_up',
    'incline_push_up',
    'push_up',
    'parallette_push_up',
    'archer_push_up',
    'pseudo_planche_push_up',
  ],
  push_vertical: [
    'elevated_hands_pike_push_up',
    'pike_push_up',
    'elevated_pike_push_up',
    'wall_handstand_push_up',
  ],
  squat_single: [
    'box_squat',
    'bodyweight_squat',
    'split_squat',
    'bulgarian_split_squat',
    'pistol_squat_box',
    'pistol_squat',
  ],
  hanging: ['lying_leg_raise', 'hanging_knee_raise', 'hanging_leg_raise', 'toes_to_bar'],
  dip: ['bench_dip_bent_knees', 'bench_dip', 'parallel_bar_dip', 'straight_bar_dip'],
  side_plank: ['side_plank_knees', 'side_plank', 'side_plank_leg_raise'],
  bridge: ['glute_bridge', 'single_leg_glute_bridge', 'single_leg_hip_thrust'],
  row: [
    'inverted_row_bent_knees',
    'inverted_row',
    'feet_elevated_inverted_row',
    'archer_row',
  ],
  hollow: ['tuck_hollow_hold', 'hollow_hold'],
  l_sit: ['l_sit', 'one_leg_l_sit', 'full_l_sit'],
};

export function catalogLadderEntriesFromRungs(
  rungs: Readonly<Record<string, readonly string[]>> = CATALOG_LADDER_RUNGS,
): LadderStepEntry[] {
  const entries: LadderStepEntry[] = [];
  for (const [ladderKey, slugs] of Object.entries(rungs)) {
    slugs.forEach((catalogSlug, index) => {
      entries.push({ ladderKey, ladderStep: index + 1, catalogSlug });
    });
  }
  return entries;
}
