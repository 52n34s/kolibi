import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildWeekDayMarkers,
  countDistinctTrainingDaysMerged,
  trainingCardDayKeys,
  trainingCardSessionCount,
} from './week-day-markers.ts';

describe('buildWeekDayMarkers', () => {
  it('prefers workout shortLabel over manual filled dots', () => {
    // Week of Mon 2026-09-21
    const now = new Date(2026, 8, 22); // Tue
    const markers = buildWeekDayMarkers(
      [{ loggedOn: '2026-09-21' }, { loggedOn: '2026-09-22' }],
      [
        {
          loggedOn: '2026-09-22',
          shortLabel: 'A',
          colorKey: 'teal',
          startedAt: '2026-09-22T10:00:00.000Z',
        },
      ],
      now,
    );
    assert.equal(markers.length, 7);
    assert.deepEqual(markers[0], { filled: true }); // Mon manual
    assert.deepEqual(markers[1], {
      filled: true,
      shortLabel: 'A',
      colorKey: 'teal',
    });
    assert.equal(markers[2]?.filled, false);
  });
});

describe('countDistinctTrainingDaysMerged', () => {
  it('unions calendar days from both sources', () => {
    assert.equal(
      countDistinctTrainingDaysMerged(
        [{ loggedOn: '2026-09-21' }, { loggedOn: '2026-09-22' }],
        [{ loggedOn: '2026-09-22' }, { loggedOn: '2026-09-23' }],
      ),
      3,
    );
  });
});

describe('trainingCardSessionCount', () => {
  const manual = [{ loggedOn: '2026-09-22' }, { loggedOn: '2026-09-14' }];
  const workouts = [{ loggedOn: '2026-09-22' }, { loggedOn: '2026-09-24' }, { loggedOn: '2026-09-19' }];

  it('counts distinct days of the current Mon–Sun week for 7 days', () => {
    assert.equal(
      trainingCardSessionCount({
        rangeDays: 7,
        rangeStartKey: '2026-09-18',
        todayKey: '2026-09-24',
        manualSessions: manual,
        workoutSessions: workouts,
      }),
      2,
    );
  });

  it('covers every displayed week row for 30 days', () => {
    assert.equal(trainingCardDayKeys({ rangeDays: 30, rangeStartKey: '2026-08-26', todayKey: '2026-09-24' })[0], '2026-09-21');
    assert.equal(
      trainingCardSessionCount({
        rangeDays: 30,
        rangeStartKey: '2026-08-26',
        todayKey: '2026-09-24',
        manualSessions: manual,
        workoutSessions: workouts,
      }),
      4,
    );
  });
});
