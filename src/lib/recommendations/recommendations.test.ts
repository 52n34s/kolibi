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
  expectedDayShare,
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
    consumed: { proteinG: 100, carbsG: 150, fiberG: 20 },
    targets: { kcal: 2000, proteinG: 120, carbsG: 220, fiberG: 30 },
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

describe('expectedDayShare', () => {
  it('is 0 until 08:00 and 1 from 21:00', () => {
    assert.equal(expectedDayShare(6, 0), 0);
    assert.equal(expectedDayShare(8, 0), 0);
    assert.equal(expectedDayShare(21, 0), 1);
    assert.equal(expectedDayShare(23, 30), 1);
  });

  it('rises linearly in between', () => {
    assert.equal(expectedDayShare(14, 30), 0.5);
    assert.ok(Math.abs(expectedDayShare(10, 0) - 2 / 13) < 1e-9);
  });
});

describe('macroGap', () => {
  const base = { target: 120, hour: 15, minute: 0, minRemaining: 15 };

  it('stays quiet before 10:00', () => {
    assert.equal(macroGap({ ...base, consumed: 0, hour: 9, minute: 59 }), null);
  });

  it('returns the grams to the target when clearly behind the curve', () => {
    // 15:00 → 7/13 of 120 ≈ 64.6 g expected, 80 % ≈ 51.7 g.
    assert.equal(macroGap({ ...base, consumed: 47 }), 73);
  });

  it('stays quiet when only slightly behind', () => {
    assert.equal(macroGap({ ...base, consumed: 55 }), null);
  });

  it('stays quiet when the gap is small', () => {
    // 22:00: 90 g is behind 80 % of 120 g, but 30 g stays under a 40 g minimum.
    assert.equal(macroGap({ ...base, consumed: 90, hour: 22 }), 30);
    assert.equal(macroGap({ ...base, consumed: 90, hour: 22, minRemaining: 40 }), null);
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

describe('buildRecommendations – nutrition', () => {
  it('protein hint with amount, goal reason and meals action', () => {
    const [rec] = buildRecommendations(ctx({ consumed: { proteinG: 47, carbsG: 150, fiberG: 20 } }));
    assert.equal(rec?.kind, 'protein');
    assert.deepEqual(rec?.message, { key: 'recommendations.protein.message', params: { grams: 73 } });
    assert.deepEqual(rec?.reason, { key: 'onboarding2.focus.reason.lose.protein' });
    assert.deepEqual(rec?.action, { target: 'meals', labelKey: 'recommendations.protein.action' });
    assert.equal(rec?.icon, 'egg-outline');
  });

  it('nothing about the day before 10:00', () => {
    const list = buildRecommendations(
      ctx({ hour: 9, consumed: { proteinG: 0, carbsG: 0, fiberG: 0 } }),
    );
    assert.deepEqual(kinds(list), []);
  });

  it('protein without a goal has no reason line', () => {
    const [rec] = buildRecommendations(
      ctx({ goalCategory: null, consumed: { proteinG: 0, carbsG: 0, fiberG: 0 } }),
    );
    assert.equal(rec?.kind, 'protein');
    assert.equal(rec?.reason, null);
  });

  it('fiber only for goals with fiber in focus', () => {
    const behind = { proteinG: 100, carbsG: 150, fiberG: 2 };
    assert.deepEqual(kinds(buildRecommendations(ctx({ consumed: behind }))), ['fiber']);
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ goalCategory: 'maintain', consumed: behind }))),
      ['fiber'],
    );
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ goalCategory: 'muscle', consumed: behind }))),
      [],
    );
  });

  it('carbs on training days before the session, for carb-focused goals', () => {
    const behind = { proteinG: 100, carbsG: 20, fiberG: 20 };
    const muscle = buildRecommendations(
      ctx({ goalCategory: 'muscle', trainingDay: true, consumed: behind }),
    );
    assert.deepEqual(kinds(muscle), ['carbs_training']);
    assert.deepEqual(muscle[0]?.reason, {
      key: 'onboarding2.focus.reason.muscle.carbs_around_training',
    });
    // Not on rest days, not after the session, not for lose.
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ goalCategory: 'muscle', consumed: behind }))),
      [],
    );
    assert.deepEqual(
      kinds(
        buildRecommendations(
          ctx({ goalCategory: 'muscle', trainingDay: true, trainedToday: true, consumed: behind }),
        ),
      ),
      [],
    );
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ trainingDay: true, consumed: behind }))),
      [],
    );
  });

  it('orders nutrition by the goal focus table', () => {
    const behind = { proteinG: 0, carbsG: 0, fiberG: 0 };
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ goalCategory: 'strength', trainingDay: true, consumed: behind }))),
      ['carbs_training', 'protein'],
    );
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ goalCategory: 'maintain', consumed: behind }))),
      ['fiber', 'protein'],
    );
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ goalCategory: 'lose', consumed: behind }))),
      ['protein', 'fiber'],
    );
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

  it('open check-in from 12:00 on', () => {
    assert.deepEqual(kinds(buildRecommendations(ctx({ checkinStatus: 'open' }))), ['checkin']);
    assert.deepEqual(
      kinds(buildRecommendations(ctx({ checkinStatus: 'open', hour: 11, minute: 59 }))),
      [],
    );
    for (const status of ['answered', 'skipped', 'disabled'] as const) {
      assert.deepEqual(kinds(buildRecommendations(ctx({ checkinStatus: status }))), []);
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
    assert.deepEqual(kinds(buildRecommendations(busy)), ['protein', 'carbs_training', 'next_level']);
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
      );
    }
    const keys = new Set<string>();
    for (const rec of lists.flat()) {
      keys.add(rec.message.key);
      keys.add(rec.action.labelKey);
      if (rec.reason) {
        keys.add(rec.reason.key);
      }
    }
    assert.ok(keys.size >= 18);
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
