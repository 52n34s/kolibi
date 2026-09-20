import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dailyKmSeries,
  resolveHistoryTrainingEmptyKind,
  sumKm,
  weeklyDistinctTrainingDayCounts,
} from './history-training.ts';

describe('weeklyDistinctTrainingDayCounts', () => {
  it('keeps empty overlapping weeks so 30 days is not one bar', () => {
    assert.deepEqual(
      weeklyDistinctTrainingDayCounts({
        loggedOnKeys: ['2026-09-16', '2026-09-16', '2026-09-18'],
        startKey: '2026-08-22',
        endKey: '2026-09-20',
      }),
      [
        { weekStart: '2026-08-17', count: 0 },
        { weekStart: '2026-08-24', count: 0 },
        { weekStart: '2026-08-31', count: 0 },
        { weekStart: '2026-09-07', count: 0 },
        { weekStart: '2026-09-14', count: 2 },
      ],
    );
  });
});

describe('dailyKmSeries', () => {
  it('fills rest days with 0 and sums two runs on one day', () => {
    assert.deepEqual(
      dailyKmSeries({
        samples: [
          { date: '2026-09-18', km: 5.2 },
          { date: '2026-09-18', km: 1.1 },
          { date: '2026-09-20', km: 8 },
        ],
        startKey: '2026-09-18',
        endKey: '2026-09-20',
      }),
      [6.3, 0, 8],
    );
  });
});

describe('sumKm', () => {
  it('rounds to one decimal', () => {
    assert.equal(sumKm([1.14, 2.14]), 3.3);
  });
});

describe('resolveHistoryTrainingEmptyKind', () => {
  it('does not empty-state when sessions or km exist', () => {
    assert.equal(
      resolveHistoryTrainingEmptyKind({
        healthConnected: false,
        hasMovementGoal: false,
        hasSessionInRange: true,
        hasRunningKm: false,
      }),
      null,
    );
  });

  it('shows connect-health before a missing goal', () => {
    assert.equal(
      resolveHistoryTrainingEmptyKind({
        healthConnected: false,
        hasMovementGoal: false,
        hasSessionInRange: false,
        hasRunningKm: false,
      }),
      'connect_health',
    );
  });

  it('asks for a movement goal only when Health is connected', () => {
    assert.equal(
      resolveHistoryTrainingEmptyKind({
        healthConnected: true,
        hasMovementGoal: false,
        hasSessionInRange: false,
        hasRunningKm: false,
      }),
      'set_movement_goal',
    );
  });

  it('keeps charts when Health is connected and a goal is set', () => {
    assert.equal(
      resolveHistoryTrainingEmptyKind({
        healthConnected: true,
        hasMovementGoal: true,
        hasSessionInRange: false,
        hasRunningKm: false,
      }),
      null,
    );
  });
});
