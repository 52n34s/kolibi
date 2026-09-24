import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  INTENSITY_PACE_MIN_DONE_SETS,
  suggestGymIntensityFromSetPace,
} from './intensity-pace.ts';

describe('suggestGymIntensityFromSetPace', () => {
  it('returns null with fewer than the minimum done sets', () => {
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 30, doneSetCount: 0 }),
      null,
    );
    assert.equal(
      suggestGymIntensityFromSetPace({
        durationMinutes: 30,
        doneSetCount: INTENSITY_PACE_MIN_DONE_SETS - 1,
      }),
      null,
    );
  });

  it('maps below 60 s/set to hard', () => {
    // 30 min / 31 sets ≈ 58.1 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 30, doneSetCount: 31 }),
      'hard',
    );
    // 3 min / 4 sets = 45 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 3, doneSetCount: 4 }),
      'hard',
    );
  });

  it('maps 60 s/set inclusive to normal', () => {
    // 30 min / 30 sets = 60 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 30, doneSetCount: 30 }),
      'normal',
    );
    // 3 min / 3 sets = 60 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 3, doneSetCount: 3 }),
      'normal',
    );
  });

  it('maps 120 s/set inclusive to normal', () => {
    // 30 min / 15 sets = 120 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 30, doneSetCount: 15 }),
      'normal',
    );
    // 6 min / 3 sets = 120 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 6, doneSetCount: 3 }),
      'normal',
    );
  });

  it('maps above 120 s/set to easy', () => {
    // 30 min / 14 sets ≈ 128.6 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 30, doneSetCount: 14 }),
      'easy',
    );
    // 7 min / 3 sets = 140 s
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 7, doneSetCount: 3 }),
      'easy',
    );
  });

  it('returns null for non-positive duration', () => {
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: 0, doneSetCount: 10 }),
      null,
    );
    assert.equal(
      suggestGymIntensityFromSetPace({ durationMinutes: Number.NaN, doneSetCount: 10 }),
      null,
    );
  });
});
