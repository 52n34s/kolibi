import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  groupMeals,
  mealGroupLabel,
  mealSlotForStartTime,
  MEAL_GROUP_MAX_GAP_MINUTES,
  sumMealGroupTotals,
} from './meal-groups.ts';

describe('sumMealGroupTotals', () => {
  it('sums kcal and the known protein', () => {
    assert.deepEqual(
      sumMealGroupTotals([
        { kcal: 300, proteinG: 20 },
        { kcal: 50, proteinG: null },
        { kcal: 150, proteinG: 5.5 },
      ]),
      { kcal: 500, proteinG: 25.5 },
    );
  });

  it('keeps protein unknown when no entry has it', () => {
    assert.deepEqual(sumMealGroupTotals([{ kcal: 100, proteinG: null }]), {
      kcal: 100,
      proteinG: null,
    });
  });
});

type Entry = { id: string; at: string; kcal: number };

/** Local wall-clock time on a fixed local day (independent of process TZ). */
function at(hours: number, minutes: number, seconds = 0, day = 25): string {
  return new Date(2026, 8, day, hours, minutes, seconds).toISOString();
}

function entry(id: string, iso: string, kcal = 300): Entry {
  return { id, at: iso, kcal };
}

const accessors = {
  eatenAt: (e: Entry) => e.at,
  kcal: (e: Entry) => e.kcal,
};

function ids(groups: ReturnType<typeof groupMeals<Entry>>): string[][] {
  return groups.map((group) => group.entries.map((e) => e.id));
}

describe('groupMeals', () => {
  it('uses a 45-minute gap', () => {
    assert.equal(MEAL_GROUP_MAX_GAP_MINUTES, 45);
  });

  it('joins an entry exactly 45 minutes after the previous one', () => {
    const groups = groupMeals([entry('a', at(12, 0)), entry('b', at(12, 45))], accessors);
    assert.deepEqual(ids(groups), [['a', 'b']]);
  });

  it('starts a new meal at 46 minutes', () => {
    const groups = groupMeals([entry('a', at(12, 0)), entry('b', at(12, 46))], accessors);
    assert.deepEqual(ids(groups), [['a'], ['b']]);
  });

  it('starts a new meal one second after 45 minutes', () => {
    const groups = groupMeals([entry('a', at(12, 0)), entry('b', at(12, 45, 1))], accessors);
    assert.deepEqual(ids(groups), [['a'], ['b']]);
  });

  it('chains entries so a meal can span more than 45 minutes in total', () => {
    const groups = groupMeals(
      [
        entry('a', at(18, 0)),
        entry('b', at(18, 40)),
        entry('c', at(19, 20)),
        entry('d', at(20, 5)),
      ],
      accessors,
    );
    assert.deepEqual(ids(groups), [['a', 'b', 'c', 'd']]);
    assert.equal(groups[0]!.slot, 'dinner');
    assert.equal(groups[0]!.totalKcal, 1200);
    assert.equal(groups[0]!.startAt.toISOString(), at(18, 0));
    assert.equal(groups[0]!.endAt.toISOString(), at(20, 5));
  });

  it('measures the gap from the previous entry, not from the first', () => {
    const groups = groupMeals(
      [entry('a', at(12, 0)), entry('b', at(12, 30)), entry('c', at(13, 16))],
      accessors,
    );
    assert.deepEqual(ids(groups), [['a', 'b'], ['c']]);
  });

  it('never joins across the local day boundary', () => {
    const groups = groupMeals(
      [entry('a', at(23, 50, 0, 24)), entry('b', at(0, 10, 0, 25))],
      accessors,
    );
    assert.deepEqual(ids(groups), [['a'], ['b']]);
    assert.equal(groups[0]!.dateKey, '2026-09-24');
    assert.equal(groups[1]!.dateKey, '2026-09-25');
  });

  it('sorts unsorted input and returns groups oldest first', () => {
    const groups = groupMeals(
      [
        entry('dinner', at(19, 0)),
        entry('breakfast2', at(7, 20)),
        entry('lunch', at(12, 30)),
        entry('breakfast1', at(7, 0)),
      ],
      accessors,
    );
    assert.deepEqual(ids(groups), [['breakfast1', 'breakfast2'], ['lunch'], ['dinner']]);
    assert.deepEqual(
      groups.map((group) => group.slot),
      ['breakfast', 'lunch', 'dinner'],
    );
  });

  it('accepts Date values and skips invalid timestamps', () => {
    const groups = groupMeals(
      [
        { id: 'a', at: new Date(2026, 8, 25, 8, 0), kcal: 100 },
        { id: 'bad', at: new Date('nope'), kcal: 100 },
      ],
      { eatenAt: (e) => e.at, kcal: (e) => e.kcal },
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.entries[0]!.id, 'a');
  });

  it('returns nothing for no entries', () => {
    assert.deepEqual(groupMeals([], accessors), []);
  });

  it('names by the start time even when the chain runs into the next window', () => {
    const groups = groupMeals(
      [entry('a', at(10, 50)), entry('b', at(11, 30))],
      accessors,
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.slot, 'breakfast');
  });

  it('keeps one main meal per window: the one with more kcal, others become snacks', () => {
    const groups = groupMeals(
      [
        entry('coffee', at(6, 30), 60),
        entry('breakfast', at(8, 30), 500),
        entry('fruit', at(10, 30), 120),
      ],
      accessors,
    );
    assert.deepEqual(
      groups.map((group) => group.slot),
      ['snack', 'breakfast', 'snack'],
    );
  });

  it('keeps the earlier meal on a kcal tie', () => {
    const groups = groupMeals(
      [entry('a', at(12, 0), 400), entry('b', at(14, 0), 400)],
      accessors,
    );
    assert.deepEqual(
      groups.map((group) => group.slot),
      ['lunch', 'snack'],
    );
  });

  it('applies the one-main-meal rule per day', () => {
    const groups = groupMeals(
      [entry('a', at(8, 0, 0, 24), 400), entry('b', at(8, 0, 0, 25), 200)],
      accessors,
    );
    assert.deepEqual(
      groups.map((group) => group.slot),
      ['breakfast', 'breakfast'],
    );
  });
});

describe('mealSlotForStartTime', () => {
  const slot = (h: number, m: number) => mealSlotForStartTime(new Date(2026, 8, 25, h, m));

  it('treats the night as snack time', () => {
    assert.equal(slot(0, 0), 'snack');
    assert.equal(slot(3, 59), 'snack');
  });

  it('breakfast from 04:00 until 10:59', () => {
    assert.equal(slot(4, 0), 'breakfast');
    assert.equal(slot(10, 59), 'breakfast');
  });

  it('lunch from 11:00 until 14:59', () => {
    assert.equal(slot(11, 0), 'lunch');
    assert.equal(slot(14, 59), 'lunch');
  });

  it('snack from 15:00 until 17:29', () => {
    assert.equal(slot(15, 0), 'snack');
    assert.equal(slot(17, 29), 'snack');
  });

  it('dinner from 17:30', () => {
    assert.equal(slot(17, 30), 'dinner');
    assert.equal(slot(23, 59), 'dinner');
  });
});

describe('mealGroupLabel', () => {
  const label = (slot: 'breakfast' | 'lunch' | 'snack' | 'dinner', h: number, m: number) =>
    mealGroupLabel({ slot, startAt: new Date(2026, 8, 25, h, m) });

  it('keeps main meal names', () => {
    assert.equal(label('breakfast', 8, 0), 'breakfast');
    assert.equal(label('lunch', 12, 0), 'lunch');
    assert.equal(label('dinner', 19, 0), 'dinner');
  });

  it('marks snacks from 15:00 until 17:29 as the afternoon snack', () => {
    assert.equal(label('snack', 15, 0), 'afternoonSnack');
    assert.equal(label('snack', 17, 29), 'afternoonSnack');
  });

  it('keeps other snacks plain', () => {
    assert.equal(label('snack', 14, 59), 'snack');
    assert.equal(label('snack', 17, 30), 'snack');
    assert.equal(label('snack', 2, 0), 'snack');
    assert.equal(label('snack', 10, 0), 'snack');
  });
});
