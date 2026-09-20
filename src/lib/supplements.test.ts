import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSupplementHistoryRows,
  isSupplementDue,
  nextIntervalIntakeDate,
  type SupplementDueInput,
  type SupplementHistorySource,
} from './supplement-due.ts';

function schedule(overrides: Partial<SupplementDueInput> = {}): SupplementDueInput {
  return {
    is_active: true,
    start_date: '2026-09-13',
    schedule_kind: 'daily',
    interval_days: null,
    weekdays: null,
    cycle_on_days: null,
    cycle_off_days: null,
    cycle_anchor_date: null,
    ...overrides,
  };
}

function supplement(overrides: Partial<SupplementHistorySource> = {}): SupplementHistorySource {
  return {
    id: 'creatine',
    name: 'Creatin',
    schedule_kind: 'daily',
    interval_days: null,
    weekdays: null,
    start_date: '2026-09-13',
    cycle_on_days: null,
    cycle_off_days: null,
    cycle_anchor_date: null,
    is_active: true,
    sort_order: 0,
    ...overrides,
  };
}

describe('isSupplementDue', () => {
  it('marks Vitamin D every 7 days from 13.09 — due 13 and 20, not the days in between', () => {
    const vitaminD = schedule({ schedule_kind: 'interval', interval_days: 7 });
    assert.equal(isSupplementDue(vitaminD, '2026-09-13'), true);
    assert.equal(isSupplementDue(vitaminD, '2026-09-14'), false);
    assert.equal(isSupplementDue(vitaminD, '2026-09-19'), false);
    assert.equal(isSupplementDue(vitaminD, '2026-09-20'), true);
    assert.equal(isSupplementDue(vitaminD, '2026-09-27'), true);
  });

  it('marks Creatine daily on every day from start, none before', () => {
    const creatine = schedule({ schedule_kind: 'daily' });
    assert.equal(isSupplementDue(creatine, '2026-09-12'), false);
    assert.equal(isSupplementDue(creatine, '2026-09-13'), true);
    assert.equal(isSupplementDue(creatine, '2026-09-14'), true);
    assert.equal(isSupplementDue(creatine, '2026-09-20'), true);
  });

  it('marks B12 every 2 days from start, not the off days', () => {
    const b12 = schedule({ schedule_kind: 'interval', interval_days: 2 });
    assert.equal(isSupplementDue(b12, '2026-09-13'), true);
    assert.equal(isSupplementDue(b12, '2026-09-14'), false);
    assert.equal(isSupplementDue(b12, '2026-09-15'), true);
    assert.equal(isSupplementDue(b12, '2026-09-16'), false);
    assert.equal(isSupplementDue(b12, '2026-09-19'), true);
    assert.equal(isSupplementDue(b12, '2026-09-20'), false);
  });

  it('uses ISO weekdays (Monday = 1)', () => {
    // 2026-09-14 = Monday, 2026-09-16 = Wednesday, 2026-09-20 = Sunday
    const weekdays = schedule({
      start_date: '2026-09-14',
      schedule_kind: 'weekdays',
      weekdays: [1, 3, 5],
    });
    assert.equal(isSupplementDue(weekdays, '2026-09-14'), true);
    assert.equal(isSupplementDue(weekdays, '2026-09-15'), false);
    assert.equal(isSupplementDue(weekdays, '2026-09-16'), true);
    assert.equal(isSupplementDue(weekdays, '2026-09-20'), false);
  });

  it('treats Kur-mit-Pause off-block days as not due', () => {
    const cycling = schedule({
      schedule_kind: 'daily',
      cycle_on_days: 84,
      cycle_off_days: 28,
      cycle_anchor_date: '2026-09-13',
    });
    assert.equal(isSupplementDue(cycling, '2026-09-13'), true);
    assert.equal(isSupplementDue(cycling, '2026-12-05'), true);
    assert.equal(isSupplementDue(cycling, '2026-12-06'), false);
    assert.equal(isSupplementDue(cycling, '2027-01-02'), false);
    assert.equal(isSupplementDue(cycling, '2027-01-03'), true);
  });

  it('counts a calendar-day interval across a DST spring-forward', () => {
    const everyTwo = schedule({
      start_date: '2026-03-28',
      schedule_kind: 'interval',
      interval_days: 2,
    });
    assert.equal(isSupplementDue(everyTwo, '2026-03-28'), true);
    assert.equal(isSupplementDue(everyTwo, '2026-03-29'), false);
    assert.equal(isSupplementDue(everyTwo, '2026-03-30'), true);
  });
});

describe('nextIntervalIntakeDate', () => {
  it('returns today when today is a start-aligned due day', () => {
    assert.equal(
      nextIntervalIntakeDate({
        startDate: '2026-09-13',
        intervalDays: 7,
        fromDate: '2026-09-20',
      }),
      '2026-09-20',
    );
  });

  it('skips ahead to the next start-aligned due day', () => {
    assert.equal(
      nextIntervalIntakeDate({
        startDate: '2026-09-13',
        intervalDays: 7,
        fromDate: '2026-09-16',
      }),
      '2026-09-20',
    );
  });

  it('returns startDate when fromDate is before the schedule starts', () => {
    assert.equal(
      nextIntervalIntakeDate({
        startDate: '2026-09-13',
        intervalDays: 7,
        fromDate: '2026-09-10',
      }),
      '2026-09-13',
    );
  });
});

describe('buildSupplementHistoryRows', () => {
  it('uses three states and counts only due days', () => {
    const vitaminD = supplement({
      id: 'vitd',
      name: 'Vitamin D',
      schedule_kind: 'interval',
      interval_days: 7,
    });
    const rows = buildSupplementHistoryRows(
      [vitaminD],
      '2026-09-14',
      '2026-09-20',
      new Set(['vitd:2026-09-20']),
    );
    const days = rows[0]?.days ?? [];
    assert.deepEqual(
      days.map((day) => [day.day, day.is_due, day.taken]),
      [
        ['2026-09-14', false, false],
        ['2026-09-15', false, false],
        ['2026-09-16', false, false],
        ['2026-09-17', false, false],
        ['2026-09-18', false, false],
        ['2026-09-19', false, false],
        ['2026-09-20', true, true],
      ],
    );
    const dueDays = days.filter((day) => day.is_due);
    assert.equal(dueDays.length, 1);
    assert.equal(dueDays.filter((day) => day.taken).length, 1);
  });

  it('shows an empty due circle for missed interval days and nothing on off days', () => {
    const b12 = supplement({
      id: 'b12',
      name: 'B12',
      schedule_kind: 'interval',
      interval_days: 2,
    });
    const rows = buildSupplementHistoryRows([b12], '2026-09-13', '2026-09-16', new Set(['b12:2026-09-13']));
    assert.deepEqual(
      (rows[0]?.days ?? []).map((day) => ({
        day: day.day,
        is_due: day.is_due,
        taken: day.taken,
      })),
      [
        { day: '2026-09-13', is_due: true, taken: true },
        { day: '2026-09-14', is_due: false, taken: false },
        { day: '2026-09-15', is_due: true, taken: false },
        { day: '2026-09-16', is_due: false, taken: false },
      ],
    );
  });
});
