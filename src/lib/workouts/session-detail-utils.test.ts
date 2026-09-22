import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dayDifference,
  finishedAtFromDuration,
  shiftTimestampToDate,
} from './session-detail-utils.ts';

describe('dayDifference', () => {
  it('counts whole days in both directions', () => {
    assert.equal(dayDifference('2026-09-17', '2026-09-18'), 1);
    assert.equal(dayDifference('2026-09-18', '2026-09-17'), -1);
    assert.equal(dayDifference('2026-09-17', '2026-09-17'), 0);
    assert.equal(dayDifference('2026-09-01', '2026-10-01'), 30);
  });

  it('crosses a year boundary', () => {
    assert.equal(dayDifference('2026-12-31', '2027-01-01'), 1);
  });

  it('counts the leap day', () => {
    assert.equal(dayDifference('2028-02-28', '2028-03-01'), 2);
    assert.equal(dayDifference('2026-02-28', '2026-03-01'), 1);
  });

  it('reports no shift for an unparseable key', () => {
    assert.equal(dayDifference('', '2026-09-18'), 0);
    assert.equal(dayDifference('2026-09-17', 'gestern'), 0);
  });
});

describe('shiftTimestampToDate', () => {
  it('keeps the time of day', () => {
    assert.equal(
      shiftTimestampToDate('2026-09-17T12:30:41.815Z', '2026-09-17', '2026-09-18'),
      '2026-09-18T12:30:41.815Z',
    );
  });

  it('moves backwards too', () => {
    assert.equal(
      shiftTimestampToDate('2026-09-18T06:00:00.000Z', '2026-09-18', '2026-09-15'),
      '2026-09-15T06:00:00.000Z',
    );
  });

  it('returns the timestamp untouched when the date does not change', () => {
    const stamp = '2026-09-17T12:30:41.815Z';
    assert.equal(shiftTimestampToDate(stamp, '2026-09-17', '2026-09-17'), stamp);
  });

  it('leaves an unparseable timestamp alone', () => {
    assert.equal(shiftTimestampToDate('irgendwann', '2026-09-17', '2026-09-18'), 'irgendwann');
  });

  it('is unaffected by a daylight-saving change in between', () => {
    // 25.10.2026 is the European DST switch; the shift is pure UTC arithmetic,
    // so a 09:00Z start stays 09:00Z.
    assert.equal(
      shiftTimestampToDate('2026-10-24T09:00:00.000Z', '2026-10-24', '2026-10-26'),
      '2026-10-26T09:00:00.000Z',
    );
  });

  it('keeps the duration intact when the date moves', () => {
    const startedAt = '2026-09-17T12:30:41.815Z';
    const finishedAt = finishedAtFromDuration(startedAt, 8);
    const movedStart = shiftTimestampToDate(startedAt, '2026-09-17', '2026-09-18');
    const movedFinish = finishedAtFromDuration(movedStart, 8);

    assert.equal(movedStart.slice(0, 10), '2026-09-18');
    assert.equal(movedFinish.slice(0, 10), '2026-09-18');
    assert.equal(
      Date.parse(movedFinish) - Date.parse(movedStart),
      Date.parse(finishedAt) - Date.parse(startedAt),
    );
  });
});
