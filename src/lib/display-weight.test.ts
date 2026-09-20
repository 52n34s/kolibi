import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveDisplayWeight, type DisplayWeightLog } from './display-weight.ts';

function logOn(dayKey: string, kg: number): DisplayWeightLog {
  const [year, month, day] = dayKey.split('-').map(Number);
  const at = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
  return { weight_kg: kg, logged_at: at.toISOString() };
}

describe('resolveDisplayWeight', () => {
  it('returns nulls with 0 logs', () => {
    const result = resolveDisplayWeight({
      logs: [],
      startOn: '2026-09-01',
      today: '2026-09-20',
    });
    assert.deepEqual(result, {
      dailyKg: null,
      trendKg: null,
      trendUsesMa: false,
      startTrendKg: null,
      startRawKg: null,
      barStartKg: null,
      barEndKg: null,
      barUsesMa: false,
    });
  });

  it('keeps 2 logs on 2 days raw — no MA, bar both raw', () => {
    const result = resolveDisplayWeight({
      logs: [logOn('2026-09-19', 80), logOn('2026-09-20', 81)],
      startOn: '2026-09-19',
      today: '2026-09-20',
    });
    assert.equal(result.dailyKg, 81);
    assert.equal(result.trendKg, 81);
    assert.equal(result.startTrendKg, null);
    assert.equal(result.startRawKg, 80);
    assert.equal(result.barStartKg, 80);
    assert.equal(result.barEndKg, 81);
    assert.equal(result.barUsesMa, false);
  });

  it('gives the last of 3 weigh days in 7 days an MA, but the bar stays both raw', () => {
    const result = resolveDisplayWeight({
      logs: [
        logOn('2026-09-14', 80),
        logOn('2026-09-16', 80.4),
        logOn('2026-09-20', 81),
      ],
      startOn: '2026-09-14',
      today: '2026-09-20',
    });
    assert.equal(result.dailyKg, 81);
    assert.equal(result.trendKg, (80 + 80.4 + 81) / 3);
    assert.equal(result.startTrendKg, null);
    assert.equal(result.startRawKg, 80);
    assert.equal(result.barStartKg, 80);
    assert.equal(result.barEndKg, 81);
    assert.equal(result.barUsesMa, false);
  });

  it('keeps a weekly weigher over 4 weeks raw — one sample per 7-day window', () => {
    const result = resolveDisplayWeight({
      logs: [
        logOn('2026-08-30', 82),
        logOn('2026-09-06', 81.5),
        logOn('2026-09-13', 81),
        logOn('2026-09-20', 80.5),
      ],
      startOn: '2026-08-30',
      today: '2026-09-20',
    });
    assert.equal(result.dailyKg, 80.5);
    assert.equal(result.trendKg, 80.5);
    assert.equal(result.startTrendKg, null);
    assert.equal(result.barStartKg, 82);
    assert.equal(result.barEndKg, 80.5);
    assert.equal(result.barUsesMa, false);
  });

  it('does not give the first log an MA when there is no lookback', () => {
    const result = resolveDisplayWeight({
      logs: [
        logOn('2026-09-14', 80),
        logOn('2026-09-15', 80.1),
        logOn('2026-09-16', 80.2),
        logOn('2026-09-17', 80.3),
        logOn('2026-09-18', 80.4),
        logOn('2026-09-19', 80.5),
        logOn('2026-09-20', 80.6),
      ],
      startOn: '2026-09-14',
      today: '2026-09-20',
    });
    assert.equal(result.startTrendKg, null);
    assert.equal(result.startRawKg, 80);
    assert.equal(result.dailyKg, 80.6);
    assert.equal(
      result.trendKg,
      (80 + 80.1 + 80.2 + 80.3 + 80.4 + 80.5 + 80.6) / 7,
    );
    assert.equal(result.barUsesMa, false);
    assert.equal(result.barStartKg, 80);
    assert.equal(result.barEndKg, 80.6);
  });

  it('uses MA at both bar ends when lookback fills the start window', () => {
    const result = resolveDisplayWeight({
      logs: [
        logOn('2026-09-11', 80),
        logOn('2026-09-12', 80.1),
        logOn('2026-09-13', 80.2),
        logOn('2026-09-14', 80.3),
        logOn('2026-09-18', 80.7),
        logOn('2026-09-19', 80.8),
        logOn('2026-09-20', 80.9),
      ],
      startOn: '2026-09-14',
      today: '2026-09-20',
    });
    assert.ok(
      Math.abs((result.startTrendKg ?? 0) - (80 + 80.1 + 80.2 + 80.3) / 4) < 1e-9,
    );
    assert.ok(
      Math.abs((result.trendKg ?? 0) - (80.3 + 80.7 + 80.8 + 80.9) / 4) < 1e-9,
    );
    assert.equal(result.barUsesMa, true);
    assert.equal(result.trendUsesMa, true);
    assert.equal(result.barStartKg, result.startTrendKg);
    assert.equal(result.barEndKg, result.trendKg);
  });

  it('marks the raw fallback so nothing may call it a trend', () => {
    const result = resolveDisplayWeight({
      logs: [logOn('2026-09-19', 80), logOn('2026-09-20', 81)],
      startOn: '2026-09-19',
      today: '2026-09-20',
    });
    assert.equal(result.trendKg, result.dailyKg);
    assert.equal(result.trendUsesMa, false);
  });

  it('reports a trend once the end has an MA, even with a raw bar start', () => {
    const result = resolveDisplayWeight({
      logs: [
        logOn('2026-09-18', 80.7),
        logOn('2026-09-19', 80.8),
        logOn('2026-09-20', 80.9),
      ],
      startOn: '2026-09-18',
      today: '2026-09-20',
    });
    assert.equal(result.trendUsesMa, true);
    assert.equal(result.barUsesMa, false);
  });
});
