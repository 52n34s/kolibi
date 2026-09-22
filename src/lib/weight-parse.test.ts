import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseWeightInputToKg,
  resolveTargetWeightUpdateRow,
} from './weight-parse.ts';

describe('parseWeightInputToKg', () => {
  it('parses metric kilograms', () => {
    assert.equal(parseWeightInputToKg({ value: '82', unitSystem: 'metric' }), 82);
    assert.equal(parseWeightInputToKg({ value: '82,5', unitSystem: 'metric' }), 82.5);
  });

  it('converts imperial pounds to kg (onboarding path)', () => {
    // 180 lb → ~81.6 kg (rounded to 1 decimal in lbsToKg)
    assert.equal(parseWeightInputToKg({ value: '180', unitSystem: 'imperial' }), 81.6);
    assert.equal(parseWeightInputToKg({ value: '170,0', unitSystem: 'imperial' }), 77.1);
  });

  it('returns null for empty or non-positive input', () => {
    assert.equal(parseWeightInputToKg({ value: '', unitSystem: 'metric' }), null);
    assert.equal(parseWeightInputToKg({ value: '0', unitSystem: 'metric' }), null);
    assert.equal(parseWeightInputToKg({ value: '-5', unitSystem: 'imperial' }), null);
    assert.equal(parseWeightInputToKg({ value: 'abc', unitSystem: 'metric' }), null);
  });
});

describe('resolveTargetWeightUpdateRow', () => {
  it('returns the saved kg when a row comes back', () => {
    assert.equal(
      resolveTargetWeightUpdateRow({
        data: { target_weight_kg: 82 },
        error: null,
      }),
      82,
    );
    assert.equal(
      resolveTargetWeightUpdateRow({
        data: { target_weight_kg: '77.5' },
        error: null,
      }),
      77.5,
    );
  });

  it('throws target_weight_update_empty when no row is returned', () => {
    assert.throws(
      () => resolveTargetWeightUpdateRow({ data: null, error: null }),
      (err: unknown) =>
        err instanceof Error && err.message === 'target_weight_update_empty',
    );
    assert.throws(
      () =>
        resolveTargetWeightUpdateRow({
          data: { target_weight_kg: null },
          error: null,
        }),
      (err: unknown) =>
        err instanceof Error && err.message === 'target_weight_update_empty',
    );
  });

  it('rethrows supabase errors as-is', () => {
    const supabaseError = { code: '42501', message: 'permission denied' };
    assert.throws(
      () => resolveTargetWeightUpdateRow({ data: null, error: supabaseError }),
      (err: unknown) => err === supabaseError,
    );
  });
});
