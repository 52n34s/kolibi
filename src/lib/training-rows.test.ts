import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reconcileTrainingRows } from './training-rows';

const DAY = '2026-09-25';
const row = (id: string, activity = 'strength', loggedOn = DAY) => ({ id, loggedOn, activity });
const unit = (trainingSessionId: string | null, finishedAt: string | null = `${DAY}T18:00:00Z`) => ({
  loggedOn: DAY,
  finishedAt,
  trainingSessionId,
});
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('reconcileTrainingRows', () => {
  it('double finish: the second strength row is a duplicate, not "Manuell"', () => {
    const result = reconcileTrainingRows([row('ts-1'), row('ts-2')], [unit('ts-2')]);
    assert.deepEqual(ids(result.kept), ['ts-2']);
    assert.deepEqual(ids(result.manual), []);
    assert.deepEqual(ids(result.duplicates), ['ts-1']);
  });

  it('a unit whose link got lost adopts its own row (counted once, not manual)', () => {
    const result = reconcileTrainingRows([row('ts-1')], [unit(null)]);
    assert.deepEqual(ids(result.kept), ['ts-1']);
    assert.deepEqual(ids(result.manual), []);
  });

  it('two units, one linked: one unlinked row is adopted, a third one is a duplicate', () => {
    const result = reconcileTrainingRows(
      [row('ts-1'), row('ts-2'), row('ts-3')],
      [unit('ts-1'), unit(null)],
    );
    assert.deepEqual(ids(result.kept), ['ts-1', 'ts-2']);
    assert.deepEqual(ids(result.duplicates), ['ts-3']);
  });

  it('manual entries stay: other activities, and strength on days without a finished unit', () => {
    const result = reconcileTrainingRows(
      [row('yoga', 'yoga'), row('other-day', 'strength', '2026-09-24'), row('ts-1')],
      [unit('ts-1'), { loggedOn: '2026-09-24', finishedAt: null, trainingSessionId: null }],
    );
    assert.deepEqual(ids(result.kept), ['yoga', 'other-day', 'ts-1']);
    assert.deepEqual(ids(result.manual), ['yoga', 'other-day']);
    assert.deepEqual(result.duplicates, []);
  });

  it('without units everything is manual', () => {
    const result = reconcileTrainingRows([row('a'), row('b', 'cycling')], []);
    assert.deepEqual(ids(result.manual), ['a', 'b']);
  });
});
