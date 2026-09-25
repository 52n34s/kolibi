import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  todayBodyCard,
  todayNutritionSummary,
  todaySectionOrder,
  visibleTodaySections,
  todayTrainingState,
} from './today-layout.ts';

describe('todaySectionOrder', () => {
  it('puts calories and weight first when losing weight', () => {
    assert.deepEqual(todaySectionOrder('lose'), ['nutrition', 'body', 'training']);
  });

  it('puts training first for muscle and strength', () => {
    assert.deepEqual(todaySectionOrder('muscle'), ['training', 'nutrition', 'body']);
    assert.deepEqual(todaySectionOrder('strength'), ['training', 'nutrition', 'body']);
  });

  it('keeps the default order without a goal', () => {
    assert.deepEqual(todaySectionOrder(null), ['training', 'nutrition', 'body']);
    assert.deepEqual(todaySectionOrder('maintain'), ['training', 'nutrition', 'body']);
  });
});

describe('todayBodyCard', () => {
  it('shows the build-up card for muscle and strength, else the weight card', () => {
    assert.equal(todayBodyCard('muscle'), 'buildUp');
    assert.equal(todayBodyCard('strength'), 'buildUp');
    assert.equal(todayBodyCard('lose'), 'weight');
    assert.equal(todayBodyCard(null), 'weight');
  });
});

describe('todayNutritionSummary', () => {
  it('shows kcal left and protein', () => {
    assert.deepEqual(
      todayNutritionSummary({ kcalTarget: 2200, kcalEaten: 1450.4, proteinTarget: 150, proteinEaten: 77.6 }),
      { kcalLeft: 750, kcalOver: null, proteinEaten: 78, proteinTarget: 150 },
    );
  });

  it('reports kcal over the target instead of a negative rest', () => {
    const summary = todayNutritionSummary({ kcalTarget: 2000, kcalEaten: 2150, proteinTarget: null, proteinEaten: 0 });
    assert.equal(summary.kcalLeft, 0);
    assert.equal(summary.kcalOver, 150);
    assert.equal(summary.proteinTarget, null);
  });

  it('has no rest without a target', () => {
    assert.equal(todayNutritionSummary({ kcalTarget: null, kcalEaten: 300, proteinTarget: 0, proteinEaten: 10 }).kcalLeft, null);
  });
});

describe('todayTrainingState', () => {
  const base = { todayKey: '2026-09-25', todayWeekday: 5 };

  it('asks for a plan without units', () => {
    assert.equal(todayTrainingState({ ...base, units: [], sessions: [] }), 'none');
  });

  it('marks the day done once a session is logged today', () => {
    assert.equal(
      todayTrainingState({ ...base, units: [{ weekdays: [] }], sessions: [{ loggedOn: '2026-09-25' }] }),
      'done',
    );
  });

  it('is a rest day when the plan uses weekdays and today has none', () => {
    assert.equal(
      todayTrainingState({ ...base, units: [{ weekdays: [1, 3] }, { weekdays: [2] }], sessions: [] }),
      'rest',
    );
  });

  it('offers the next unit on a planned day and in a rotating plan', () => {
    assert.equal(todayTrainingState({ ...base, units: [{ weekdays: [5] }], sessions: [] }), 'next');
    assert.equal(todayTrainingState({ ...base, units: [{ weekdays: [] }], sessions: [] }), 'next');
  });
});

describe('visibleTodaySections', () => {
  it('hides the training card while the session banner shows', () => {
    assert.deepEqual(visibleTodaySections('muscle', { sessionBannerShown: true }), ['nutrition', 'body']);
    assert.deepEqual(visibleTodaySections('lose', { sessionBannerShown: true }), ['nutrition', 'body']);
  });

  it('keeps every section without a running session', () => {
    assert.deepEqual(visibleTodaySections('muscle', { sessionBannerShown: false }), [
      'training',
      'nutrition',
      'body',
    ]);
  });
});
