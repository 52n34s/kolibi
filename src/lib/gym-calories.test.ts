import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateGymCalories,
  GYM_MET_BY_INTENSITY,
  mapGymIntensityToSportIntensity,
} from './gym-calories.ts';
import { SportIntensity } from './sport-macro-scaling.ts';

describe('GYM_MET_BY_INTENSITY', () => {
  it('matches the approved intensity band', () => {
    assert.equal(GYM_MET_BY_INTENSITY.easy, 3.5);
    assert.equal(GYM_MET_BY_INTENSITY.normal, 5);
    assert.equal(GYM_MET_BY_INTENSITY.hard, 6);
  });
});

describe('mapGymIntensityToSportIntensity', () => {
  it('maps talk-test bands onto workout intensity bands', () => {
    assert.equal(mapGymIntensityToSportIntensity('easy'), SportIntensity.LOW);
    assert.equal(mapGymIntensityToSportIntensity('normal'), SportIntensity.MODERATE);
    assert.equal(mapGymIntensityToSportIntensity('hard'), SportIntensity.HIGH);
  });
});

describe('calculateGymCalories', () => {
  it('uses (MET − 1) × kg × hours and rounds', () => {
    // normal MET 5 → net 4; 80 kg × 1 h = 320
    assert.equal(
      calculateGymCalories({ weightKg: 80, durationMinutes: 60, intensity: 'normal' }),
      320,
    );
    // easy MET 3.5 → net 2.5; 80 kg × 0.5 h = 100
    assert.equal(
      calculateGymCalories({ weightKg: 80, durationMinutes: 30, intensity: 'easy' }),
      100,
    );
    // hard MET 6 → net 5; 70 kg × 45/60 h = 262.5 → 263
    assert.equal(
      calculateGymCalories({ weightKg: 70, durationMinutes: 45, intensity: 'hard' }),
      263,
    );
  });

  it('returns 0 for non-positive inputs', () => {
    assert.equal(
      calculateGymCalories({ weightKg: 0, durationMinutes: 60, intensity: 'normal' }),
      0,
    );
    assert.equal(
      calculateGymCalories({ weightKg: 80, durationMinutes: 0, intensity: 'normal' }),
      0,
    );
  });
});
