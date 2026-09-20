import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeWeightWaistComparison,
  rangeWindowKeys,
  shouldShowWaistRangeBadge,
  waistChartRangeDays,
  WEIGHT_WAIST_COMPARISON_WINDOW_DAYS,
} from './history-body-metrics.ts';

function isoOn(dayKey: string): string {
  return `${dayKey}T12:00:00.000Z`;
}

describe('waistChartRangeDays', () => {
  it('never charts waist on 7 days', () => {
    assert.equal(waistChartRangeDays(7), 30);
    assert.equal(waistChartRangeDays(30), 30);
    assert.equal(shouldShowWaistRangeBadge(7), true);
    assert.equal(shouldShowWaistRangeBadge(30), false);
  });
});

describe('rangeWindowKeys', () => {
  it('includes today and counts backwards inclusive', () => {
    assert.deepEqual(
      rangeWindowKeys({ rangeDays: 7, todayKey: '2026-09-20' }),
      { startKey: '2026-09-14', endKey: '2026-09-20' },
    );
    assert.deepEqual(
      rangeWindowKeys({
        rangeDays: WEIGHT_WAIST_COMPARISON_WINDOW_DAYS,
        todayKey: '2026-09-20',
      }),
      { startKey: '2026-08-24', endKey: '2026-09-20' },
    );
  });
});

describe('computeWeightWaistComparison', () => {
  const todayKey = '2026-09-20';

  it('returns null without two points in each series', () => {
    assert.equal(
      computeWeightWaistComparison({
        todayKey,
        weightLogs: [
          { weight_kg: 80, logged_at: isoOn('2026-08-25') },
          { weight_kg: 80.1, logged_at: isoOn('2026-09-20') },
        ],
        waistLogs: [{ waist_cm: 92, logged_at: isoOn('2026-09-13') }],
      }),
      null,
    );
  });

  it('returns null when the span is under three weeks', () => {
    assert.equal(
      computeWeightWaistComparison({
        todayKey,
        weightLogs: [
          { weight_kg: 80, logged_at: isoOn('2026-09-10') },
          { weight_kg: 80, logged_at: isoOn('2026-09-20') },
        ],
        waistLogs: [
          { waist_cm: 92, logged_at: isoOn('2026-09-10') },
          { waist_cm: 90, logged_at: isoOn('2026-09-20') },
        ],
      }),
      null,
    );
  });

  it('returns null when both series are flat', () => {
    assert.equal(
      computeWeightWaistComparison({
        todayKey,
        weightLogs: [
          { weight_kg: 80, logged_at: isoOn('2026-08-25') },
          { weight_kg: 80.1, logged_at: isoOn('2026-09-20') },
        ],
        waistLogs: [
          { waist_cm: 92, logged_at: isoOn('2026-08-25') },
          { waist_cm: 92.2, logged_at: isoOn('2026-09-20') },
        ],
      }),
      null,
    );
  });

  it('flags stable weight with a waist drop over four weeks', () => {
    const result = computeWeightWaistComparison({
      todayKey,
      weightLogs: [
        { weight_kg: 80.0, logged_at: isoOn('2026-08-25') },
        { weight_kg: 80.1, logged_at: isoOn('2026-09-06') },
        { weight_kg: 79.9, logged_at: isoOn('2026-09-20') },
      ],
      waistLogs: [
        { waist_cm: 92, logged_at: isoOn('2026-08-25') },
        { waist_cm: 90.5, logged_at: isoOn('2026-09-08') },
        { waist_cm: 89.5, logged_at: isoOn('2026-09-20') },
      ],
    });
    assert.deepEqual(result, {
      spanWeeks: 4,
      weightUnchanged: true,
      weightDeltaKg: -0.1,
      waistDeltaCm: -2.5,
    });
  });

  it('keeps a signed weight delta when both series moved', () => {
    const result = computeWeightWaistComparison({
      todayKey,
      weightLogs: [
        { weight_kg: 82, logged_at: isoOn('2026-08-25') },
        { weight_kg: 80, logged_at: isoOn('2026-09-20') },
      ],
      waistLogs: [
        { waist_cm: 94, logged_at: isoOn('2026-08-25') },
        { waist_cm: 91, logged_at: isoOn('2026-09-20') },
      ],
    });
    assert.equal(result?.weightUnchanged, false);
    assert.equal(result?.weightDeltaKg, -2);
    assert.equal(result?.waistDeltaCm, -3);
    assert.equal(result?.spanWeeks, 4);
  });
});
