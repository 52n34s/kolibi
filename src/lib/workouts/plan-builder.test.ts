import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASSESSMENT_LEVELS,
  PLAN_CARDIO,
  PLAN_DAYS,
  PLAN_FOCUSES,
  PLAN_GOALS,
  PLAN_MINUTES,
  PLAN_SCOPES,
  buildPlan,
  collectBuiltPlanSlugs,
  estimateSessionMinutes,
  exercisesPerSession,
  formatPlanMarkdown,
  nearestAvailableRung,
  removePlanExercise,
  replacePlanExercise,
  restSecondsForGoal,
  startLadderStep,
  swapOptions,
  targetRangeForGoal,
  type BuiltPlan,
  type PlanWizardAnswers,
} from './plan-builder.ts';
import {
  getPlanCatalogEntry,
  hasPlanEquipment,
  type PlanEquipment,
} from './plan-catalog.ts';

const BEGINNER_RUNGS = new Set([
  'dead_hang',
  'active_hang',
  'wall_push_up',
  'elevated_hands_pike_push_up',
  'box_squat',
  'bodyweight_squat',
  'lying_leg_raise',
  'bench_dip_bent_knees',
  'side_plank_knees',
]);

function answers(overrides: Partial<PlanWizardAnswers> = {}): PlanWizardAnswers {
  return {
    goal: 'fitness',
    days: 3,
    minutes: 45,
    equipment: [],
    assessment: { push: 1, pull: 1, legs: 1 },
    focus: 'balanced',
    cardio: 'none',
    scope: 'full',
    ...overrides,
  };
}

function slugs(plan: BuiltPlan, sessionIndex: number): string[] {
  return plan.sessions[sessionIndex]!.exercises.map((exercise) => exercise.slug);
}

function assertPlanInvariants(plan: BuiltPlan, input: PlanWizardAnswers) {
  const perSession = exercisesPerSession(input.minutes);
  for (const session of plan.sessions) {
    const label = `${JSON.stringify(input)} ${session.kind}`;
    const sessionSlugs = session.exercises.map((exercise) => exercise.slug);
    assert.equal(new Set(sessionSlugs).size, sessionSlugs.length, `${label}: duplicate slug`);
    assert.ok(session.exercises.length <= perSession, `${label}: too many exercises`);
    assert.ok(session.exercises.length >= Math.min(perSession, 3), `${label}: too few exercises`);

    const coreCount = session.exercises.filter((exercise) => exercise.muscle === 'core').length;
    if (input.minutes >= 30) {
      assert.ok(coreCount >= 1, `${label}: core from 30 minutes`);
    } else {
      // At 20 minutes core only fills in when the gear leaves too few main exercises.
      const mainCount = session.exercises.length - coreCount;
      assert.ok(coreCount === 0 || mainCount < perSession, `${label}: no core at 20 minutes`);
    }

    for (const exercise of session.exercises) {
      const entry = getPlanCatalogEntry(exercise.slug);
      assert.ok(entry, `${label}: unknown slug ${exercise.slug}`);
      assert.ok(hasPlanEquipment(entry, input.equipment), `${label}: gear for ${exercise.slug}`);
      assert.ok(exercise.sets >= 2 && exercise.sets <= 5, `${label}: sets ${exercise.sets}`);
      assert.ok(exercise.targetMin >= entry.rangeMin, `${label}: ${exercise.slug} min`);
      assert.ok(exercise.targetMax <= entry.rangeMax, `${label}: ${exercise.slug} max`);
      assert.ok(exercise.targetMin <= exercise.targetMax, `${label}: ${exercise.slug} range`);
    }

    assert.equal(session.estimatedMinutes, estimateSessionMinutes(session.exercises));
    const atMinimum = session.exercises.every((exercise) => exercise.sets <= 2);
    assert.ok(
      atMinimum || session.estimatedMinutes <= input.minutes,
      `${label}: ${session.estimatedMinutes} min over budget`,
    );
  }
}

describe('buildPlan — required cases', () => {
  it('absolute beginner without equipment, 2 days, 30 min', () => {
    const input = answers({
      days: 2,
      minutes: 30,
      equipment: [],
      assessment: { push: 0, pull: 0, legs: 0 },
    });
    const plan = buildPlan(input);

    assert.equal(plan.sessionsPerWeek, 2);
    assert.deepEqual(
      plan.sessions.map((session) => session.kind),
      ['full_a', 'full_b'],
    );
    assert.deepEqual(slugs(plan, 0), [
      'wall_push_up',
      'ytw_raise',
      'box_squat',
      'tuck_hollow_hold',
    ]);
    assert.deepEqual(slugs(plan, 1), [
      'ytw_raise',
      'elevated_hands_pike_push_up',
      'glute_bridge',
      'side_plank_knees',
    ]);
    // Pull-ups and rows need a bar: Y-T-W carries the pulling, noted for the preview.
    assert.deepEqual(plan.notes, ['pull_alternative']);
    // Beginner rungs from the beginner migration wherever a ladder allows it.
    for (const slug of collectBuiltPlanSlugs(plan)) {
      const entry = getPlanCatalogEntry(slug)!;
      if (entry.ladderStep != null) {
        assert.equal(entry.ladderStep, 1, `${slug} starts on rung 1`);
      }
    }
    assert.ok(collectBuiltPlanSlugs(plan).some((slug) => BEGINNER_RUNGS.has(slug)));
    // Beginners: 3 sets for the first two exercises, then 2.
    assert.deepEqual(
      plan.sessions[0]!.exercises.map((exercise) => exercise.sets),
      [3, 3, 2, 2],
    );
    assertPlanInvariants(plan, input);
  });

  it('advanced with bar and parallettes, 4 days, 60 min, focus chest', () => {
    const input = answers({
      goal: 'muscle',
      days: 4,
      minutes: 60,
      equipment: ['bar', 'parallettes'],
      assessment: { push: 3, pull: 2, legs: 2 },
      focus: 'chest_shoulders',
    });
    const plan = buildPlan(input);

    assert.equal(plan.sessionsPerWeek, 4);
    assert.deepEqual(
      plan.sessions.map((session) => session.kind),
      ['push', 'pull_legs'],
    );
    assert.deepEqual(slugs(plan, 0), [
      'parallette_push_up',
      'elevated_pike_push_up',
      'parallel_bar_dip',
      'push_up',
      'pike_push_up',
      'hollow_hold',
    ]);
    assert.deepEqual(slugs(plan, 1), [
      'pull_up',
      'split_squat',
      'feet_elevated_inverted_row',
      'single_leg_glute_bridge',
      'ytw_raise',
      'hanging_knee_raise',
    ]);
    assert.deepEqual(plan.notes, []);

    // Focus: push exercises get a set more, the rest stays at 3.
    const push = plan.sessions[0]!;
    for (const exercise of push.exercises) {
      assert.equal(exercise.sets, exercise.muscle === 'push' ? 4 : 3, exercise.slug);
    }
    assert.ok(plan.sessions[1]!.exercises.every((exercise) => exercise.sets === 3));

    const unfocused = buildPlan({ ...input, focus: 'balanced' });
    assert.ok(push.estimatedMinutes > unfocused.sessions[0]!.estimatedMinutes);
    assert.ok(push.estimatedMinutes <= 60);
    assertPlanInvariants(plan, input);
  });

  it('5 days with lots of cardio', () => {
    const input = answers({
      goal: 'fat_loss',
      days: 5,
      minutes: 45,
      equipment: ['bar'],
      assessment: { push: 2, pull: 1, legs: 2 },
      cardio: 'lots',
    });
    const plan = buildPlan(input);
    const withoutCardio = buildPlan({ ...input, cardio: 'none' });

    assert.equal(plan.sessionsPerWeek, 5);
    assert.deepEqual(
      plan.sessions.map((session) => session.kind),
      ['push', 'pull', 'legs'],
    );
    assert.deepEqual(slugs(plan, 2), [
      'split_squat',
      'single_leg_glute_bridge',
      'bodyweight_squat',
      'glute_bridge',
      'side_plank',
    ]);

    plan.sessions.forEach((session, sessionIndex) => {
      session.exercises.forEach((exercise, index) => {
        const before = withoutCardio.sessions[sessionIndex]!.exercises[index]!;
        assert.equal(exercise.slug, before.slug);
        const legs = exercise.muscle === 'legs' || exercise.muscle === 'hips';
        assert.equal(exercise.sets, legs ? before.sets - 1 : before.sets, exercise.slug);
      });
    });

    // Fat loss: shorter rests than the catalog default.
    for (const exercise of plan.sessions.flatMap((session) => session.exercises)) {
      const entry = getPlanCatalogEntry(exercise.slug)!;
      assert.ok(exercise.restSeconds < entry.defaultRestSeconds, exercise.slug);
    }
    assertPlanInvariants(plan, input);
  });

  it('just one workout follows the focus', () => {
    const input = answers({
      goal: 'strength_skills',
      minutes: 45,
      equipment: ['parallettes', 'rings'],
      assessment: { push: 2, pull: 2, legs: 1 },
      focus: 'chest_shoulders',
      cardio: 'some',
      scope: 'single',
    });
    const plan = buildPlan(input);

    assert.equal(plan.sessionsPerWeek, null);
    assert.equal(plan.sessions.length, 1);
    assert.equal(plan.sessions[0]!.kind, 'chest_shoulders');
    assert.deepEqual(slugs(plan, 0), [
      'push_up',
      'pike_push_up',
      'bench_dip',
      'incline_push_up',
      'l_sit',
    ]);
    // Strength & skills: lower rep ranges, longer rests.
    const pushUp = plan.sessions[0]!.exercises[0]!;
    assert.deepEqual([pushUp.targetMin, pushUp.targetMax], [8, 12]);
    assert.equal(pushUp.restSeconds, 90);

    for (const focus of PLAN_FOCUSES) {
      const single = buildPlan({ ...input, focus });
      assert.equal(single.sessions.length, 1);
    }
    assert.equal(buildPlan({ ...input, focus: 'legs' }).sessions[0]!.kind, 'legs');
    assert.equal(buildPlan({ ...input, focus: 'back' }).sessions[0]!.kind, 'back');
    assert.equal(buildPlan({ ...input, focus: 'upper' }).sessions[0]!.kind, 'upper');
    assert.equal(buildPlan({ ...input, focus: 'balanced' }).sessions[0]!.kind, 'full');
    assertPlanInvariants(plan, input);
  });
});

describe('buildPlan — rules', () => {
  it('maps minutes to exercise counts', () => {
    assert.deepEqual(
      PLAN_MINUTES.map((minutes) => exercisesPerSession(minutes)),
      [3, 4, 5, 6, 7],
    );
    for (const minutes of PLAN_MINUTES) {
      const plan = buildPlan(answers({ minutes, equipment: ['bar', 'parallettes'] }));
      for (const session of plan.sessions) {
        assert.equal(session.exercises.length, exercisesPerSession(minutes), `${minutes}`);
      }
    }
  });

  it('splits by days', () => {
    const kinds = (days: 2 | 3 | 4 | 5) =>
      buildPlan(answers({ days })).sessions.map((session) => session.kind);
    assert.deepEqual(kinds(2), ['full_a', 'full_b']);
    assert.deepEqual(kinds(3), ['full_a', 'full_b']);
    assert.deepEqual(kinds(4), ['push', 'pull_legs']);
    assert.deepEqual(kinds(5), ['push', 'pull', 'legs']);
    assert.equal(buildPlan(answers({ days: 3 })).sessionsPerWeek, 3);
  });

  it('starts pull-ups on negatives, hangs only for absolute beginners', () => {
    assert.equal(startLadderStep('pull_vertical', { push: 0, pull: 0, legs: 0 }), 1);
    assert.equal(startLadderStep('pull_vertical', { push: 1, pull: 0, legs: 0 }), 3);
    const plan = buildPlan(
      answers({ equipment: ['bar'], assessment: { push: 1, pull: 0, legs: 1 } }),
    );
    assert.equal(slugs(plan, 0)[1], 'negative_pull_up');
    assert.equal(slugs(plan, 1)[0], 'inverted_row_bent_knees');
  });

  it('picks the nearest rung the gear allows, easier on ties', () => {
    assert.equal(nearestAvailableRung('push_horizontal', 4, [])!.slug, 'push_up');
    assert.equal(
      nearestAvailableRung('push_horizontal', 4, ['parallettes'])!.slug,
      'parallette_push_up',
    );
    assert.equal(nearestAvailableRung('row', 2, []), null);
    assert.equal(nearestAvailableRung('hanging', 3, [])!.slug, 'lying_leg_raise');
  });

  it('uses the backpack row without a bar when a backpack is there', () => {
    const plan = buildPlan(answers({ equipment: ['backpack'] }));
    assert.ok(slugs(plan, 0).includes('backpack_row_single_arm'));
    assert.deepEqual(plan.notes, ['pull_alternative']);
  });

  it('adapts rest and ranges to the goal', () => {
    assert.equal(restSecondsForGoal(90, 'fat_loss'), 60);
    assert.equal(restSecondsForGoal(60, 'fat_loss'), 45);
    assert.equal(restSecondsForGoal(90, 'strength_skills'), 135);
    assert.equal(restSecondsForGoal(150, 'strength_skills'), 180);
    assert.equal(restSecondsForGoal(90, 'muscle'), 90);
    assert.deepEqual(
      targetRangeForGoal({ kind: 'reps', rangeMin: 8, rangeMax: 15 }, 'strength_skills'),
      { targetMin: 8, targetMax: 12 },
    );
    assert.deepEqual(
      targetRangeForGoal({ kind: 'reps', rangeMin: 5, rangeMax: 8 }, 'strength_skills'),
      { targetMin: 5, targetMax: 7 },
    );
    assert.deepEqual(
      targetRangeForGoal({ kind: 'time', rangeMin: 20, rangeMax: 40 }, 'strength_skills'),
      { targetMin: 20, targetMax: 40 },
    );
    assert.deepEqual(
      targetRangeForGoal({ kind: 'reps', rangeMin: 8, rangeMax: 12 }, 'muscle'),
      { targetMin: 8, targetMax: 12 },
    );
  });

  it('is pure: same answers, same plan, input untouched', () => {
    const input = answers({ equipment: ['bar'], focus: 'legs', cardio: 'lots' });
    const snapshot = JSON.stringify(input);
    assert.deepEqual(buildPlan(input), buildPlan(input));
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('holds its invariants across the answer space', () => {
    const gear: PlanEquipment[][] = [[], ['bar'], ['parallettes', 'rings'], ['backpack']];
    for (const goal of PLAN_GOALS) {
      for (const days of PLAN_DAYS) {
        for (const minutes of PLAN_MINUTES) {
          for (const equipment of gear) {
            for (const level of ASSESSMENT_LEVELS) {
              for (const focus of PLAN_FOCUSES) {
                for (const cardio of PLAN_CARDIO) {
                  for (const scope of PLAN_SCOPES) {
                    const input: PlanWizardAnswers = {
                      goal,
                      days,
                      minutes,
                      equipment,
                      assessment: { push: level, pull: level, legs: level },
                      focus,
                      cardio,
                      scope,
                    };
                    assertPlanInvariants(buildPlan(input), input);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

describe('plan preview edits', () => {
  const input = answers({ days: 2, minutes: 30, assessment: { push: 1, pull: 1, legs: 1 } });
  const plan = buildPlan(input);

  it('offers other rungs of the ladder first, then the same muscle, gear applied', () => {
    const session = plan.sessions[0]!;
    assert.equal(session.exercises[0]!.slug, 'incline_push_up');
    const options = swapOptions(session, 0, input.equipment).map((entry) => entry.slug);
    assert.deepEqual(options.slice(0, 4), [
      'wall_push_up',
      'push_up',
      'archer_push_up',
      'pseudo_planche_push_up',
    ]);
    assert.ok(!options.includes('parallette_push_up'));
    assert.ok(!options.includes('incline_push_up'));
    assert.ok(options.includes('pike_push_up'));
    assert.ok(options.every((slug) => getPlanCatalogEntry(slug)!.muscle === 'push'));
  });

  it('replaces an exercise keeping its sets, immutably', () => {
    const next = replacePlanExercise(plan, 0, 0, 'push_up', input.goal);
    const replaced = next.sessions[0]!.exercises[0]!;
    assert.equal(replaced.slug, 'push_up');
    assert.equal(replaced.sets, plan.sessions[0]!.exercises[0]!.sets);
    assert.deepEqual([replaced.targetMin, replaced.targetMax], [8, 15]);
    assert.equal(plan.sessions[0]!.exercises[0]!.slug, 'incline_push_up');
    assert.equal(next.sessions[1], plan.sessions[1]);
  });

  it('removes an exercise and updates the estimate', () => {
    const next = removePlanExercise(plan, 0, 3);
    assert.equal(next.sessions[0]!.exercises.length, plan.sessions[0]!.exercises.length - 1);
    assert.ok(next.sessions[0]!.estimatedMinutes < plan.sessions[0]!.estimatedMinutes);
    assert.equal(plan.sessions[0]!.exercises.length, 4);
  });
});

describe('formatPlanMarkdown', () => {
  it('renders one row per exercise with target and rest', () => {
    const plan = buildPlan(answers({ days: 2, minutes: 20, assessment: { push: 2, pull: 2, legs: 2 } }));
    const markdown = formatPlanMarkdown(plan, { language: 'en' });
    const lines = markdown.split('\n');
    assert.equal(lines[0], '| Session | Exercise | Sets | Target | Rest |');
    const rows = plan.sessions.reduce((sum, session) => sum + session.exercises.length, 0);
    assert.equal(lines.length, rows + 2);
    assert.match(lines[2]!, /^\| full_a \(~\d+ min\) \| `push_up` Push-ups \| 3 \| 8–15 \| 60 s \|$/);
    assert.match(markdown, /\/ side/);
  });
});
