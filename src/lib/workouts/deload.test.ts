import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DELOAD_RULES,
  DELOAD_TEXT_KEYS,
  deloadSets,
  exercisesWithDrop,
  gentleDayCount,
  hasContinuousTraining,
  hasLighterWeek,
  isDeloadActive,
  isInSuggestCooldown,
  suggestDeload,
  worseCheckinCount,
  type DeloadContext,
  templateForStart,
} from './deload.ts';

const TODAY = '2026-09-25';
const NOW = Date.parse('2026-09-25T18:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Four full Mon-Sun weeks ending in the week of TODAY (Friday). */
const WEEK_STARTS = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'];
const TRAINED_EVERY_WEEK = ['2026-08-31', '2026-09-02', '2026-09-09', '2026-09-15', '2026-09-22', '2026-09-24'];

function evenWeeks(setCounts: readonly number[] = [40, 40, 40, 40]) {
  return WEEK_STARTS.map((weekStartKey, index) => ({
    weekStartKey,
    setCount: setCounts[index] ?? 40,
  }));
}

function gentleDays(count: number) {
  const keys = ['2026-09-25', '2026-09-24', '2026-09-23', '2026-09-22'];
  return keys.map((dateKey, index) => ({
    dateKey,
    level: (index < count ? 'gentle' : 'normal') as 'gentle' | 'normal',
  }));
}

/** Criterion 1 holds, criterion 2 does not. */
function ctx(overrides: Partial<DeloadContext> = {}): DeloadContext {
  return {
    nowMs: NOW,
    todayKey: TODAY,
    lastSuggestedAt: null,
    deloadUntil: null,
    trainingDayKeys: TRAINED_EVERY_WEEK,
    weekVolumes: evenWeeks(),
    recentReadiness: gentleDays(2),
    recentUnits: [],
    exerciseHistory: [],
    recentCheckins: [],
    checkinAverages: null,
    ...overrides,
  };
}

/** Criterion 2 holds: two exercises down, three check-ins clearly worse. */
const CRITERION_2: Partial<DeloadContext> = {
  recentUnits: [
    { exercises: [{ exerciseId: 'a', bestLoadOrReps: 8 }] },
    { exercises: [{ exerciseId: 'b', bestLoadOrReps: 40 }] },
  ],
  exerciseHistory: [
    { exerciseId: 'a', values: [10, 10, 10] },
    { exerciseId: 'b', values: [50, 50, 50] },
  ],
  recentCheckins: [
    { energy: 2, soreness: 3 },
    { energy: 2, soreness: 3 },
    { energy: 4, soreness: 5 },
    { energy: 4, soreness: 3 },
    { energy: 4, soreness: 3 },
  ],
  checkinAverages: { energy: 4, soreness: 3 },
};

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

describe('isDeloadActive', () => {
  it('covers the last day and nothing after it', () => {
    assert.equal(isDeloadActive('2026-09-27', TODAY), true);
    assert.equal(isDeloadActive(TODAY, TODAY), true);
    assert.equal(isDeloadActive('2026-09-24', TODAY), false);
    assert.equal(isDeloadActive(null, TODAY), false);
  });
});

describe('deloadSets', () => {
  it('takes one set away but keeps at least one', () => {
    assert.equal(deloadSets(4), 3);
    assert.equal(deloadSets(2), 1);
    assert.equal(deloadSets(1), 1);
    assert.equal(deloadSets(0), 1);
  });
});

describe('isInSuggestCooldown', () => {
  it('runs for 28 days', () => {
    const days = (n: number) => new Date(NOW - n * DAY_MS).toISOString();
    assert.equal(isInSuggestCooldown(days(1), NOW), true);
    assert.equal(isInSuggestCooldown(days(27), NOW), true);
    assert.equal(isInSuggestCooldown(days(DELOAD_RULES.suggestCooldownDays), NOW), false);
    assert.equal(isInSuggestCooldown(null, NOW), false);
  });

  it('treats a broken timestamp as never suggested', () => {
    assert.equal(isInSuggestCooldown('not a date', NOW), false);
  });
});

describe('hasContinuousTraining', () => {
  it('needs a session in each of the four weeks', () => {
    assert.equal(hasContinuousTraining(evenWeeks(), TRAINED_EVERY_WEEK), true);
    assert.equal(
      hasContinuousTraining(evenWeeks(), TRAINED_EVERY_WEEK.filter((key) => key !== '2026-09-09')),
      false,
    );
  });

  it('is false with fewer than four weeks of data', () => {
    assert.equal(hasContinuousTraining(evenWeeks().slice(1), TRAINED_EVERY_WEEK), false);
  });

  it('only looks at the four most recent weeks and ignores the input order', () => {
    const weeks = [{ weekStartKey: '2026-08-24', setCount: 40 }, ...evenWeeks()].reverse();
    assert.equal(hasContinuousTraining(weeks, TRAINED_EVERY_WEEK), true);
  });

  it('counts the Sunday of a week, not the Monday after', () => {
    const sundays = ['2026-09-06', '2026-09-13', '2026-09-20'];
    assert.equal(hasContinuousTraining(evenWeeks(), [...sundays, '2026-09-27']), true);
    assert.equal(hasContinuousTraining(evenWeeks(), [...sundays, '2026-09-28']), false);
  });
});

describe('hasLighterWeek', () => {
  it('finds a week clearly below the others', () => {
    assert.equal(hasLighterWeek(evenWeeks([40, 20, 40, 40])), true);
  });

  it('accepts a small dip as a normal week', () => {
    assert.equal(hasLighterWeek(evenWeeks([40, 36, 40, 40])), false);
  });

  it('is exact at the 85 % line', () => {
    assert.equal(hasLighterWeek(evenWeeks([40, 34, 40, 40])), false);
    assert.equal(hasLighterWeek(evenWeeks([40, 33, 40, 40])), true);
  });

  it('says no when nothing was trained at all', () => {
    assert.equal(hasLighterWeek(evenWeeks([0, 0, 0, 0])), false);
  });
});

describe('gentleDayCount', () => {
  it('counts gentle days inside the four-day window', () => {
    assert.equal(gentleDayCount(gentleDays(2), TODAY), 2);
    assert.equal(gentleDayCount(gentleDays(0), TODAY), 0);
  });

  it('ignores older days, future days and days without a check-in', () => {
    const days = [
      { dateKey: '2026-09-21', level: 'gentle' as const },
      { dateKey: '2026-09-26', level: 'gentle' as const },
      { dateKey: '2026-09-25', level: null },
      { dateKey: '2026-09-24', level: 'gentle' as const },
    ];
    assert.equal(gentleDayCount(days, TODAY), 1);
  });

  it('counts a day once even when it arrives twice', () => {
    const days = [
      { dateKey: '2026-09-24', level: 'gentle' as const },
      { dateKey: '2026-09-24', level: 'gentle' as const },
    ];
    assert.equal(gentleDayCount(days, TODAY), 1);
  });
});

describe('exercisesWithDrop', () => {
  const history = [
    { exerciseId: 'a', values: [10, 10, 10] },
    { exerciseId: 'b', values: [50, 50, 50] },
  ];

  it('counts exercises below 90 % of their average', () => {
    const units = [
      { exercises: [{ exerciseId: 'a', bestLoadOrReps: 8 }] },
      { exercises: [{ exerciseId: 'b', bestLoadOrReps: 40 }] },
    ];
    assert.equal(exercisesWithDrop(units, history), 2);
  });

  it('is exact at the 90 % line', () => {
    const units = [
      { exercises: [{ exerciseId: 'a', bestLoadOrReps: 9 }] },
      { exercises: [{ exerciseId: 'b', bestLoadOrReps: 44.9 }] },
    ];
    assert.equal(exercisesWithDrop(units, history), 1);
  });

  it('counts an exercise once when both units show it', () => {
    const units = [
      { exercises: [{ exerciseId: 'a', bestLoadOrReps: 6 }] },
      { exercises: [{ exerciseId: 'a', bestLoadOrReps: 7 }] },
    ];
    assert.equal(exercisesWithDrop(units, history), 1);
  });

  it('needs two units and some history', () => {
    const units = [{ exercises: [{ exerciseId: 'a', bestLoadOrReps: 1 }] }];
    assert.equal(exercisesWithDrop(units, history), 0);
    assert.equal(
      exercisesWithDrop(
        [{ exercises: [{ exerciseId: 'c', bestLoadOrReps: 1 }] }, { exercises: [] }],
        history,
      ),
      0,
    );
  });

  it('only looks at the last two units', () => {
    const units = [
      { exercises: [{ exerciseId: 'a', bestLoadOrReps: 1 }] },
      { exercises: [{ exerciseId: 'b', bestLoadOrReps: 50 }] },
      { exercises: [{ exerciseId: 'b', bestLoadOrReps: 50 }] },
    ];
    assert.equal(exercisesWithDrop(units, history), 0);
  });
});

describe('worseCheckinCount', () => {
  const averages = { energy: 4, soreness: 3 };

  it('counts low energy and high soreness', () => {
    assert.equal(worseCheckinCount([{ energy: 3, soreness: 3 }], averages), 1);
    assert.equal(worseCheckinCount([{ energy: 4, soreness: 4 }], averages), 1);
    assert.equal(worseCheckinCount([{ energy: 4, soreness: 3 }], averages), 0);
  });

  it('counts a day with both problems once', () => {
    assert.equal(worseCheckinCount([{ energy: 2, soreness: 5 }], averages), 1);
  });

  it('only looks at the last five and needs an average', () => {
    const worse = Array.from({ length: 7 }, () => ({ energy: 1, soreness: 5 }));
    assert.equal(worseCheckinCount(worse, averages), DELOAD_RULES.checkinsLookback);
    assert.equal(worseCheckinCount(worse, null), 0);
  });
});

describe('suggestDeload', () => {
  it('suggests on criterion 1: four weeks straight and two gentle days', () => {
    assert.deepEqual(suggestDeload(ctx()), { shouldSuggest: true, reason: 'load_and_gentle' });
  });

  it('stays quiet when the four weeks already had a lighter one', () => {
    assert.deepEqual(suggestDeload(ctx({ weekVolumes: evenWeeks([40, 20, 40, 40]) })), {
      shouldSuggest: false,
      reason: null,
    });
  });

  it('stays quiet with only one gentle day', () => {
    assert.deepEqual(suggestDeload(ctx({ recentReadiness: gentleDays(1) })), {
      shouldSuggest: false,
      reason: null,
    });
  });

  it('suggests on criterion 2 alone', () => {
    const result = suggestDeload(
      ctx({ ...CRITERION_2, recentReadiness: gentleDays(0), weekVolumes: evenWeeks([40, 20, 40, 40]) }),
    );
    assert.deepEqual(result, { shouldSuggest: true, reason: 'performance_and_checkin' });
  });

  it('needs both halves of criterion 2', () => {
    assert.deepEqual(
      suggestDeload(
        ctx({
          ...CRITERION_2,
          recentCheckins: [{ energy: 2, soreness: 3 }, { energy: 4, soreness: 3 }],
          recentReadiness: gentleDays(0),
        }),
      ),
      { shouldSuggest: false, reason: null },
    );
    assert.deepEqual(
      suggestDeload(
        ctx({ ...CRITERION_2, exerciseHistory: [], recentReadiness: gentleDays(0) }),
      ),
      { shouldSuggest: false, reason: null },
    );
  });

  it('without a personal check-in average criterion 2 stays quiet', () => {
    assert.deepEqual(
      suggestDeload(ctx({ ...CRITERION_2, checkinAverages: null, recentReadiness: gentleDays(0) })),
      { shouldSuggest: false, reason: null },
    );
  });

  it('both criteria still make one suggestion, named after the first', () => {
    assert.deepEqual(suggestDeload(ctx(CRITERION_2)), {
      shouldSuggest: true,
      reason: 'load_and_gentle',
    });
  });

  it('never suggests twice inside the cooldown', () => {
    assert.deepEqual(
      suggestDeload(ctx({ lastSuggestedAt: new Date(NOW - 10 * DAY_MS).toISOString() })),
      { shouldSuggest: false, reason: null },
    );
    assert.equal(
      suggestDeload(ctx({ lastSuggestedAt: new Date(NOW - 30 * DAY_MS).toISOString() })).shouldSuggest,
      true,
    );
  });

  it('never suggests while a deload is running', () => {
    assert.deepEqual(suggestDeload(ctx({ deloadUntil: '2026-09-28' })), {
      shouldSuggest: false,
      reason: null,
    });
    assert.equal(suggestDeload(ctx({ deloadUntil: '2026-09-24' })).shouldSuggest, true);
  });

  it('empty context → no suggestion, never a throw', () => {
    assert.deepEqual(
      suggestDeload({
        nowMs: NOW,
        todayKey: TODAY,
        lastSuggestedAt: null,
        deloadUntil: null,
        trainingDayKeys: [],
        weekVolumes: [],
        recentReadiness: [],
        recentUnits: [],
        exerciseHistory: [],
        recentCheckins: [],
        checkinAverages: null,
      }),
      { shouldSuggest: false, reason: null },
    );
  });
});

describe('i18n', () => {
  it('every deload key exists in de / en / es', () => {
    const keys = [
      ...Object.values(DELOAD_TEXT_KEYS),
      'settings.deload.title',
      'settings.deload.body',
      'settings.deload.active',
      'settings.deload.end',
      'settings.deload.inactive',
    ];
    for (const lang of ['de', 'en', 'es']) {
      const tree = loadLocale(lang);
      for (const key of keys) {
        assert.equal(typeof lookup(tree, key), 'string', `${lang}: ${key}`);
      }
      for (const key of [DELOAD_TEXT_KEYS.banner, 'settings.deload.active']) {
        assert.ok(String(lookup(tree, key)).includes('{{date}}'), `${lang}: ${key} needs {{date}}`);
      }
    }
  });
});

describe('templateForStart (test week 2)', () => {
  const template = {
    id: 't',
    name: 'Push',
    shortLabel: 'P',
    colorKey: 'indigo' as const,
    weekdays: [],
    position: 0,
    exercises: [
      { targetSets: 3 },
      { targetSets: 1 },
    ],
  } as unknown as import('./types.ts').WorkoutTemplate;

  it('in a lighter week every start gets one set less (never below one)', () => {
    const start = templateForStart(template, '2026-10-01', '2026-09-28');
    assert.deepEqual(start.exercises.map((e) => e.targetSets), [2, 1]);
  });

  it('outside the week, and on the day after, the plan stays as it is', () => {
    assert.equal(templateForStart(template, null, '2026-09-28'), template);
    assert.equal(templateForStart(template, '2026-10-01', '2026-10-02'), template);
    assert.deepEqual(
      templateForStart(template, '2026-10-01', '2026-10-01').exercises.map((e) => e.targetSets),
      [2, 1],
    );
  });
});
