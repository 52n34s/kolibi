/**
 * Reference answers for the plan builder: covered by plan-builder.test.ts and
 * printed as markdown by scripts/plan-wizard-examples.mts for reviews.
 */

import type { PlanWizardAnswers } from '@/lib/workouts/plan-builder';

export type PlanBuilderExample = { id: string; title: string; answers: PlanWizardAnswers };

export const PLAN_BUILDER_EXAMPLES: readonly PlanBuilderExample[] = [
  {
    id: 'beginner',
    title: 'Absolute beginner, no equipment, 2 days, 30 min',
    answers: {
      goal: 'fitness',
      days: 2,
      minutes: 30,
      equipment: [],
      assessment: { push: 0, pull: 0, legs: 0 },
      focus: 'balanced',
      cardio: 'none',
      scope: 'full',
    },
  },
  {
    id: 'advanced_chest',
    title: 'Advanced, bar and parallettes, 4 days, 60 min, focus chest and shoulders',
    answers: {
      goal: 'muscle',
      days: 4,
      minutes: 60,
      equipment: ['bar', 'parallettes'],
      assessment: { push: 3, pull: 2, legs: 2 },
      focus: 'chest_shoulders',
      cardio: 'none',
      scope: 'full',
    },
  },
  {
    id: 'five_days_cardio',
    title: '5 days, lots of cardio, fat loss, bar, 45 min',
    answers: {
      goal: 'fat_loss',
      days: 5,
      minutes: 45,
      equipment: ['bar'],
      assessment: { push: 2, pull: 1, legs: 2 },
      focus: 'balanced',
      cardio: 'lots',
      scope: 'full',
    },
  },
  {
    id: 'single_session',
    title: 'Just one workout, strength and skills, chest and shoulders, 45 min',
    answers: {
      goal: 'strength_skills',
      days: 3,
      minutes: 45,
      equipment: ['parallettes', 'rings'],
      assessment: { push: 2, pull: 2, legs: 1 },
      focus: 'chest_shoulders',
      cardio: 'some',
      scope: 'single',
    },
  },
];

export function getPlanBuilderExample(id: string): PlanWizardAnswers {
  const example = PLAN_BUILDER_EXAMPLES.find((entry) => entry.id === id);
  if (!example) {
    throw new Error(`unknown_plan_builder_example:${id}`);
  }
  return example.answers;
}
