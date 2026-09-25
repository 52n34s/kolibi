import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildUpStartKey,
  circumferenceDelta,
  computeBuildUp,
  exerciseGains,
  formatBuildUpSentence,
  isBuildUpGoal,
  weightAverageDelta,
  type BuildUpInput,
  type BuildUpSummary,
  type BuildUpTranslate,
} from './build-up.ts';
import type { SessionSet } from './workouts/types.ts';

type Dict = Record<string, unknown>;

function loadLocale(lang: string): Dict {
  const url = new URL(`../i18n/locales/${lang}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as Dict;
}

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') {
      return undefined;
    }
    node = (node as Dict)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Minimal i18next stand-in: _one/_other plurals and {{var}} interpolation. */
function makeT(lang: string): BuildUpTranslate {
  const dict = loadLocale(lang);
  return (key, options = {}) => {
    const count = options.count;
    const template =
      (typeof count === 'number' ? lookup(dict, `${key}_${count === 1 ? 'one' : 'other'}`) : undefined) ??
      lookup(dict, key);
    assert.ok(template, `missing ${lang} key ${key}`);
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));
  };
}

const TODAY = '2026-09-25';

function set(params: {
  exerciseId: string;
  name: string;
  reps?: number;
  seconds?: number;
  sessionId?: string;
}): SessionSet {
  return {
    id: `${params.exerciseId}-${Math.random()}`,
    sessionId: params.sessionId ?? 's1',
    userId: 'u1',
    exerciseId: params.exerciseId,
    exerciseName: params.name,
    exercisePosition: 0,
    setIndex: 0,
    kind: params.seconds != null ? 'time' : 'reps',
    perSide: false,
    targetReps: null,
    targetRepsMax: null,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    reps: params.reps ?? null,
    seconds: params.seconds ?? null,
    secondsOtherSide: null,
    weightKg: null,
    completedAt: '2026-09-20T10:00:00.000Z',
  };
}

function emptyInput(overrides: Partial<BuildUpInput> = {}): BuildUpInput {
  return {
    todayKey: TODAY,
    weeks: 4,
    weightKg: [],
    waistCm: [],
    chestCm: [],
    armCm: [],
    sessions: [],
    beforeBests: {},
    progressionEvents: [],
    ...overrides,
  };
}

function summary(overrides: Partial<BuildUpSummary> = {}): BuildUpSummary {
  return {
    startKey: '2026-08-29',
    weightDeltaKg: null,
    waistDeltaCm: null,
    chestDeltaCm: null,
    armDeltaCm: null,
    levelUps: 0,
    exerciseGains: [],
    ...overrides,
  };
}

describe('buildUpStartKey', () => {
  it('spans weeks * 7 days including today', () => {
    assert.equal(buildUpStartKey(TODAY, 4), '2026-08-29');
    assert.equal(buildUpStartKey(TODAY, 12), '2026-07-04');
  });
});

describe('weightAverageDelta', () => {
  it('compares the last 7 days with the 7 days ending at the window start', () => {
    const weights = [
      { on: '2026-08-24', value: 80 },
      { on: '2026-08-28', value: 81 },
      { on: '2026-09-20', value: 81.5 },
      { on: '2026-09-24', value: 82.5 },
    ];
    assert.equal(weightAverageDelta(weights, '2026-08-29', TODAY), 1.5);
  });

  it('falls back to the 7 days from the first weigh-in in the window', () => {
    const weights = [
      { on: '2026-09-01', value: 80 },
      { on: '2026-09-05', value: 80.4 },
      { on: '2026-09-10', value: 99 },
      { on: '2026-09-25', value: 81 },
    ];
    assert.ok(Math.abs(weightAverageDelta(weights, '2026-08-29', TODAY)! - 0.8) < 1e-9);
  });

  it('needs a weigh-in in the last 7 days and two separate windows', () => {
    assert.equal(weightAverageDelta([{ on: '2026-09-01', value: 80 }], '2026-08-29', TODAY), null);
    assert.equal(
      weightAverageDelta(
        [
          { on: '2026-09-15', value: 80 },
          { on: '2026-09-24', value: 81 },
        ],
        '2026-08-29',
        TODAY,
      ),
      null,
    );
  });
});

describe('circumferenceDelta', () => {
  it('prefers the latest value in the 14 days before the window as baseline', () => {
    const values = [
      { on: '2026-08-10', value: 70 },
      { on: '2026-08-20', value: 90 },
      { on: '2026-09-05', value: 91 },
      { on: '2026-09-22', value: 88.5 },
    ];
    assert.equal(circumferenceDelta(values, '2026-08-29', TODAY), -1.5);
  });

  it('uses the earliest value in the window without an earlier baseline', () => {
    const values = [
      { on: '2026-09-01', value: 100 },
      { on: '2026-09-20', value: 101 },
    ];
    assert.equal(circumferenceDelta(values, '2026-08-29', TODAY), 1);
  });

  it('needs two different days', () => {
    assert.equal(circumferenceDelta([{ on: '2026-09-20', value: 100 }], '2026-08-29', TODAY), null);
    assert.equal(circumferenceDelta([{ on: '2026-08-20', value: 100 }], '2026-08-29', TODAY), null);
  });
});

describe('exerciseGains', () => {
  it('reports gains of the three exercises with the most sets', () => {
    const sessions = [
      {
        loggedOn: '2026-09-10',
        sets: [
          set({ exerciseId: 'push', name: 'Liegestütze', reps: 12 }),
          set({ exerciseId: 'push', name: 'Liegestütze', reps: 14 }),
          set({ exerciseId: 'push', name: 'Liegestütze', reps: 13 }),
          set({ exerciseId: 'plank', name: 'Unterarmstütz', seconds: 60 }),
          set({ exerciseId: 'plank', name: 'Unterarmstütz', seconds: 55 }),
          set({ exerciseId: 'squat', name: 'Kniebeugen', reps: 20 }),
          set({ exerciseId: 'squat', name: 'Kniebeugen', reps: 20 }),
          set({ exerciseId: 'row', name: 'Rudern', reps: 30 }),
        ],
      },
      { loggedOn: '2026-08-01', sets: [set({ exerciseId: 'push', name: 'Liegestütze', reps: 40 })] },
    ];
    const gains = exerciseGains({
      sessions,
      beforeBests: { push: 10, plank: 45, squat: 25, row: 10 },
      startKey: '2026-08-29',
      todayKey: TODAY,
    });
    assert.deepEqual(
      gains.map((gain) => [gain.exerciseId, gain.delta, gain.kind]),
      [
        ['push', 4, 'reps'],
        ['plank', 15, 'time'],
      ],
    );
  });

  it('skips first executions', () => {
    const gains = exerciseGains({
      sessions: [{ loggedOn: '2026-09-10', sets: [set({ exerciseId: 'new', name: 'Dips', reps: 8 })] }],
      beforeBests: {},
      startKey: '2026-08-29',
      todayKey: TODAY,
    });
    assert.deepEqual(gains, []);
  });
});

describe('computeBuildUp', () => {
  it('counts accepted variant_up level-ups inside the window', () => {
    const result = computeBuildUp(
      emptyInput({
        progressionEvents: [
          { kind: 'variant_up', status: 'accepted', day: '2026-09-01' },
          { kind: 'variant_up', status: 'accepted', day: '2026-09-20' },
          { kind: 'variant_up', status: 'declined', day: '2026-09-20' },
          { kind: 'sets_up', status: 'accepted', day: '2026-09-20' },
          { kind: 'variant_up', status: 'accepted', day: '2026-08-28' },
        ],
      }),
    );
    assert.equal(result.levelUps, 2);
    assert.equal(result.weightDeltaKg, null);
  });
});

describe('formatBuildUpSentence', () => {
  const example = summary({
    weightDeltaKg: 0.2,
    waistDeltaCm: -1.4,
    chestDeltaCm: 1.1,
    exerciseGains: [{ exerciseId: 'push', exerciseName: 'Liegestütze', kind: 'reps', delta: 4 }],
  });

  it('builds the German sentence', () => {
    assert.equal(
      formatBuildUpSentence(example, { unitSystem: 'metric', locale: 'de', t: makeT('de') }),
      'Du baust auf: Gewicht stabil, Taille −1,5 cm, Brust +1 cm, Liegestütze +4.',
    );
  });

  it('builds the English sentence in inches and pounds', () => {
    assert.equal(
      formatBuildUpSentence(
        summary({
          weightDeltaKg: 0.9,
          waistDeltaCm: -1.4,
          armDeltaCm: 0.3,
          levelUps: 2,
          exerciseGains: [{ exerciseId: 'plank', exerciseName: 'Plank', kind: 'time', delta: 15 }],
        }),
        { unitSystem: 'imperial', locale: 'en', t: makeT('en') },
      ),
      "You're building up: weight +2 lbs, waist −0.6 in, upper arm steady, +2 levels, Plank +15 s.",
    );
  });

  it('builds the Spanish sentence', () => {
    assert.equal(
      formatBuildUpSentence(
        summary({ weightDeltaKg: -0.34, chestDeltaCm: 2.2, levelUps: 1 }),
        { unitSystem: 'metric', locale: 'es', t: makeT('es') },
      ),
      'Estás ganando: peso −0,3 kg, pecho +2 cm, +1 nivel.',
    );
  });

  it('rounds cm to 0.5 and treats |Δ| < 0.5 cm and < 0.3 kg as stable', () => {
    assert.equal(
      formatBuildUpSentence(
        summary({ weightDeltaKg: -0.29, waistDeltaCm: 0.49, chestDeltaCm: 0.74 }),
        { unitSystem: 'metric', locale: 'de', t: makeT('de') },
      ),
      'Du baust auf: Gewicht stabil, Taille stabil, Brust +0,5 cm.',
    );
  });

  it('shows at most two exercises', () => {
    const sentence = formatBuildUpSentence(
      summary({
        exerciseGains: [
          { exerciseId: 'a', exerciseName: 'A', kind: 'reps', delta: 1 },
          { exerciseId: 'b', exerciseName: 'B', kind: 'reps', delta: 2 },
          { exerciseId: 'c', exerciseName: 'C', kind: 'reps', delta: 3 },
        ],
      }),
      { unitSystem: 'metric', locale: 'de', t: makeT('de') },
    );
    assert.equal(sentence, 'Du baust auf: A +1, B +2.');
  });

  it('is null without any data', () => {
    assert.equal(
      formatBuildUpSentence(summary(), { unitSystem: 'metric', locale: 'de', t: makeT('de') }),
      null,
    );
  });
});

describe('isBuildUpGoal', () => {
  it('matches muscle gain goals', () => {
    assert.equal(isBuildUpGoal('build_muscle'), true);
    assert.equal(isBuildUpGoal('gain_weight'), true);
    assert.equal(isBuildUpGoal('lose_weight'), false);
    assert.equal(isBuildUpGoal(null), false);
  });
});
