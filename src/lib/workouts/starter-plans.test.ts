import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  STARTER_PLANS,
  collectStarterPlanSlugs,
  type StarterPlan,
} from './starter-plans.ts';

/**
 * Catalog shape needed for starter-plan validation (seed + progression +
 * beginner_ladder_steps). Keep in sync when ladders change.
 *
 * Starter plans still reference the former bottom rungs (e.g. negative_pull_up);
 * which step a new user should start on is decided separately — do not require
 * ladder_step === 1 here.
 */
const CATALOG: Record<
  string,
  { ladderKey: string | null; ladderStep: number | null; kind: 'reps' | 'time' }
> = {
  incline_push_up: { ladderKey: 'push_horizontal', ladderStep: 2, kind: 'reps' },
  inverted_row_bent_knees: { ladderKey: 'row', ladderStep: 1, kind: 'reps' },
  split_squat: { ladderKey: 'squat_single', ladderStep: 3, kind: 'reps' },
  glute_bridge: { ladderKey: 'bridge', ladderStep: 1, kind: 'reps' },
  side_plank: { ladderKey: 'side_plank', ladderStep: 2, kind: 'time' },
  pike_push_up: { ladderKey: 'push_vertical', ladderStep: 2, kind: 'reps' },
  bench_dip: { ladderKey: 'dip', ladderStep: 2, kind: 'reps' },
  tuck_hollow_hold: { ladderKey: 'hollow', ladderStep: 1, kind: 'time' },
  negative_pull_up: { ladderKey: 'pull_vertical', ladderStep: 3, kind: 'reps' },
  ytw_raise: { ladderKey: null, ladderStep: null, kind: 'reps' },
  hanging_knee_raise: { ladderKey: 'hanging', ladderStep: 2, kind: 'reps' },
};

function assertPlanShape(plan: StarterPlan) {
  assert.ok(plan.equipmentKey.length > 0, `${plan.id}: equipmentKey required`);
  assert.match(plan.equipmentKey, /^training\.starterPlans\./);

  const labels = new Set<string>();
  for (const session of plan.sessions) {
    assert.equal(session.weekdays.length, 0, `${plan.id}: weekdays must be empty`);
    assert.ok(session.shortLabel.length >= 1 && session.shortLabel.length <= 2);
    assert.equal(
      labels.has(session.shortLabel),
      false,
      `${plan.id}: duplicate shortLabel ${session.shortLabel}`,
    );
    labels.add(session.shortLabel);

    for (const exercise of session.exercises) {
      assert.ok(
        exercise.targetMin <= exercise.targetMax,
        `${plan.id}/${exercise.slug}: targetMin > targetMax`,
      );
      const catalog = CATALOG[exercise.slug];
      assert.ok(catalog, `${plan.id}: unknown slug ${exercise.slug}`);
      if (catalog.ladderKey != null) {
        assert.ok(
          catalog.ladderStep != null && catalog.ladderStep >= 1,
          `${plan.id}/${exercise.slug}: expected ladder_step >= 1`,
        );
      } else {
        assert.equal(catalog.ladderStep, null);
      }
    }
  }
}

describe('STARTER_PLANS', () => {
  it('defines three applyable packages with unique ids', () => {
    assert.equal(STARTER_PLANS.length, 3);
    const ids = STARTER_PLANS.map((plan) => plan.id);
    assert.deepEqual(ids, ['full_body_2x', 'ppl_3x', 'upper_lower_4x']);
    assert.equal(new Set(ids).size, 3);
  });

  it('references only known catalog slugs with valid ranges', () => {
    for (const plan of STARTER_PLANS) {
      assertPlanShape(plan);
    }
  });

  it('sets ytw_raise targets explicitly to 10–15', () => {
    const pull = STARTER_PLANS.find((plan) => plan.id === 'ppl_3x')!.sessions[1]!;
    const ytw = pull.exercises.find((exercise) => exercise.slug === 'ytw_raise');
    assert.ok(ytw);
    assert.equal(ytw.targetMin, 10);
    assert.equal(ytw.targetMax, 15);
  });

  it('collectStarterPlanSlugs returns unique first-seen order', () => {
    const plan = STARTER_PLANS.find((entry) => entry.id === 'ppl_3x')!;
    const slugs = collectStarterPlanSlugs(plan);
    assert.deepEqual(slugs, [
      'incline_push_up',
      'pike_push_up',
      'bench_dip',
      'tuck_hollow_hold',
      'negative_pull_up',
      'inverted_row_bent_knees',
      'ytw_raise',
      'hanging_knee_raise',
      'split_squat',
      'glute_bridge',
      'side_plank',
    ]);
    assert.equal(slugs.length, new Set(slugs).size);
  });

  it('matches sessionsPerWeek to the number of sessions for A and B; C is 4× with 2 sessions', () => {
    assert.equal(STARTER_PLANS[0]!.sessionsPerWeek, 2);
    assert.equal(STARTER_PLANS[0]!.sessions.length, 1);
    assert.equal(STARTER_PLANS[1]!.sessionsPerWeek, 3);
    assert.equal(STARTER_PLANS[1]!.sessions.length, 3);
    assert.equal(STARTER_PLANS[2]!.sessionsPerWeek, 4);
    assert.equal(STARTER_PLANS[2]!.sessions.length, 2);
  });
});
