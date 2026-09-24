import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickNextTemplate } from './next-template.ts';
import type { WorkoutTemplate } from './types.ts';

function template(
  partial: Partial<WorkoutTemplate> & Pick<WorkoutTemplate, 'id' | 'name' | 'position'>,
): WorkoutTemplate {
  return {
    shortLabel: partial.shortLabel ?? partial.name.slice(0, 1),
    colorKey: partial.colorKey ?? 'indigo',
    weekdays: partial.weekdays ?? [],
    exercises: partial.exercises ?? [],
    archivedAt: null,
    ...partial,
  };
}

describe('pickNextTemplate', () => {
  const push = template({ id: 'push', name: 'Push', position: 0, weekdays: [1, 4], shortLabel: 'P' });
  const pull = template({ id: 'pull', name: 'Pull', position: 1, weekdays: [2, 5], shortLabel: 'Pu' });
  const legs = template({ id: 'legs', name: 'Legs', position: 2, weekdays: [3], shortLabel: 'L' });

  it('prefers a scheduled unit not yet done today', () => {
    // Tuesday = 2 → Pull
    const next = pickNextTemplate([push, pull, legs], [], '2026-09-22');
    assert.equal(next?.id, 'pull');
  });

  it('skips a scheduled unit already done today and falls back to rotation', () => {
    const next = pickNextTemplate(
      [push, pull, legs],
      [
        {
          templateId: 'pull',
          loggedOn: '2026-09-22',
          finishedAt: '2026-09-22T10:00:00.000Z',
          startedAt: '2026-09-22T09:00:00.000Z',
        },
      ],
      '2026-09-22',
    );
    // Pull done today; no other Tuesday schedule → after last (pull) → legs
    assert.equal(next?.id, 'legs');
  });

  it('rotates by position after the last finished session', () => {
    // Sunday = 7, no schedules
    const next = pickNextTemplate(
      [push, pull, legs],
      [
        {
          templateId: 'legs',
          loggedOn: '2026-09-20',
          finishedAt: '2026-09-20T10:00:00.000Z',
          startedAt: '2026-09-20T09:00:00.000Z',
        },
      ],
      '2026-09-21',
    );
    assert.equal(next?.id, 'push');
  });

  it('returns the first by position when nothing else applies', () => {
    const next = pickNextTemplate([legs, push, pull], [], '2026-09-21');
    assert.equal(next?.id, 'push');
  });

  it('returns null for an empty list', () => {
    assert.equal(pickNextTemplate([], [], '2026-09-22'), null);
  });
});
