import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkinCardMode,
  formatReminderTime,
  parseReminderTime,
  reminderTimeLabel,
  resolveTodayCheckinStatus,
} from './checkin-status.ts';

const TODAY = '2026-09-25';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 25, hour, minute);
}

describe('resolveTodayCheckinStatus', () => {
  const base = {
    available: true,
    enabled: true,
    answeredToday: false,
    skippedOn: null,
    todayKey: TODAY,
  };

  it('is open by default', () => {
    assert.equal(resolveTodayCheckinStatus(base), 'open');
  });

  it('is answered once saved, even when switched off later', () => {
    assert.equal(resolveTodayCheckinStatus({ ...base, answeredToday: true }), 'answered');
    assert.equal(
      resolveTodayCheckinStatus({ ...base, answeredToday: true, enabled: false }),
      'answered',
    );
  });

  it('is skipped only for the day of "Heute nicht"', () => {
    assert.equal(resolveTodayCheckinStatus({ ...base, skippedOn: TODAY }), 'skipped');
    assert.equal(resolveTodayCheckinStatus({ ...base, skippedOn: '2026-09-24' }), 'open');
  });

  it('is disabled when switched off or before the migration', () => {
    assert.equal(resolveTodayCheckinStatus({ ...base, enabled: false }), 'disabled');
    assert.equal(resolveTodayCheckinStatus({ ...base, available: false }), 'disabled');
    assert.equal(
      resolveTodayCheckinStatus({ ...base, available: false, answeredToday: true }),
      'disabled',
    );
  });
});

describe('checkinCardMode', () => {
  it('asks in the morning until 12:00', () => {
    assert.equal(checkinCardMode('open', at(6, 30)), 'questions');
    assert.equal(checkinCardMode('open', at(11, 59)), 'questions');
    assert.equal(checkinCardMode('open', at(12, 0)), 'hidden');
  });

  it('shows the result line all day after answering', () => {
    assert.equal(checkinCardMode('answered', at(8)), 'result');
    assert.equal(checkinCardMode('answered', at(20)), 'result');
  });

  it('stays hidden when skipped or disabled', () => {
    assert.equal(checkinCardMode('skipped', at(8)), 'hidden');
    assert.equal(checkinCardMode('disabled', at(8)), 'hidden');
  });
});

describe('reminder time', () => {
  it('parses Postgres time values', () => {
    assert.deepEqual(parseReminderTime('07:30:00'), { hour: 7, minute: 30 });
    assert.deepEqual(parseReminderTime('6:05'), { hour: 6, minute: 5 });
    assert.equal(parseReminderTime('25:00'), null);
    assert.equal(parseReminderTime(null), null);
    assert.equal(parseReminderTime('abc'), null);
  });

  it('formats for the column and for display', () => {
    assert.equal(formatReminderTime(7, 5), '07:05:00');
    assert.equal(reminderTimeLabel('07:05:00'), '07:05');
    assert.equal(reminderTimeLabel(null), '');
  });
});
