import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CalorieSource,
  GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK,
  calculateDailyCalorieGoalForSource,
} from './calorie-goal-math.ts';
import { createSchemaProbe, isUnknownEnumValueError } from './db-schema-errors.ts';
import { goalCategoryForGoalType } from './goal-category.ts';
import { suggestInitialTargetWeightKg } from './macro-goals.ts';
import { mapEmpfehlungsZielToProfileGoal, mapProfileGoalToEmpfehlungsZiel } from './macro-recommendations.ts';
import { proteinPerKgForExplicitGoal } from './macro-rules.ts';
import { calculateDailyCalorieGoalDetails } from './onboarding-calorie-goal.ts';
import {
  hasStrengthChoice,
  rememberStrengthChoice,
  resolveDisplayedGoalType,
  resolveGoalTypeForWrite,
  strengthChoiceKey,
} from './strength-goal-fallback.ts';
import { createMemoryKvStorage } from './workouts/kv-storage.ts';

describe('strength fallback before the enum migration', () => {
  it('writes build_muscle while strength is unknown, strength once it exists', () => {
    assert.equal(resolveGoalTypeForWrite('strength', false), 'build_muscle');
    assert.equal(resolveGoalTypeForWrite('strength', true), 'strength');
    assert.equal(resolveGoalTypeForWrite('lose_weight', false), 'lose_weight');
  });

  it('remembers the choice only while build_muscle stands in for it', () => {
    const storage = createMemoryKvStorage();
    rememberStrengthChoice(storage, 'u1', { chosen: 'strength', written: 'build_muscle' });
    assert.equal(hasStrengthChoice(storage, 'u1'), true);
    assert.equal(hasStrengthChoice(storage, 'u2'), false);

    // After the migration the real value is written and the marker goes.
    rememberStrengthChoice(storage, 'u1', { chosen: 'strength', written: 'strength' });
    assert.equal(hasStrengthChoice(storage, 'u1'), false);
  });

  it('picking another goal drops the marker', () => {
    const storage = createMemoryKvStorage({ [strengthChoiceKey('u1')]: '1' });
    rememberStrengthChoice(storage, 'u1', { chosen: 'build_muscle', written: 'build_muscle' });
    assert.equal(hasStrengthChoice(storage, 'u1'), false);
  });

  it('shows build_muscle + marker as "Kraft und Skills"', () => {
    assert.equal(resolveDisplayedGoalType('build_muscle', true), 'strength');
    assert.equal(goalCategoryForGoalType(resolveDisplayedGoalType('build_muscle', true)), 'strength');
    assert.equal(resolveDisplayedGoalType('build_muscle', false), 'build_muscle');
    assert.equal(resolveDisplayedGoalType('maintain', true), 'maintain');
    assert.equal(resolveDisplayedGoalType(null, true), null);
  });

  it('enum probe: 22P02 means the value is missing, cached for the run', async () => {
    let calls = 0;
    const probe = createSchemaProbe(async () => {
      calls += 1;
      return { error: { code: '22P02', message: 'invalid input value for enum goal_type' } };
    }, isUnknownEnumValueError);
    assert.equal(await probe(), false);
    assert.equal(await probe(), false);
    assert.equal(calls, 1);
  });

  it('enum probe: success means strength can be written', async () => {
    const probe = createSchemaProbe(async () => ({ error: null }), isUnknownEnumValueError);
    assert.equal(await probe(), true);
  });

  it('enum probe: offline is not cached', async () => {
    let calls = 0;
    const probe = createSchemaProbe(async () => {
      calls += 1;
      return { error: { code: 'NETWORK', message: 'offline' } };
    }, isUnknownEnumValueError);
    assert.equal(await probe(), false);
    assert.equal(await probe(), false);
    assert.equal(calls, 2);
  });
});

describe('strength has the same effect as build_muscle', () => {
  const profile = {
    biologicalSex: 'female' as const,
    birthDate: new Date(1992, 4, 3),
    heightCm: 168,
    weightKg: 64,
    activityLevel: 'lightly_active' as const,
    today: new Date(2026, 8, 25),
  };

  it('same weekly change and protein g/kg', () => {
    assert.equal(
      GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK.strength,
      GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK.build_muscle,
    );
    assert.equal(proteinPerKgForExplicitGoal('strength'), 1.8);
    assert.equal(proteinPerKgForExplicitGoal('strength'), proteinPerKgForExplicitGoal('build_muscle'));
  });

  it('same calorie goal for every source', () => {
    for (const calorieSource of Object.values(CalorieSource)) {
      const strength = calculateDailyCalorieGoalForSource({
        ...profile,
        calorieSource,
        goalType: 'strength',
        observedMaintenanceKcal: 2100,
      });
      const muscle = calculateDailyCalorieGoalForSource({
        ...profile,
        calorieSource,
        goalType: 'build_muscle',
        observedMaintenanceKcal: 2100,
      });
      assert.deepEqual(strength, muscle, calorieSource);
    }
  });

  it('same onboarding summary numbers', () => {
    const base = { ...profile, calorieSource: CalorieSource.ACTIVITY_FACTOR };
    assert.deepEqual(
      calculateDailyCalorieGoalDetails({ ...base, goalType: 'strength' }),
      calculateDailyCalorieGoalDetails({ ...base, goalType: 'build_muscle' }),
    );
  });

  it('same recommendation ziel, kept on macro save, same target weight', () => {
    const ziel = mapProfileGoalToEmpfehlungsZiel('strength');
    assert.equal(ziel, mapProfileGoalToEmpfehlungsZiel('build_muscle'));
    assert.equal(mapEmpfehlungsZielToProfileGoal(ziel!, 'strength'), 'strength');
    assert.equal(
      suggestInitialTargetWeightKg({ weightKg: 64, heightCm: 168, goalType: 'strength' }),
      suggestInitialTargetWeightKg({ weightKg: 64, heightCm: 168, goalType: 'build_muscle' }),
    );
  });
});
