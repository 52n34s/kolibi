import assert from 'node:assert/strict';
import test from 'node:test';

import { CalorieSource } from './calorie-goal-math';
import {
  calculateTargetWeightForecast,
  resolveForecastMacroGoalProfile,
} from './target-weight-forecast';

const baseInput = {
  currentWeightKg: 80,
  targetWeightKg: 70,
  dailyCalorieGoal: 1300,
  biologicalSex: 'female' as const,
  birthDate: new Date(1990, 0, 1),
  heightCm: 170,
  activityLevel: 'mostly_sitting' as const,
  calorieSource: CalorieSource.ACTIVITY_FACTOR,
  goalType: 'lose_weight' as const,
  macroGoalProfile: null,
  weighDaysLast30: 8,
  today: new Date(2026, 0, 1),
};

test('projects target weight iteratively as maintenance falls', () => {
  const forecast = calculateTargetWeightForecast(baseInput);

  assert.equal(forecast.status, 'ok');
  if (forecast.status !== 'ok') {
    return;
  }

  // A single-step calculation would use the initial deficit throughout and
  // arrives sooner; the weekly recalculation slows it down as weight falls.
  assert.ok(forecast.weeks > 20);
  assert.ok(forecast.weeks <= 104);
  assert.equal(forecast.etaDate.getDay(), 4);
});

test('does not show a forecast above one percent body weight per week', () => {
  assert.deepEqual(
    calculateTargetWeightForecast({ ...baseInput, dailyCalorieGoal: 500 }),
    { status: 'unavailable' },
  );
});

test('does not show a forecast for maintenance goals', () => {
  assert.deepEqual(
    calculateTargetWeightForecast({ ...baseInput, goalType: 'maintain' }),
    { status: 'unavailable' },
  );
});

test('does not show a weight forecast alongside muscle building', () => {
  assert.deepEqual(
    calculateTargetWeightForecast({ ...baseInput, macroGoalProfile: 'muscle' }),
    { status: 'muscle_building' },
  );
});

test('still forecasts when training twice a week without a muscle profile', () => {
  const forecast = calculateTargetWeightForecast(baseInput);
  assert.equal(forecast.status, 'ok');
});

test('requires eight weigh days in the last thirty days', () => {
  assert.deepEqual(
    calculateTargetWeightForecast({ ...baseInput, weighDaysLast30: 7 }),
    { status: 'unavailable' },
  );
});

test('does not show a forecast that would take more than 104 weeks', () => {
  assert.deepEqual(
    calculateTargetWeightForecast({ ...baseInput, dailyCalorieGoal: 1700 }),
    { status: 'unavailable' },
  );
});

test('returns unavailable when profile fields are missing', () => {
  assert.deepEqual(
    calculateTargetWeightForecast({
      ...baseInput,
      birthDate: null,
      heightCm: null,
      activityLevel: null,
      goalType: null,
    }),
    { status: 'unavailable' },
  );
});

test('a weight-gain goal forecasts a date instead of the muscle-building note', () => {
  // Regression: callers derived the profile from the macro mapping, which puts
  // gain_weight on MUSKELAUFBAU, so every gainer got `muscle_building`.
  assert.equal(resolveForecastMacroGoalProfile('gain_weight'), null);
  const forecast = calculateTargetWeightForecast({
    ...baseInput,
    currentWeightKg: 60,
    targetWeightKg: 64,
    dailyCalorieGoal: 2000,
    goalType: 'gain_weight',
    macroGoalProfile: resolveForecastMacroGoalProfile('gain_weight'),
  });
  assert.equal(forecast.status, 'ok');
});

test('only the recomposition goal counts as muscle building', () => {
  assert.equal(resolveForecastMacroGoalProfile('build_muscle'), 'muscle');
  assert.equal(resolveForecastMacroGoalProfile('lose_weight'), null);
  assert.equal(resolveForecastMacroGoalProfile(null), null);
});
