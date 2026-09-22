import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildWeekDayMarkers,
  countDistinctTrainingDaysMerged,
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
