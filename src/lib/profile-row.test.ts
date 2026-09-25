import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseOptionalProfileColumns } from './profile-row.ts';

describe('parseOptionalProfileColumns', () => {
  it('before the migrations every optional column is null', () => {
    const parsed = parseOptionalProfileColumns({});
    assert.equal(parsed.deload_until, null);
    assert.equal(parsed.deload_suggested_at, null);
    assert.equal(parsed.focus_areas, null);
    assert.equal(parsed.diet_preference, null);
  });

  it('deload columns are read as the database hands them back', () => {
    const parsed = parseOptionalProfileColumns({
      deload_until: '2026-10-01',
      deload_suggested_at: '2026-09-25T18:30:00.123+00:00',
    });
    assert.equal(parsed.deload_until, '2026-10-01');
    assert.equal(parsed.deload_suggested_at, '2026-09-25T18:30:00.123+00:00');
  });

  it('a deload_until that is not a date key is dropped instead of misread', () => {
    assert.equal(parseOptionalProfileColumns({ deload_until: '2026-10-01T00:00:00Z' }).deload_until, null);
    assert.equal(parseOptionalProfileColumns({ deload_until: 20261001 }).deload_until, null);
    assert.equal(parseOptionalProfileColumns({ deload_until: '' }).deload_until, null);
    assert.equal(parseOptionalProfileColumns({ deload_suggested_at: 5 }).deload_suggested_at, null);
  });

  it('diet preference stays a string or null (the former tsc error)', () => {
    assert.equal(parseOptionalProfileColumns({ diet_preference: 'vegetarian' }).diet_preference, 'vegetarian');
    assert.equal(parseOptionalProfileColumns({ diet_preference: 7 }).diet_preference, null);
  });

  it('numbers arriving as strings are parsed, out-of-range sessions dropped', () => {
    const parsed = parseOptionalProfileColumns({
      target_weight_kg: '78.5',
      movement_goal_value: '8000',
      training_sessions_per_week: '3',
      movement_goal_type: 'steps',
      movement_goal_period: 'month',
    });
    assert.equal(parsed.target_weight_kg, 78.5);
    assert.equal(parsed.movement_goal_value, 8000);
    assert.equal(parsed.training_sessions_per_week, 3);
    assert.equal(parsed.movement_goal_type, 'steps');
    assert.equal(parsed.movement_goal_period, null);
    assert.equal(parseOptionalProfileColumns({ training_sessions_per_week: 20 }).training_sessions_per_week, null);
  });
});
