import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countWeeksOnTrainingTarget,
  resolveHistoryTrainingEmptyKind,
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

  it('counts the full first overlapping week, not only days inside the 30-day window', () => {
    assert.deepEqual(
      weeklyDistinctTrainingDayCounts({
        loggedOnKeys: ['2026-08-20', '2026-09-16'],
        startKey: '2026-08-22',
        endKey: '2026-09-20',
      }),
      [
        { weekStart: '2026-08-17', count: 1 },
        { weekStart: '2026-08-24', count: 0 },
        { weekStart: '2026-08-31', count: 0 },
        { weekStart: '2026-09-07', count: 0 },
        { weekStart: '2026-09-14', count: 1 },
      ],
    );
  });
});

describe('countWeeksOnTrainingTarget', () => {
  it('counts weeks that meet training_sessions_per_week', () => {
    assert.deepEqual(
      countWeeksOnTrainingTarget({
        weeklyCounts: [{ count: 3 }, { count: 4 }, { count: 2 }, { count: 3 }],
        sessionsPerWeek: 3,
      }),
      { onTarget: 3, weekCount: 4 },
    );
  });

  it('returns zero on-target weeks when the goal is missing', () => {
    assert.deepEqual(
      countWeeksOnTrainingTarget({
        weeklyCounts: [{ count: 4 }, { count: 4 }],
        sessionsPerWeek: 0,
      }),
      { onTarget: 0, weekCount: 2 },
    );
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
