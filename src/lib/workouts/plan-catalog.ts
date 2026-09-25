/**
 * Code-side snapshot of the exercise catalog for the rule based plan builder.
 *
 * Derived from 20260922102000_seed_exercise_catalog.sql,
 * 20260922105000_progression.sql and 20260924152000_beginner_ladder_steps.sql
 * (ladder steps after the beginner renumbering). buildPlan stays pure, so it
 * reads this table instead of the DB; saving resolves slugs to ids again.
 * Keep in sync when catalog rows, ladders or default ranges change.
 *
 * Equipment is not a DB column: it is the minimum gear the exercise needs,
 * any-of (empty = bodyweight, a chair or a wall is enough).
 */

import type { ExerciseKind } from '@/lib/workouts/types';

/** Gear the wizard asks for. "Nothing" is the empty list. */
export type PlanEquipment = 'bar' | 'parallettes' | 'rings' | 'backpack';

export const PLAN_EQUIPMENT: readonly PlanEquipment[] = ['bar', 'parallettes', 'rings', 'backpack'];

/** Muscle focus used for splits, assessment and swaps. */
export type PlanMuscle = 'push' | 'pull' | 'legs' | 'hips' | 'core';

export type PlanCatalogEntry = {
  slug: string;
  ladderKey: string | null;
  ladderStep: number | null;
  kind: ExerciseKind;
  perSide: boolean;
  /** default_reps / default_seconds */
  rangeMin: number;
  /** default_reps_max / default_seconds_max */
  rangeMax: number;
  defaultRestSeconds: number;
  /** Any one of these is enough; empty = no gear needed. */
  equipment: readonly PlanEquipment[];
  muscle: PlanMuscle;
  names: { de: string; en: string; es: string };
};

const BAR_OR_RINGS: readonly PlanEquipment[] = ['bar', 'rings'];

export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  // push_horizontal
  { slug: 'wall_push_up', ladderKey: 'push_horizontal', ladderStep: 1, kind: 'reps', perSide: false, rangeMin: 10, rangeMax: 20, defaultRestSeconds: 60, equipment: [], muscle: 'push', names: { de: 'Liegestütze an der Wand', en: 'Wall Push-ups', es: 'Flexiones en la pared' } },
  { slug: 'incline_push_up', ladderKey: 'push_horizontal', ladderStep: 2, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 15, defaultRestSeconds: 60, equipment: [], muscle: 'push', names: { de: 'Schräge Liegestütze', en: 'Incline Push-ups', es: 'Flexiones inclinadas' } },
  { slug: 'push_up', ladderKey: 'push_horizontal', ladderStep: 3, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 15, defaultRestSeconds: 60, equipment: [], muscle: 'push', names: { de: 'Liegestütze', en: 'Push-ups', es: 'Flexiones' } },
  { slug: 'parallette_push_up', ladderKey: 'push_horizontal', ladderStep: 4, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 12, defaultRestSeconds: 90, equipment: ['parallettes'], muscle: 'push', names: { de: 'Liegestütze auf Parallettes', en: 'Parallette Push-ups', es: 'Flexiones en paralelas' } },
  { slug: 'archer_push_up', ladderKey: 'push_horizontal', ladderStep: 5, kind: 'reps', perSide: true, rangeMin: 5, rangeMax: 8, defaultRestSeconds: 90, equipment: [], muscle: 'push', names: { de: 'Archer-Liegestütze', en: 'Archer Push-ups', es: 'Flexiones arquero' } },
  { slug: 'pseudo_planche_push_up', ladderKey: 'push_horizontal', ladderStep: 6, kind: 'reps', perSide: false, rangeMin: 5, rangeMax: 10, defaultRestSeconds: 90, equipment: [], muscle: 'push', names: { de: 'Pseudo-Planche-Liegestütze', en: 'Pseudo Planche Push-ups', es: 'Flexiones pseudo plancha' } },

  // push_vertical
  { slug: 'elevated_hands_pike_push_up', ladderKey: 'push_vertical', ladderStep: 1, kind: 'reps', perSide: false, rangeMin: 6, rangeMax: 12, defaultRestSeconds: 90, equipment: [], muscle: 'push', names: { de: 'Pike Push-ups, Hände erhöht', en: 'Elevated-Hands Pike Push-ups', es: 'Flexiones pike con manos elevadas' } },
  { slug: 'pike_push_up', ladderKey: 'push_vertical', ladderStep: 2, kind: 'reps', perSide: false, rangeMin: 6, rangeMax: 10, defaultRestSeconds: 90, equipment: [], muscle: 'push', names: { de: 'Pike Push-ups', en: 'Pike Push-ups', es: 'Flexiones pike' } },
  { slug: 'elevated_pike_push_up', ladderKey: 'push_vertical', ladderStep: 3, kind: 'reps', perSide: false, rangeMin: 6, rangeMax: 10, defaultRestSeconds: 90, equipment: [], muscle: 'push', names: { de: 'Pike Push-ups erhöht', en: 'Elevated Pike Push-ups', es: 'Flexiones pike elevadas' } },
  { slug: 'wall_handstand_push_up', ladderKey: 'push_vertical', ladderStep: 4, kind: 'reps', perSide: false, rangeMin: 3, rangeMax: 8, defaultRestSeconds: 120, equipment: [], muscle: 'push', names: { de: 'Handstand-Liegestütze an der Wand', en: 'Wall Handstand Push-ups', es: 'Flexiones en pino contra la pared' } },

  // dip
  { slug: 'bench_dip_bent_knees', ladderKey: 'dip', ladderStep: 1, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 15, defaultRestSeconds: 60, equipment: [], muscle: 'push', names: { de: 'Bankdips, Knie gebeugt', en: 'Bent-Knee Bench Dips', es: 'Fondos en banco con rodillas flexionadas' } },
  { slug: 'bench_dip', ladderKey: 'dip', ladderStep: 2, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 12, defaultRestSeconds: 60, equipment: [], muscle: 'push', names: { de: 'Bankdips', en: 'Bench Dips', es: 'Fondos en banco' } },
  { slug: 'parallel_bar_dip', ladderKey: 'dip', ladderStep: 3, kind: 'reps', perSide: false, rangeMin: 5, rangeMax: 10, defaultRestSeconds: 120, equipment: ['parallettes', 'rings'], muscle: 'push', names: { de: 'Barren-Dips', en: 'Parallel Bar Dips', es: 'Fondos en paralelas' } },
  { slug: 'straight_bar_dip', ladderKey: 'dip', ladderStep: 4, kind: 'reps', perSide: false, rangeMin: 5, rangeMax: 10, defaultRestSeconds: 120, equipment: ['bar'], muscle: 'push', names: { de: 'Dips an der geraden Stange', en: 'Straight Bar Dips', es: 'Fondos en barra recta' } },

  // pull_vertical
  { slug: 'dead_hang', ladderKey: 'pull_vertical', ladderStep: 1, kind: 'time', perSide: false, rangeMin: 15, rangeMax: 30, defaultRestSeconds: 60, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Hängen', en: 'Dead Hang', es: 'Colgarse' } },
  { slug: 'active_hang', ladderKey: 'pull_vertical', ladderStep: 2, kind: 'time', perSide: false, rangeMin: 15, rangeMax: 30, defaultRestSeconds: 60, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Aktives Hängen', en: 'Active Hang', es: 'Colgarse activo' } },
  { slug: 'negative_pull_up', ladderKey: 'pull_vertical', ladderStep: 3, kind: 'reps', perSide: false, rangeMin: 3, rangeMax: 6, defaultRestSeconds: 120, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Negative Klimmzüge', en: 'Negative Pull-ups', es: 'Dominadas negativas' } },
  { slug: 'chin_up', ladderKey: 'pull_vertical', ladderStep: 4, kind: 'reps', perSide: false, rangeMin: 3, rangeMax: 8, defaultRestSeconds: 120, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Chin-ups', en: 'Chin-ups', es: 'Dominadas supinas' } },
  { slug: 'pull_up', ladderKey: 'pull_vertical', ladderStep: 5, kind: 'reps', perSide: false, rangeMin: 3, rangeMax: 8, defaultRestSeconds: 120, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Klimmzüge', en: 'Pull-ups', es: 'Dominadas' } },
  { slug: 'archer_pull_up', ladderKey: 'pull_vertical', ladderStep: 6, kind: 'reps', perSide: true, rangeMin: 2, rangeMax: 5, defaultRestSeconds: 150, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Archer-Klimmzüge', en: 'Archer Pull-ups', es: 'Dominadas arquero' } },

  // row (inverted rows need a low bar or rings)
  { slug: 'inverted_row_bent_knees', ladderKey: 'row', ladderStep: 1, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 12, defaultRestSeconds: 90, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Barren-Rudern, Knie gebeugt', en: 'Bent-Knee Inverted Rows', es: 'Remo invertido con rodillas flexionadas' } },
  { slug: 'inverted_row', ladderKey: 'row', ladderStep: 2, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 12, defaultRestSeconds: 90, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Barren-Rudern', en: 'Inverted Rows', es: 'Remo invertido' } },
  { slug: 'feet_elevated_inverted_row', ladderKey: 'row', ladderStep: 3, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 12, defaultRestSeconds: 90, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Barren-Rudern, Füße erhöht', en: 'Feet-Elevated Inverted Rows', es: 'Remo invertido con pies elevados' } },
  { slug: 'archer_row', ladderKey: 'row', ladderStep: 4, kind: 'reps', perSide: true, rangeMin: 5, rangeMax: 8, defaultRestSeconds: 90, equipment: BAR_OR_RINGS, muscle: 'pull', names: { de: 'Archer-Rudern', en: 'Archer Rows', es: 'Remo arquero' } },

  // squat_single
  { slug: 'box_squat', ladderKey: 'squat_single', ladderStep: 1, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 15, defaultRestSeconds: 60, equipment: [], muscle: 'legs', names: { de: 'Kniebeuge zur Box', en: 'Box Squat', es: 'Sentadilla a caja' } },
  { slug: 'bodyweight_squat', ladderKey: 'squat_single', ladderStep: 2, kind: 'reps', perSide: false, rangeMin: 10, rangeMax: 20, defaultRestSeconds: 60, equipment: [], muscle: 'legs', names: { de: 'Kniebeuge', en: 'Bodyweight Squat', es: 'Sentadilla' } },
  { slug: 'split_squat', ladderKey: 'squat_single', ladderStep: 3, kind: 'reps', perSide: true, rangeMin: 8, rangeMax: 12, defaultRestSeconds: 60, equipment: [], muscle: 'legs', names: { de: 'Split Squats', en: 'Split Squats', es: 'Sentadilla dividida' } },
  { slug: 'bulgarian_split_squat', ladderKey: 'squat_single', ladderStep: 4, kind: 'reps', perSide: true, rangeMin: 8, rangeMax: 12, defaultRestSeconds: 90, equipment: [], muscle: 'legs', names: { de: 'Bulgarian Split Squats', en: 'Bulgarian Split Squats', es: 'Sentadilla búlgara' } },
  { slug: 'pistol_squat_box', ladderKey: 'squat_single', ladderStep: 5, kind: 'reps', perSide: true, rangeMin: 5, rangeMax: 8, defaultRestSeconds: 90, equipment: [], muscle: 'legs', names: { de: 'Pistol Squats auf Box', en: 'Box Pistol Squats', es: 'Sentadilla pistol a caja' } },
  { slug: 'pistol_squat', ladderKey: 'squat_single', ladderStep: 6, kind: 'reps', perSide: true, rangeMin: 3, rangeMax: 6, defaultRestSeconds: 120, equipment: [], muscle: 'legs', names: { de: 'Pistol Squats', en: 'Pistol Squats', es: 'Sentadilla pistol' } },

  // bridge
  { slug: 'glute_bridge', ladderKey: 'bridge', ladderStep: 1, kind: 'reps', perSide: false, rangeMin: 12, rangeMax: 20, defaultRestSeconds: 60, equipment: [], muscle: 'hips', names: { de: 'Beckenheben', en: 'Glute Bridge', es: 'Puente de glúteo' } },
  { slug: 'single_leg_glute_bridge', ladderKey: 'bridge', ladderStep: 2, kind: 'reps', perSide: true, rangeMin: 10, rangeMax: 15, defaultRestSeconds: 60, equipment: [], muscle: 'hips', names: { de: 'Einbeiniges Beckenheben', en: 'Single-Leg Glute Bridge', es: 'Puente de glúteo a una pierna' } },
  { slug: 'single_leg_hip_thrust', ladderKey: 'bridge', ladderStep: 3, kind: 'reps', perSide: true, rangeMin: 10, rangeMax: 15, defaultRestSeconds: 60, equipment: [], muscle: 'hips', names: { de: 'Einbeiniger Hip Thrust', en: 'Single-Leg Hip Thrust', es: 'Hip thrust a una pierna' } },

  // side_plank
  { slug: 'side_plank_knees', ladderKey: 'side_plank', ladderStep: 1, kind: 'time', perSide: true, rangeMin: 20, rangeMax: 40, defaultRestSeconds: 60, equipment: [], muscle: 'core', names: { de: 'Seitstütz auf den Knien', en: 'Kneeling Side Plank', es: 'Plancha lateral de rodillas' } },
  { slug: 'side_plank', ladderKey: 'side_plank', ladderStep: 2, kind: 'time', perSide: true, rangeMin: 20, rangeMax: 40, defaultRestSeconds: 60, equipment: [], muscle: 'core', names: { de: 'Seitstütz', en: 'Side Plank', es: 'Plancha lateral' } },
  { slug: 'side_plank_leg_raise', ladderKey: 'side_plank', ladderStep: 3, kind: 'time', perSide: true, rangeMin: 15, rangeMax: 30, defaultRestSeconds: 60, equipment: [], muscle: 'core', names: { de: 'Seitstütz mit Beinheben', en: 'Side Plank with Leg Raise', es: 'Plancha lateral con elevación de pierna' } },

  // hollow
  { slug: 'tuck_hollow_hold', ladderKey: 'hollow', ladderStep: 1, kind: 'time', perSide: false, rangeMin: 20, rangeMax: 40, defaultRestSeconds: 60, equipment: [], muscle: 'core', names: { de: 'Hollow Hold angehockt', en: 'Tuck Hollow Hold', es: 'Hollow hold encogido' } },
  { slug: 'hollow_hold', ladderKey: 'hollow', ladderStep: 2, kind: 'time', perSide: false, rangeMin: 20, rangeMax: 30, defaultRestSeconds: 60, equipment: [], muscle: 'core', names: { de: 'Hollow Hold', en: 'Hollow Hold', es: 'Hollow hold' } },

  // l_sit (floor L-sits are rarely doable, so parallettes are required)
  { slug: 'l_sit', ladderKey: 'l_sit', ladderStep: 1, kind: 'time', perSide: false, rangeMin: 10, rangeMax: 20, defaultRestSeconds: 90, equipment: ['parallettes'], muscle: 'core', names: { de: 'L-Sit angehockt', en: 'Tuck L-Sit', es: 'L-sit encogido' } },
  { slug: 'one_leg_l_sit', ladderKey: 'l_sit', ladderStep: 2, kind: 'time', perSide: true, rangeMin: 10, rangeMax: 20, defaultRestSeconds: 90, equipment: ['parallettes'], muscle: 'core', names: { de: 'L-Sit einbeinig', en: 'One-Leg L-Sit', es: 'L-sit a una pierna' } },
  { slug: 'full_l_sit', ladderKey: 'l_sit', ladderStep: 3, kind: 'time', perSide: false, rangeMin: 5, rangeMax: 15, defaultRestSeconds: 90, equipment: ['parallettes'], muscle: 'core', names: { de: 'L-Sit', en: 'L-Sit', es: 'L-sit' } },

  // hanging (lying leg raises need no bar)
  { slug: 'lying_leg_raise', ladderKey: 'hanging', ladderStep: 1, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 15, defaultRestSeconds: 60, equipment: [], muscle: 'core', names: { de: 'Liegendes Beinheben', en: 'Lying Leg Raises', es: 'Elevación de piernas tumbado' } },
  { slug: 'hanging_knee_raise', ladderKey: 'hanging', ladderStep: 2, kind: 'reps', perSide: false, rangeMin: 8, rangeMax: 15, defaultRestSeconds: 60, equipment: BAR_OR_RINGS, muscle: 'core', names: { de: 'Hängendes Knieheben', en: 'Hanging Knee Raises', es: 'Elevación de rodillas colgado' } },
  { slug: 'hanging_leg_raise', ladderKey: 'hanging', ladderStep: 3, kind: 'reps', perSide: false, rangeMin: 6, rangeMax: 12, defaultRestSeconds: 90, equipment: BAR_OR_RINGS, muscle: 'core', names: { de: 'Hängendes Beinheben', en: 'Hanging Leg Raises', es: 'Elevación de piernas colgado' } },
  { slug: 'toes_to_bar', ladderKey: 'hanging', ladderStep: 4, kind: 'reps', perSide: false, rangeMin: 5, rangeMax: 10, defaultRestSeconds: 90, equipment: ['bar'], muscle: 'core', names: { de: 'Toes to Bar', en: 'Toes to Bar', es: 'Pies a la barra' } },

  // no ladder (ytw_raise has no default_reps_max; 10 is its seed default_reps)
  { slug: 'ytw_raise', ladderKey: null, ladderStep: null, kind: 'reps', perSide: false, rangeMin: 6, rangeMax: 10, defaultRestSeconds: 60, equipment: [], muscle: 'pull', names: { de: 'Y-T-W', en: 'Y-T-W Raises', es: 'Y-T-W' } },
  { slug: 'backpack_row_single_arm', ladderKey: null, ladderStep: null, kind: 'reps', perSide: true, rangeMin: 10, rangeMax: 15, defaultRestSeconds: 60, equipment: ['backpack'], muscle: 'pull', names: { de: 'Rucksack-Rudern einarmig', en: 'Single-Arm Backpack Row', es: 'Remo a una mano con mochila' } },
  { slug: 'backpack_curl', ladderKey: null, ladderStep: null, kind: 'reps', perSide: false, rangeMin: 10, rangeMax: 15, defaultRestSeconds: 60, equipment: ['backpack'], muscle: 'pull', names: { de: 'Rucksack-Curls', en: 'Backpack Curls', es: 'Curl con mochila' } },
];

const BY_SLUG = new Map(PLAN_CATALOG.map((entry) => [entry.slug, entry]));

export function getPlanCatalogEntry(slug: string): PlanCatalogEntry | undefined {
  return BY_SLUG.get(slug);
}

/** Rungs of one ladder, lowest step first. */
export function planLadder(ladderKey: string): PlanCatalogEntry[] {
  return PLAN_CATALOG.filter((entry) => entry.ladderKey === ladderKey).sort(
    (a, b) => (a.ladderStep ?? 0) - (b.ladderStep ?? 0),
  );
}

/** True when the owned gear covers the exercise (any-of). */
export function hasPlanEquipment(
  entry: PlanCatalogEntry,
  owned: readonly PlanEquipment[],
): boolean {
  return entry.equipment.length === 0 || entry.equipment.some((item) => owned.includes(item));
}

/** Catalog name in the app language, English as fallback. */
export function planCatalogName(entry: PlanCatalogEntry, language: string): string {
  const lang = language.slice(0, 2);
  if (lang === 'de' || lang === 'es' || lang === 'en') {
    return entry.names[lang];
  }
  return entry.names.en;
}
