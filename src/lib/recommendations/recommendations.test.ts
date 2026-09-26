import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { createMemoryKvStorage } from '../workouts/kv-storage.ts';
import {
  dismissalsKey,
  parseDismissals,
  readDismissals,
  writeDismissal,
} from './dismissals.ts';
import {
  buildRecommendations,
  daysBetweenKeys,
  expectedDayShareByMeal,
  isSnoozed,
  macroGap,
  RECOMMENDATION_RULES,
  type Recommendation,
  type RecommendationContext,
  isTrainingDay,
} from './recommendations.ts';

const TODAY = '2026-09-25';
const NOW = Date.parse('2026-09-25T15:00:00Z');

function ctx(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    goalCategory: 'lose',
    hour: 15,
    minute: 0,
    todayKey: TODAY,
    nowMs: NOW,
    trainingDay: false,
    trainedToday: false,
    trainedTodayKind: null,
    hoursSinceTraining: null,
    focusAreas: null,
    deloadSuggested: false,
    // Behind the old clock curve's own default (15:00 ≈ 54 % expected) so
    // pre-existing non-nutrition tests stay nutrition-quiet by default.
    consumed: { proteinG: 100, carbsG: 150, fiberG: 20 },
    targets: { kcal: 2000, proteinG: 120, carbsG: 220, fiberG: 30 },
    lastMealSlot: 'lunch',
    readiness: null,
    nextLevel: null,
    muscleDeficits: [],
    lastWeightDateKey: TODAY,
    lastMeasurementDateKey: null,
    usesMeasurements: false,
    checkinStatus: null,
    dismissals: {},
    ...overrides,
  };
}

function kinds(list: Recommendation[]): string[] {
  return list.map((rec) => rec.kind);
}

function loadLocale(lang: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL(`../../i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
}

function lookup(tree: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node != null && typeof node === 'object') {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
}

describe('expectedDayShareByMeal', () => {
  it('is 0 before the first meal logged today', () => {
    assert.equal(expectedDayShareByMeal({ lastMealSlot: null, hour: 12 }), 0);
    assert.equal(expectedDayShareByMeal({ lastMealSlot: undefined, hour: 12 }), 0);
  });

  it('rises by day progress, not the clock', () => {
    assert.equal(expectedDayShareByMeal({ lastMealSlot: 'breakfast', hour: 10 }), 0.25);
    assert.equal(expectedDayShareByMeal({ lastMealSlot: 'lunch', hour: 14 }), 0.55);
    assert.equal(expectedDayShareByMeal({ lastMealSlot: 'afternoonSnack', hour: 16 }), 0.7);
    // An early dinner (from 17:30) reads the same as the afternoon snack.
    assert.equal(expectedDayShareByMeal({ lastMealSlot: 'dinner', hour: 18 }), 0.7);
  });

  it('is the full target from 19:00 on, whatever the last meal was', () => {
    assert.equal(expectedDayShareByMeal({ lastMealSlot: 'breakfast', hour: 19 }), 1);
    assert.equal(expectedDayShareByMeal({ lastMealSlot: 'dinner', hour: 23 }), 1);
  });
});

describe('macroGap', () => {
  const base = { target: 160, lastMealSlot: 'breakfast' as const, hour: 10, minRemaining: 15 };

  it('stays quiet before the first meal', () => {
    assert.equal(macroGap({ ...base, consumed: 0, lastMealSlot: null }), null);
    assert.equal(macroGap({ ...base, consumed: 0, lastMealSlot: undefined }), null);
  });

  it('returns the grams and the relative gap when clearly behind pace', () => {
    // Breakfast → 25 % of 160 g = 40 g expected, 80 % of that = 32 g.
    const gap = macroGap({ ...base, consumed: 30 });
    assert.equal(gap?.remainingG, 130);
    assert.ok(gap && Math.abs(gap.relativeGap - (40 - 30) / 40) < 1e-9);
  });

  it('stays quiet when close enough to the expected pace', () => {
    assert.equal(macroGap({ ...base, consumed: 45 }), null);
  });

  it('stays quiet when the gap is small', () => {
    // Afternoon snack → 70 % of 160 g = 112 g expected, 80 % ≈ 89.6 g.
    assert.ok(macroGap({ ...base, lastMealSlot: 'afternoonSnack', consumed: 85, minRemaining: 5 }));
    assert.equal(
      macroGap({ ...base, lastMealSlot: 'afternoonSnack', consumed: 85, minRemaining: 80 }),
      null,
    );
  });

  it('stays quiet for unknown intake or target', () => {
    assert.equal(macroGap({ ...base, consumed: null }), null);
    assert.equal(macroGap({ ...base, consumed: 0, target: null }), null);
    assert.equal(macroGap({ ...base, consumed: 0, target: 0 }), null);
    assert.equal(macroGap({ ...base, consumed: Number.NaN }), null);
  });
});

describe('daysBetweenKeys / isSnoozed', () => {
  it('counts calendar days', () => {
    assert.equal(daysBetweenKeys('2026-09-18', TODAY), 7);
    assert.equal(daysBetweenKeys('2026-02-28', '2026-03-01'), 1);
    assert.equal(daysBetweenKeys('bad', TODAY), null);
  });

  it('snoozes for exactly three days', () => {
    const at = new Date(NOW - RECOMMENDATION_RULES.snoozeMs + 1).toISOString();
    assert.equal(isSnoozed(at, NOW), true);
    const old = new Date(NOW - RECOMMENDATION_RULES.snoozeMs).toISOString();
    assert.equal(isSnoozed(old, NOW), false);
    assert.equal(isSnoozed(undefined, NOW), false);
    assert.equal(isSnoozed('garbage', NOW), false);
  });
});

describe('buildRecommendations – nutrition (day progress, not clock time)', () => {
  it('nothing before the first meal of the day, even with a large gap', () => {
    const list = buildRecommendations(
      ctx({ hour: 10, lastMealSlot: null, consumed: { proteinG: 0, carbsG: 0, fiberG: 0 } }),
    );
    assert.deepEqual(kinds(list), []);
  });

  it('after breakfast, clearly behind → card', () => {
    const list = buildRecommendations(
      ctx({
        hour: 10,
        lastMealSlot: 'breakfast',
        consumed: { proteinG: 30, carbsG: 0, fiberG: 30 },
        targets: { kcal: 2000, proteinG: 160, carbsG: 220, fiberG: 30 },
      }),
    );
    assert.deepEqual(kinds(list), ['protein']);
  });

  it('after breakfast, close enough → no card', () => {
    const list = buildRecommendations(
      ctx({
        hour: 10,
        lastMealSlot: 'breakfast',
        consumed: { proteinG: 45, carbsG: 0, fiberG: 30 },
        targets: { kcal: 2000, proteinG: 160, carbsG: 220, fiberG: 30 },
      }),
    );
    assert.deepEqual(kinds(list), []);
  });

  it('after lunch, behind → card', () => {
    const list = buildRecommendations(
      ctx({
        hour: 13,
        lastMealSlot: 'lunch',
        consumed: { proteinG: 60, carbsG: 0, fiberG: 30 },
        targets: { kcal: 2000, proteinG: 160, carbsG: 220, fiberG: 30 },
      }),
    );
    assert.deepEqual(kinds(list), ['protein']);
  });

  it('19:30, large gap → card (the full target is expected from 19:00 on)', () => {
    const list = buildRecommendations(
      ctx({
        hour: 19,
        lastMealSlot: 'dinner',
        consumed: { proteinG: 20, carbsG: 0, fiberG: 30 },
        targets: { kcal: 2000, proteinG: 160, carbsG: 220, fiberG: 30 },
      }),
    );
    assert.deepEqual(kinds(list), ['protein']);
  });

  it('protein hint with amount, goal reason and meals action', () => {
    const [rec] = buildRecommendations(
      ctx({ lastMealSlot: 'dinner', hour: 19, consumed: { proteinG: 47, carbsG: 150, fiberG: 20 } }),
    );
    assert.equal(rec?.kind, 'protein');
    assert.deepEqual(rec?.message, { key: 'recommendations.protein.message', params: { grams: 73 } });
    assert.deepEqual(rec?.reason, { key: 'onboarding2.focus.reason.lose.protein' });
    assert.deepEqual(rec?.action, { target: 'meals', labelKey: 'recommendations.protein.action' });
    assert.equal(rec?.icon, 'egg-outline');
  });

  it('protein without a goal has no reason line', () => {
    const [rec] = buildRecommendations(
      ctx({
        goalCategory: null,
        lastMealSlot: 'dinner',
        hour: 19,
        consumed: { proteinG: 0, carbsG: 0, fiberG: 0 },
      }),
    );
    assert.equal(rec?.kind, 'protein');
    assert.equal(rec?.reason, null);
  });

  it('fiber only for goals with fiber in focus', () => {
    const behind = { proteinG: 160, carbsG: 220, fiberG: 2 };
    const targets = { kcal: 2000, proteinG: 160, carbsG: 220, fiberG: 30 };
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ lastMealSlot: 'dinner', hour: 19, consumed: behind, targets }))),
      ['fiber'],
    );
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ goalCategory: 'maintain', lastMealSlot: 'dinner', hour: 19, consumed: behind, targets }),
        ),
      ),
      ['fiber'],
    );
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ goalCategory: 'muscle', lastMealSlot: 'dinner', hour: 19, consumed: behind, targets }),
        ),
      ),
      [],
    );
  });

  it('carbs on training days before the session, for carb-focused goals', () => {
    const behind = { proteinG: 160, carbsG: 20, fiberG: 30 };
    const targets = { kcal: 2000, proteinG: 160, carbsG: 220, fiberG: 30 };
    const muscle = buildRecommendations(
      ctx({
        goalCategory: 'muscle',
        trainingDay: true,
        lastMealSlot: 'dinner',
        hour: 19,
        consumed: behind,
        targets,
      }),
    );
    assert.deepEqual(kinds(muscle), ['carbs_training']);
    assert.deepEqual(muscle[0]?.reason, {
      key: 'onboarding2.focus.reason.muscle.carbs_around_training',
    });
    // Not on rest days, not after the session, not for lose.
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ goalCategory: 'muscle', lastMealSlot: 'dinner', hour: 19, consumed: behind, targets }),
        ),
      ),
      [],
    );
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({
            goalCategory: 'muscle',
            trainingDay: true,
            trainedToday: true,
            lastMealSlot: 'dinner',
            hour: 19,
            consumed: behind,
            targets,
          }),
        ),
      ),
      [],
    );
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ trainingDay: true, lastMealSlot: 'dinner', hour: 19, consumed: behind, targets }),
        ),
      ),
      [],
    );
  });

  it('only the single biggest relative gap shows, never several at once', () => {
    const behind = { proteinG: 0, carbsG: 0, fiberG: 0 };
    // 'lose' has both protein and fiber in its focus table; both are at 0, so
    // both tie on relative gap — the goal's own order breaks the tie.
    const list = buildRecommendations(
      ctx({ goalCategory: 'lose', lastMealSlot: 'dinner', hour: 19, consumed: behind }),
    );
    assert.deepEqual(kinds(list), ['protein']);
  });

  it('missing consumption or targets → no nutrition hints', () => {
    assert.deepEqual(kinds(buildRecommendations(ctx({ consumed: null }))), []);
    assert.deepEqual(kinds(buildRecommendations(ctx({ targets: null }))), []);
  });
});

describe('buildRecommendations – training', () => {
  const deficit = {
    group: 'back',
    groupName: 'Rücken',
    setsToAdd: 4,
    exerciseId: 'ex-row',
    exerciseName: 'Rudern',
  };

  it('next level ready → exercise progress', () => {
    const [rec] = buildRecommendations(
      ctx({ nextLevel: { exerciseId: 'ex-1', exerciseName: 'Liegestütz' } }),
    );
    assert.equal(rec?.kind, 'next_level');
    assert.deepEqual(rec?.action, {
      target: 'exerciseProgress',
      exerciseId: 'ex-1',
      labelKey: 'recommendations.nextLevel.action',
    });
    assert.deepEqual(rec?.message.params, { exercise: 'Liegestütz' });
  });

  it('largest muscle deficit of at least 3 sets', () => {
    const list = buildRecommendations(
      ctx({
        goalCategory: 'muscle',
        muscleDeficits: [
          { ...deficit, group: 'chest', groupName: 'Brust', setsToAdd: 2, exerciseId: 'a' },
          deficit,
          { ...deficit, group: 'legs', groupName: 'Beine', setsToAdd: 3, exerciseId: 'b' },
        ],
      }),
    );
    assert.deepEqual(kinds(list), ['muscle_deficit']);
    assert.deepEqual(list[0]?.message.params, { group: 'Rücken', count: 4, exercise: 'Rudern' });
    assert.deepEqual(list[0]?.reason, { key: 'onboarding2.focus.reason.muscle.sets_per_muscle' });
    assert.equal(list[0]?.action.target, 'exerciseProgress');
  });

  it('small deficits stay quiet', () => {
    const list = buildRecommendations(ctx({ muscleDeficits: [{ ...deficit, setsToAdd: 2 }] }));
    assert.deepEqual(kinds(list), []);
  });

  it('gentle day on a training day → rest instead of more load', () => {
    const list = buildRecommendations(
      ctx({
        goalCategory: 'strength',
        readiness: 'gentle',
        trainingDay: true,
        nextLevel: { exerciseId: 'ex-1', exerciseName: 'Klimmzug' },
        muscleDeficits: [deficit],
      }),
    );
    assert.deepEqual(kinds(list), ['rest_day']);
    assert.deepEqual(list[0]?.action, { target: 'training', labelKey: 'recommendations.restDay.action' });
    assert.deepEqual(list[0]?.reason, { key: 'onboarding2.focus.reason.strength.recovery' });
  });

  it('gentle day without planned training or after the session → nothing', () => {
    assert.deepEqual(kinds(buildRecommendations(ctx({ readiness: 'gentle' }))), []);
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ readiness: 'gentle', trainingDay: true, trainedToday: true }))),
      [],
    );
  });

  it('ready / normal days keep level-ups', () => {
    const list = buildRecommendations(
      ctx({ readiness: 'ready', nextLevel: { exerciseId: 'x', exerciseName: 'X' } }),
    );
    assert.deepEqual(kinds(list), ['next_level']);
  });
});

describe('buildRecommendations – data', () => {
  it('weight after 7 days for lose / muscle / maintain', () => {
    for (const goal of ['lose', 'muscle', 'maintain'] as const) {
      const list = buildRecommendations(ctx({ goalCategory: goal, lastWeightDateKey: '2026-09-18' }));
      assert.deepEqual(kinds(list), ['weight'], goal);
      assert.deepEqual(list[0]?.action, {
        target: 'weightSheet',
        labelKey: 'recommendations.weight.action',
      });
    }
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ lastWeightDateKey: '2026-09-19' }))),
      [],
    );
  });

  it('no weight hint for strength / endurance / custom / no goal', () => {
    for (const goal of ['strength', 'endurance', 'custom', null] as const) {
      assert.deepEqual(
        kinds(buildRecommendations(ctx({ goalCategory: goal, lastWeightDateKey: '2026-08-01' }))),
        [],
        String(goal),
      );
    }
  });

  it('never weighed → first weigh-in text; unknown → quiet', () => {
    const [rec] = buildRecommendations(ctx({ lastWeightDateKey: null }));
    assert.equal(rec?.message.key, 'recommendations.weight.messageFirst');
    assert.deepEqual(kinds(buildRecommendations(ctx({ lastWeightDateKey: undefined }))), []);
  });

  it('measurements after 14 days, only for people who measure', () => {
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ usesMeasurements: true, lastMeasurementDateKey: '2026-09-11' }),
        ),
      ),
      ['measurements'],
    );
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ usesMeasurements: true, lastMeasurementDateKey: '2026-09-12' }),
        ),
      ),
      [],
    );
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ usesMeasurements: false, lastMeasurementDateKey: '2026-08-01' }),
        ),
      ),
      [],
    );
  });

  it('open check-in from 18:00 on (once the inline card\'s own window has closed)', () => {
    assert.deepEqual(kinds(buildRecommendations(ctx({ checkinStatus: 'open', hour: 18 }))), ['checkin']);
    const [card] = buildRecommendations(ctx({ checkinStatus: 'open', hour: 18 }));
    assert.equal(card?.message.key, 'recommendations.checkin.message');
    assert.equal(card?.reason?.key, 'recommendations.checkin.body');
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ checkinStatus: 'open', hour: 17, minute: 59 }))),
      [],
    );
    for (const status of ['answered', 'skipped', 'disabled'] as const) {
      assert.deepEqual(kinds(buildRecommendations(ctx({ checkinStatus: status, hour: 18 }))), []);
    }
  });
});

describe('buildRecommendations – ordering, cap and snooze', () => {
  const busy = ctx({
    goalCategory: 'muscle',
    trainingDay: true,
    consumed: { proteinG: 0, carbsG: 0, fiberG: 0 },
    nextLevel: { exerciseId: 'x', exerciseName: 'X' },
    lastWeightDateKey: '2026-09-01',
    checkinStatus: 'open',
  });

  it('nutrition, then training, then data; at most three', () => {
    // Only one nutrition card at a time: protein wins the tie with carbs_training.
    assert.deepEqual(kinds(buildRecommendations(busy)), ['protein', 'next_level', 'weight']);
  });

  it('a dismissed kind makes room for the next one', () => {
    const list = buildRecommendations({
      ...busy,
      dismissals: { protein: new Date(NOW - 60_000).toISOString() },
    });
    assert.deepEqual(kinds(list), ['carbs_training', 'next_level', 'weight']);
  });

  it('comes back after three days', () => {
    const list = buildRecommendations({
      ...busy,
      dismissals: { protein: new Date(NOW - 4 * 24 * 3600_000).toISOString() },
    });
    assert.equal(list[0]?.kind, 'protein');
  });

  it('empty context → empty list, never a throw', () => {
    assert.deepEqual(
      buildRecommendations(
        ctx({
          goalCategory: null,
          consumed: null,
          targets: null,
          lastWeightDateKey: undefined,
          lastMeasurementDateKey: undefined,
        }),
      ),
      [],
    );
  });
});

describe('buildRecommendations – after the session', () => {
  const afterTraining = ctx({
    trainedToday: true,
    trainedTodayKind: 'strength',
    hoursSinceTraining: 1,
    consumed: { proteinG: 40, carbsG: 60, fiberG: 20, fatG: 60 },
    targets: { kcal: 2000, proteinG: 120, carbsG: 220, fiberG: 30, fatG: 65 },
  });

  it('protein first after strength — one sentence, no second line', () => {
    const [rec] = buildRecommendations(afterTraining);
    assert.equal(rec?.kind, 'post_training');
    assert.deepEqual(rec?.message, { key: 'postTraining.protein', params: { g: 80 } });
  });

  it('carbs lead after a run', () => {
    const [rec] = buildRecommendations({ ...afterTraining, trainedTodayKind: 'endurance' });
    assert.equal(rec?.message.key, 'postTraining.carbs');
  });

  it('is the only nutrition card while its window is open, even with a fiber gap too', () => {
    const list = buildRecommendations({
      ...afterTraining,
      trainingDay: true,
      consumed: { proteinG: 0, carbsG: 0, fiberG: 0, fatG: 0 },
    });
    assert.deepEqual(kinds(list), ['post_training']);
  });

  it('stays quiet outside the window and without a session', () => {
    assert.deepEqual(kinds(buildRecommendations({ ...afterTraining, hoursSinceTraining: 5 })), [
      'protein',
    ]);
    assert.deepEqual(kinds(buildRecommendations({ ...afterTraining, hoursSinceTraining: null })), [
      'protein',
    ]);
    assert.deepEqual(
      kinds(buildRecommendations({ ...afterTraining, trainedToday: false, trainedTodayKind: null })),
      ['protein'],
    );
  });

  it('stays quiet when nothing is open any more', () => {
    assert.deepEqual(
      kinds(
        buildRecommendations({
          ...afterTraining,
          consumed: { proteinG: 120, carbsG: 220, fiberG: 30, fatG: 20 },
        }),
      ),
      [],
    );
  });
});

describe('buildRecommendations – lighter week', () => {
  it('offers start and "Jetzt nicht", before the other training hints', () => {
    const list = buildRecommendations(
      ctx({ deloadSuggested: true, nextLevel: { exerciseId: 'x', exerciseName: 'X' } }),
    );
    assert.deepEqual(kinds(list), ['deload', 'next_level']);
    assert.deepEqual(list[0]?.action, {
      target: 'deloadStart',
      labelKey: 'recommendations.deload.actionStart',
    });
    assert.deepEqual(list[0]?.secondaryAction, {
      target: 'deloadDismiss',
      labelKey: 'recommendations.deload.actionDismiss',
    });
  });

  it('shows on a gentle day too', () => {
    const list = buildRecommendations(
      ctx({ deloadSuggested: true, readiness: 'gentle', trainingDay: true }),
    );
    assert.deepEqual(kinds(list), ['deload', 'rest_day']);
  });
});

describe('buildRecommendations – focus areas (breaking a relative-gap tie)', () => {
  const behind = { proteinG: 0, carbsG: 0, fiberG: 0 };

  it('a chosen topic wins the tie for which single card shows', () => {
    // 'lose' has both protein and fiber in focus; both sit at 0 g, so their
    // relative gap ties and the goal's own order decides: protein first.
    const plain = buildRecommendations(ctx({ goalCategory: 'lose', consumed: behind }));
    assert.deepEqual(kinds(plain), ['protein']);
    const withFiber = buildRecommendations(
      ctx({ goalCategory: 'lose', consumed: behind, focusAreas: ['more_fiber'] }),
    );
    assert.deepEqual(kinds(withFiber), ['fiber']);
  });

  it('two areas on the same list keep the goal order between them', () => {
    const list = buildRecommendations(
      ctx({
        goalCategory: 'lose',
        consumed: behind,
        focusAreas: ['more_fiber', 'more_protein'],
      }),
    );
    assert.deepEqual(kinds(list), ['protein']);
  });

  it('unknown ids change nothing', () => {
    const list = buildRecommendations(
      ctx({ goalCategory: 'lose', consumed: behind, focusAreas: [] }),
    );
    assert.deepEqual(kinds(list), ['protein']);
  });

  it('a chosen focus area can surface a card the goal itself would not show at all', () => {
    // muscle has no fiber entry in GOAL_FOCUS, so fiber is not even a
    // candidate on its own — but explicitly choosing "more fiber" makes it
    // one, and it then wins the tie against protein (Befund 5, week test 2).
    const plain = buildRecommendations(ctx({ goalCategory: 'muscle', consumed: behind }));
    assert.deepEqual(kinds(plain), ['protein']);
    const withFiber = buildRecommendations(
      ctx({ goalCategory: 'muscle', consumed: behind, focusAreas: ['more_fiber'] }),
    );
    assert.deepEqual(kinds(withFiber), ['fiber']);
    assert.equal(withFiber[0]?.reason, null);
  });

  it('does the same for training-energy carbs on a goal without a carbs focus', () => {
    const plain = buildRecommendations(
      ctx({ goalCategory: 'lose', trainingDay: true, consumed: behind }),
    );
    assert.deepEqual(kinds(plain), ['protein']);
    const withFocus = buildRecommendations(
      ctx({
        goalCategory: 'lose',
        trainingDay: true,
        consumed: behind,
        focusAreas: ['more_training_energy'],
      }),
    );
    assert.deepEqual(kinds(withFocus), ['carbs_training']);
    assert.equal(withFocus[0]?.reason, null);
  });
});

describe('dismissals storage', () => {
  it('writes and reads per user', () => {
    const storage = createMemoryKvStorage();
    const at = new Date('2026-09-25T10:00:00Z');
    writeDismissal(storage, 'u1', 'protein', at);
    writeDismissal(storage, 'u1', 'weight', at);
    assert.deepEqual(readDismissals(storage, 'u1'), {
      protein: at.toISOString(),
      weight: at.toISOString(),
    });
    assert.deepEqual(readDismissals(storage, 'u2'), {});
  });

  it('drops broken data', () => {
    assert.deepEqual(parseDismissals('not json'), {});
    assert.deepEqual(parseDismissals('[]'), {});
    assert.deepEqual(parseDismissals(JSON.stringify({ protein: 'x', nope: '2026-01-01', fiber: 3 })), {});
    const storage = createMemoryKvStorage({ [dismissalsKey('u1')]: '{"weight":"2026-09-20T00:00:00.000Z"}' });
    assert.deepEqual(readDismissals(storage, 'u1'), { weight: '2026-09-20T00:00:00.000Z' });
  });
});

describe('i18n', () => {
  it('every key the engine emits exists in de / en / es', () => {
    const behind = { proteinG: 0, carbsG: 0, fiberG: 0 };
    const lists: Recommendation[][] = [];
    for (const goal of ['lose', 'muscle', 'strength', 'maintain', 'endurance', 'custom', null] as const) {
      lists.push(
        buildRecommendations(ctx({ goalCategory: goal, trainingDay: true, consumed: behind })),
        buildRecommendations(
          ctx({
            goalCategory: goal,
            consumed: null,
            readiness: 'gentle',
            trainingDay: true,
            lastWeightDateKey: null,
          }),
        ),
        buildRecommendations(
          ctx({
            goalCategory: goal,
            consumed: null,
            nextLevel: { exerciseId: 'x', exerciseName: 'X' },
            muscleDeficits: [
              { group: 'back', groupName: 'Back', setsToAdd: 5, exerciseId: 'y', exerciseName: 'Y' },
            ],
            lastWeightDateKey: '2026-09-01',
          }),
        ),
        buildRecommendations(
          ctx({
            goalCategory: goal,
            consumed: null,
            usesMeasurements: true,
            lastMeasurementDateKey: '2026-08-01',
            checkinStatus: 'open',
          }),
        ),
        buildRecommendations(ctx({ goalCategory: goal, deloadSuggested: true })),
        buildRecommendations(
          ctx({
            goalCategory: goal,
            trainedToday: true,
            trainedTodayKind: 'strength',
            hoursSinceTraining: 1,
            consumed: { ...behind, fatG: 60 },
            targets: { kcal: 2000, proteinG: 120, carbsG: 220, fiberG: 30, fatG: 65 },
          }),
        ),
      );
    }
    const keys = new Set<string>();
    for (const rec of lists.flat()) {
      keys.add(rec.message.key);
      keys.add(rec.action.labelKey);
      if (rec.secondaryAction) {
        keys.add(rec.secondaryAction.labelKey);
      }
      if (rec.reason) {
        keys.add(rec.reason.key);
      }
    }
    assert.ok(keys.size >= 15);
    for (const lang of ['de', 'en', 'es']) {
      const tree = loadLocale(lang);
      for (const key of keys) {
        assert.equal(typeof lookup(tree, key), 'string', `${lang}: ${key}`);
      }
      for (const key of ['recommendations.title', 'recommendations.dismiss']) {
        assert.equal(typeof lookup(tree, key), 'string', `${lang}: ${key}`);
      }
    }
  });
});

describe('isTrainingDay', () => {
  const base = { todayKey: '2026-09-25', weekday: 5, weekStartKey: '2026-09-21' };

  it('counts a planned weekday and a session logged today', () => {
    assert.equal(isTrainingDay({ ...base, units: [{ weekdays: [5] }], sessionDays: [], sessionsPerWeek: 3 }), true);
    assert.equal(isTrainingDay({ ...base, units: [{ weekdays: [1] }], sessionDays: ['2026-09-25'], sessionsPerWeek: 3 }), true);
    assert.equal(isTrainingDay({ ...base, units: [{ weekdays: [1] }], sessionDays: [], sessionsPerWeek: 3 }), false);
  });

  // Units from the plan wizard have no weekdays: carbs before the session used
  // to be unreachable for them.
  it('treats a rotating plan as a training day while the week goal is open', () => {
    const units = [{ weekdays: [] }, { weekdays: [] }];
    assert.equal(isTrainingDay({ ...base, units, sessionDays: ['2026-09-22'], sessionsPerWeek: 2 }), true);
    assert.equal(
      isTrainingDay({ ...base, units, sessionDays: ['2026-09-22', '2026-09-24'], sessionsPerWeek: 2 }),
      false,
    );
    assert.equal(isTrainingDay({ ...base, units, sessionDays: ['2026-09-18'], sessionsPerWeek: null }), true);
  });

  it('has no training day without units', () => {
    assert.equal(isTrainingDay({ ...base, units: [], sessionDays: [], sessionsPerWeek: 3 }), false);
  });
});
