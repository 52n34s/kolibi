/**
 * Curated starter workout packages. Pure client constants — selecting a plan
 * materialises normal workout_templates via save_workout_template (OTA-safe).
 *
 * Side-effecting apply lives in apply-starter-plan.ts so unit tests stay Node-safe.
 */

import type { UnitColorKey } from '@/lib/workouts/types';

export type StarterPlanId = 'full_body_2x' | 'ppl_3x' | 'upper_lower_4x';

/** UI choice including the custom-plan path (no package to apply). */
export type StarterPlanChoiceId = StarterPlanId | 'custom';

export type StarterPlanExercise = {
  slug: string;
  sets: number;
  targetMin: number;
  targetMax: number;
};

export type StarterPlanSession = {
  /** i18n key for the template name stored on apply. */
  nameKey: string;
  shortLabel: string;
  color: UnitColorKey;
  /** Always empty — next-template rotation uses position. */
  weekdays: readonly number[];
  exercises: readonly StarterPlanExercise[];
};

export type StarterPlan = {
  id: StarterPlanId;
  titleKey: string;
  subtitleKey: string;
  /** i18n key for the equipment hint shown in the Block 15 preview. */
  equipmentKey: string;
  sessionsPerWeek: number;
  sessions: readonly StarterPlanSession[];
};

export const STARTER_PLANS: readonly StarterPlan[] = [
  {
    id: 'full_body_2x',
    titleKey: 'training.starterPlans.fullBody.title',
    subtitleKey: 'training.starterPlans.fullBody.subtitle',
    equipmentKey: 'training.starterPlans.fullBody.equipment',
    sessionsPerWeek: 2,
    sessions: [
      {
        nameKey: 'training.starterPlans.fullBody.sessionFullBody',
        shortLabel: 'GK',
        color: 'indigo',
        weekdays: [],
        exercises: [
          { slug: 'incline_push_up', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'inverted_row_bent_knees', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'split_squat', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'glute_bridge', sets: 3, targetMin: 10, targetMax: 15 },
          { slug: 'side_plank', sets: 2, targetMin: 20, targetMax: 40 },
        ],
      },
    ],
  },
  {
    id: 'ppl_3x',
    titleKey: 'training.starterPlans.ppl.title',
    subtitleKey: 'training.starterPlans.ppl.subtitle',
    equipmentKey: 'training.starterPlans.ppl.equipment',
    sessionsPerWeek: 3,
    sessions: [
      {
        nameKey: 'training.starterPlans.ppl.sessionPush',
        shortLabel: 'Ps',
        color: 'indigo',
        weekdays: [],
        exercises: [
          { slug: 'incline_push_up', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'pike_push_up', sets: 3, targetMin: 6, targetMax: 10 },
          { slug: 'bench_dip', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'tuck_hollow_hold', sets: 2, targetMin: 20, targetMax: 40 },
        ],
      },
      {
        nameKey: 'training.starterPlans.ppl.sessionPull',
        shortLabel: 'Pl',
        color: 'violet',
        weekdays: [],
        exercises: [
          { slug: 'negative_pull_up', sets: 3, targetMin: 3, targetMax: 6 },
          { slug: 'inverted_row_bent_knees', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'ytw_raise', sets: 2, targetMin: 10, targetMax: 15 },
          { slug: 'hanging_knee_raise', sets: 3, targetMin: 8, targetMax: 12 },
        ],
      },
      {
        nameKey: 'training.starterPlans.ppl.sessionLegs',
        shortLabel: 'Lg',
        color: 'teal',
        weekdays: [],
        exercises: [
          { slug: 'split_squat', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'glute_bridge', sets: 3, targetMin: 10, targetMax: 15 },
          { slug: 'side_plank', sets: 2, targetMin: 20, targetMax: 40 },
          { slug: 'tuck_hollow_hold', sets: 2, targetMin: 20, targetMax: 40 },
        ],
      },
    ],
  },
  {
    id: 'upper_lower_4x',
    titleKey: 'training.starterPlans.upperLower.title',
    subtitleKey: 'training.starterPlans.upperLower.subtitle',
    equipmentKey: 'training.starterPlans.upperLower.equipment',
    sessionsPerWeek: 4,
    sessions: [
      {
        nameKey: 'training.starterPlans.upperLower.sessionUpper',
        shortLabel: 'Ob',
        color: 'sky',
        weekdays: [],
        exercises: [
          { slug: 'incline_push_up', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'negative_pull_up', sets: 3, targetMin: 3, targetMax: 6 },
          { slug: 'pike_push_up', sets: 3, targetMin: 6, targetMax: 10 },
          { slug: 'inverted_row_bent_knees', sets: 3, targetMin: 8, targetMax: 12 },
        ],
      },
      {
        nameKey: 'training.starterPlans.upperLower.sessionLower',
        shortLabel: 'Un',
        color: 'amber',
        weekdays: [],
        exercises: [
          { slug: 'split_squat', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'glute_bridge', sets: 3, targetMin: 10, targetMax: 15 },
          { slug: 'hanging_knee_raise', sets: 3, targetMin: 8, targetMax: 12 },
          { slug: 'side_plank', sets: 2, targetMin: 20, targetMax: 40 },
        ],
      },
    ],
  },
] as const;

export function getStarterPlan(planId: StarterPlanId): StarterPlan {
  const plan = STARTER_PLANS.find((entry) => entry.id === planId);
  if (!plan) {
    throw new Error(`unknown_starter_plan:${planId}`);
  }
  return plan;
}

/** Unique catalog slugs referenced by a plan (stable order of first appearance). */
export function collectStarterPlanSlugs(plan: StarterPlan): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const session of plan.sessions) {
    for (const exercise of session.exercises) {
      if (seen.has(exercise.slug)) {
        continue;
      }
      seen.add(exercise.slug);
      slugs.push(exercise.slug);
    }
  }
  return slugs;
}

export class StarterPlanMissingSlugsError extends Error {
  readonly missingSlugs: readonly string[];

  constructor(missingSlugs: readonly string[]) {
    super(`starter_plan_missing_slugs:${missingSlugs.join(',')}`);
    this.name = 'StarterPlanMissingSlugsError';
    this.missingSlugs = missingSlugs;
  }
}
