import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateTrainingCalories,
  TRAINING_MET,
  mapTrainingIntensityToSportIntensity,
} from './training-calories.ts';
import { SportIntensity } from './sport-macro-scaling.ts';

describe('TRAINING_MET', () => {
  it('matches the approved activity × intensity table', () => {
    assert.deepEqual(TRAINING_MET.strength, { easy: 3.5, normal: 5.0, hard: 6.0 });
    assert.deepEqual(TRAINING_MET.yoga, { easy: 2.5, normal: 3.0, hard: 4.0 });
    assert.deepEqual(TRAINING_MET.swimming, { easy: 5.0, normal: 7.0, hard: 9.5 });
    assert.deepEqual(TRAINING_MET.cycling, { easy: 4.0, normal: 6.8, hard: 10.0 });
    assert.deepEqual(TRAINING_MET.other, { easy: 3.5, normal: 5.0, hard: 6.0 });
  });
});

describe('mapTrainingIntensityToSportIntensity', () => {
  it('maps talk-test bands onto workout intensity bands', () => {
    assert.equal(mapTrainingIntensityToSportIntensity('easy'), SportIntensity.LOW);
    assert.equal(mapTrainingIntensityToSportIntensity('normal'), SportIntensity.MODERATE);
    assert.equal(mapTrainingIntensityToSportIntensity('hard'), SportIntensity.HIGH);
  });
});

describe('calculateTrainingCalories', () => {
  it('uses (MET − 1) × kg × hours and rounds', () => {
    // strength normal MET 5 → net 4; 80 kg × 1 h = 320
    assert.equal(
      calculateTrainingCalories({
        activity: 'strength',
        weightKg: 80,
        durationMinutes: 60,
        intensity: 'normal',
      }),
      320,
    );
    // yoga easy MET 2.5 → net 1.5; 80 kg × 0.5 h = 60
    assert.equal(
      calculateTrainingCalories({
        activity: 'yoga',
        weightKg: 80,
        durationMinutes: 30,
        intensity: 'easy',
      }),
      60,
    );
    // swimming hard MET 9.5 → net 8.5; 70 kg × 45/60 h = 446.25 → 446
    assert.equal(
      calculateTrainingCalories({
        activity: 'swimming',
        weightKg: 70,
        durationMinutes: 45,
        intensity: 'hard',
      }),
      446,
    );
  });

  it('returns 0 for non-positive inputs', () => {
    assert.equal(
      calculateTrainingCalories({
        activity: 'cycling',
        weightKg: 0,
        durationMinutes: 60,
        intensity: 'normal',
      }),
      0,
    );
    assert.equal(
      calculateTrainingCalories({
        activity: 'other',
        weightKg: 80,
        durationMinutes: 0,
        intensity: 'normal',
      }),
      0,
    );
  });
});
