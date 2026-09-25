import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reconcileTrainingRows } from './training-rows';

const DAY = '2026-09-25';
/** Without is_manual: a row from before the migration. */
const row = (id: string, activity = 'strength', loggedOn = DAY) => ({ id, loggedOn, activity });
const manualRow = (id: string, activity = 'strength', loggedOn = DAY) => ({
  id,
  loggedOn,
  activity,
  isManual: true,
});
const unitRow = (id: string, activity = 'strength', loggedOn = DAY) => ({
  id,
  loggedOn,
  activity,
  isManual: false,
});
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

  it('an is_manual row counts on a day with a finished unit, too', () => {
    const result = reconcileTrainingRows([manualRow('log'), unitRow('ts-1')], [unit('ts-1')]);
    assert.deepEqual(ids(result.kept), ['log', 'ts-1']);
    assert.deepEqual(ids(result.manual), ['log']);
    assert.deepEqual(result.duplicates, []);
  });

  it('a phantom on a day without a unit is not a manual entry', () => {
    const result = reconcileTrainingRows([unitRow('phantom')], []);
    assert.deepEqual(result.kept, []);
    assert.deepEqual(result.manual, []);
    assert.deepEqual(ids(result.duplicates), ['phantom']);
  });

  it('the unlinked unit still adopts its own row before a second one drops out', () => {
    const result = reconcileTrainingRows([unitRow('ts-1'), unitRow('ts-2')], [unit(null)]);
    assert.deepEqual(ids(result.kept), ['ts-1']);
    assert.deepEqual(result.manual, []);
    assert.deepEqual(ids(result.duplicates), ['ts-2']);
  });
});
