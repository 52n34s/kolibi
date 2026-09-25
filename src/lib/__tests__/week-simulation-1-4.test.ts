/**
 * Week simulation for Kolibi 1.4: seven days, Monday 2026-09-28 to Sunday
 * 2026-10-04, on the app's pure functions only. Time is injected everywhere
 * (date keys, `todayKey`, `now`, `today`) — nothing reads the real clock.
 *
 * Profile: goal "Muskelaufbau" (goal_type build_muscle), 4 units a week, the
 * plan from the plan wizard (buildPlan: 4 days, 60 min, bar, assessment
 * 1/1/1) → "Push" and "Pull & Legs".
 *
 * With WEEK_SIM_OUT=<file> the per-check data is written as JSON.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';

import { formatBuildUpSentence, computeBuildUp, isBuildUpGoal } from '../build-up.ts';
import {
  CalorieSource,
  calculateDailyCalorieGoalForSource,
  resolveEffectiveDailyCalorieGoal,
  type BiologicalSex,
} from '../calorie-goal-math.ts';
import { computeReadiness, type DailyCheckin, type ReadinessSession } from '../checkin/readiness.ts';
import { resolveDisplayWeight } from '../display-weight.ts';
import { goalCategoryForGoalType } from '../goal-category.ts';
import { computeMacroGoals } from '../macro-goals.ts';
import { PROTEIN_G_PER_KG_BY_GOAL } from '../macro-rules.ts';
import { groupMeals, mealGroupLabel, sumMealGroupTotals } from '../meal-groups.ts';
import { computeProteinTimingStats, pickProteinTimingHint } from '../meal-protein-timing.ts';
import { formatDistanceKm, formatWeightDeltaForDisplay, formatWeightForDisplay } from '../measure-units-core.ts';
import { computeObservedEnergy } from '../observed-energy.ts';
import {
  buildRecommendations,
  type RecommendationContext,
} from '../recommendations/recommendations.ts';
import {
  buildExerciseSticker,
  buildGoalSticker,
  buildLevelSticker,
  buildMealSticker,
  buildProgressSticker,
  buildRecapSticker,
  buildSessionSticker,
  exerciseMilestone,
  recapWindow,
  type StickerData,
} from '../share/sticker-data.ts';
import { buildSportEnergyDay, type SportEnergyDay } from '../sport-energy-day.ts';
import { SportIntensity, scaleMacrosForSportCalories } from '../sport-macro-scaling.ts';
import {
  calculateTrainingCalories,
  mapTrainingIntensityToSportIntensity,
  type TrainingActivity,
} from '../training-calories.ts';
import { formatQuantity } from '../units.ts';
import { applyProgression } from '../workouts/apply-progression.ts';
import { countMuscleSets, muscleStatus, weeklySetTarget } from '../workouts/muscle-volume.ts';
import { buildPlan, type BuiltPlanExercise } from '../workouts/plan-builder.ts';
import { PLAN_CATALOG } from '../workouts/plan-catalog.ts';
import { withoutSession } from '../workouts/progression-history.ts';
import {
  suggestProgression,
  type ProgressionHistoryUnit,
  type ProgressionSuggestion,
} from '../workouts/progression.ts';
import { bestPriorValue, bestSessionValue, newSessionBest } from '../workouts/session-bests.ts';
import { computeSkillGoalForecast } from '../workouts/skill-goal-forecast.ts';
import type {
  Exercise,
  GymIntensity,
  ProgressionEvent,
  SessionSet,
  WorkoutSession,
} from '../workouts/types.ts';
import type { SaveTemplateExerciseInput } from '../workouts/workouts-api.ts';
import { buildWeekDayMarkersForKeys, trainingCardSessionCount } from '../workouts/week-day-markers.ts';
import { macroChartDomain, macroGoalChangeIndices, macroTrendSummary, isMacroDayInTarget } from '../history-macro-trend.ts';
import { postTrainingNutritionHint } from '../nutrition/post-training-nutrition-hint.ts';
import { reconcileTrainingRows } from '../training-rows.ts';
import { resolveSportKcalForHistory } from '../sport-energy-day.ts';
import { buildCelebration } from '../workouts/celebration.ts';
import {
  DELOAD_RULES,
  isDeloadActive,
  suggestDeload,
  templateForStart,
  type DeloadContext,
} from '../workouts/deload.ts';
import { applySetPrefill, lastSetsByExercise } from '../workouts/set-prefill.ts';
import { buildActiveSessionFromTemplate, completeCurrentSet, adjustCurrent, addSet } from '../workouts/session-logic.ts';
import type { WorkoutTemplate } from '../workouts/types.ts';


// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'] as const;
const [MON, TUE, WED, THU, FRI, SAT, SUN] = DAYS;
const NEXT_MON = '2026-10-05';

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** Local wall-clock time on a date key, as ISO (what the app stores). */
function at(key: string, hour: number, minute = 0): string {
  const { y, m, d } = parseKey(key);
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

function localDate(key: string, hour = 12): Date {
  const { y, m, d } = parseKey(key);
  return new Date(y, m - 1, d, hour, 0);
}

function localKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftKey(key: string, days: number): string {
  const { y, m, d } = parseKey(key);
  return localKey(new Date(y, m - 1, d + days));
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const PROFILE = {
  biologicalSex: 'male' as BiologicalSex,
  birthDate: new Date(1996, 0, 15),
  birthDateKey: '1996-01-15',
  heightCm: 180,
  weightKg: 80,
  targetWeightKg: 82,
  activityLevel: 'lightly_active' as const,
  goalType: 'build_muscle' as const,
  diet: 'omnivore',
  sessionsPerWeek: 4,
};

// ---------------------------------------------------------------------------
// Plan and catalog
// ---------------------------------------------------------------------------

const PLAN = buildPlan({
  goal: 'muscle',
  days: 4,
  minutes: 60,
  equipment: ['bar'],
  assessment: { push: 1, pull: 1, legs: 1 },
  focus: 'balanced',
  cardio: 'none',
  scope: 'full',
});

/** Catalog row as the migrations seed it, from the plan-wizard snapshot. */
const CATALOG: Exercise[] = PLAN_CATALOG.map((entry) => ({
  id: entry.slug,
  userId: null,
  catalogSlug: entry.slug,
  names: { ...entry.names },
  kind: entry.kind,
  perSide: entry.perSide,
  defaultSets: 3,
  defaultReps: entry.kind === 'time' ? null : entry.rangeMin,
  defaultRepsMax: entry.kind === 'time' ? null : entry.rangeMax,
  defaultSeconds: entry.kind === 'time' ? entry.rangeMin : null,
  defaultSecondsMax: entry.kind === 'time' ? entry.rangeMax : null,
  defaultRestSeconds: entry.defaultRestSeconds,
  imageAsset: entry.slug,
  imagePath: null,
  note: null,
  archivedAt: null,
  ladderKey: entry.ladderKey,
  ladderStep: entry.ladderStep,
  progressionKind: 'variant',
  timeCapSeconds: entry.kind === 'time' ? 60 : null,
}));
const byId = new Map(CATALOG.map((row) => [row.id, row]));
const cat = (id: string): Exercise => {
  const row = byId.get(id);
  assert.ok(row, `catalog has ${id}`);
  return row;
};
const ladderOf = (exercise: Exercise) => CATALOG.filter((c) => c.ladderKey != null && c.ladderKey === exercise.ladderKey);

type UnitKey = 'push' | 'pull_legs';
const UNIT_META: Record<UnitKey, { name: string; shortLabel: string; weekdays: number[] }> = {
  push: { name: 'Push', shortLabel: 'P', weekdays: [1, 4] },
  pull_legs: { name: 'Pull & Legs', shortLabel: 'PL', weekdays: [2, 5] },
};

function planSession(kind: UnitKey): BuiltPlanExercise[] {
  const session = PLAN.sessions.find((s) => s.kind === kind);
  assert.ok(session, `plan has ${kind}`);
  return session.exercises;
}

/** Template rows as the plan is saved (apply-built-plan), changed by accepted progressions. */
const templates: Record<UnitKey, SaveTemplateExerciseInput[]> = {
  push: toTemplate(planSession('push')),
  pull_legs: toTemplate(planSession('pull_legs')),
};

function toTemplate(rows: BuiltPlanExercise[]): SaveTemplateExerciseInput[] {
  return rows.map((row, position) => ({
    exerciseId: row.slug,
    position,
    targetSets: row.sets,
    targetReps: row.kind === 'time' ? null : row.targetMin,
    targetRepsMax: row.kind === 'time' ? null : row.targetMax,
    targetSeconds: row.kind === 'time' ? row.targetMin : null,
    targetSecondsMax: row.kind === 'time' ? row.targetMax : null,
    targetWeightKg: null,
    restSeconds: row.restSeconds,
  })) as SaveTemplateExerciseInput[];
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

type Perf = { values: number[]; rir?: (number | null)[] };

type DayPlan = {
  unit: UnitKey | null;
  intensity: GymIntensity;
  durationMinutes: number;
  /** Per exercise slug. */
  perf: Record<string, Perf>;
  /** Everyday Active Energy from Health (kcal), Kolibi workouts not in it. */
  activeEnergyKcal: number;
  /** A strength workout the watch recorded (inside activeEnergyKcal). */
  watchStrengthKcal?: number;
  /** Unlinked training_sessions row (manual run). */
  manualRunMinutes?: number;
  proteinG: number;
  weightKg?: number;
  checkin?: { sleep: number; energy: number; soreness: number; stress: number };
};

const WEEK: Record<string, DayPlan> = {
  [MON]: {
    unit: 'push',
    intensity: 'normal',
    durationMinutes: 50,
    perf: {
      incline_push_up: { values: [12, 11, 10], rir: [1, 1, 0] },
      elevated_hands_pike_push_up: { values: [8, 7, 7] },
      bench_dip: { values: [10, 9, 9] },
      wall_push_up: { values: [20, 20, 20], rir: [3, 3, 2] },
      bench_dip_bent_knees: { values: [15, 15, 15] },
      tuck_hollow_hold: { values: [30, 28, 25] },
    },
    activeEnergyKcal: 380,
    proteinG: 150,
    weightKg: 80.0,
  },
  [TUE]: {
    unit: 'pull_legs',
    intensity: 'normal',
    durationMinutes: 55,
    perf: {
      negative_pull_up: { values: [5, 5, 4], rir: [0, 0, 0] },
      bodyweight_squat: { values: [20, 18, 16] },
      inverted_row: { values: [12, 12, 12], rir: [1, 1, 0] },
      glute_bridge: { values: [20, 20, 18] },
      ytw_raise: { values: [10, 10, 9] },
      hanging_knee_raise: { values: [10, 9, 8] },
    },
    activeEnergyKcal: 420,
    proteinG: 140,
    checkin: { sleep: 4, energy: 4, soreness: 2, stress: 2 },
  },
  [WED]: { unit: null, intensity: 'normal', durationMinutes: 0, perf: {}, activeEnergyKcal: 300, proteinG: 90, weightKg: 80.2 },
  [THU]: {
    unit: 'push',
    intensity: 'hard',
    durationMinutes: 50,
    perf: {
      incline_push_up: { values: [15, 15, 15], rir: [2, 1, 0] },
      elevated_hands_pike_push_up: { values: [9, 8, 8] },
      bench_dip: { values: [12, 12, 12], rir: [0, 0, 0] },
      wall_push_up: { values: [20, 20, 20] },
      bench_dip_bent_knees: { values: [15, 15, 15] },
      tuck_hollow_hold: { values: [40, 40, 40] },
    },
    activeEnergyKcal: 400,
    proteinG: 95,
    checkin: { sleep: 3, energy: 3, soreness: 3, stress: 3 },
  },
  [FRI]: {
    unit: 'pull_legs',
    intensity: 'hard',
    durationMinutes: 55,
    perf: {
      negative_pull_up: { values: [6, 6, 6], rir: [0, 0, 0] },
      bodyweight_squat: { values: [20, 20, 20] },
      inverted_row: { values: [12, 12, 12], rir: [0, 0, 0] },
      glute_bridge: { values: [20, 20, 20] },
      ytw_raise: { values: [10, 10, 10] },
      hanging_knee_raise: { values: [11, 10, 10] },
    },
    activeEnergyKcal: 650,
    watchStrengthKcal: 280,
    proteinG: 150,
    weightKg: 80.4,
    checkin: { sleep: 1, energy: 3, soreness: 4, stress: 2 },
  },
  [SAT]: { unit: null, intensity: 'normal', durationMinutes: 0, perf: {}, activeEnergyKcal: 350, manualRunMinutes: 30, proteinG: 145 },
  [SUN]: { unit: null, intensity: 'normal', durationMinutes: 0, perf: {}, activeEnergyKcal: 250, proteinG: 150, weightKg: 80.3 },
};

type SimSession = {
  dateKey: string;
  unit: UnitKey;
  intensity: GymIntensity;
  workout: WorkoutSession;
  trainingSessionId: string;
};

type TrainingRow = { id: string; loggedOn: string; activity: TrainingActivity; intensity: GymIntensity; kcal: number };

const sessions: SimSession[] = [];
const trainingRows: TrainingRow[] = [];
const events: ProgressionEvent[] = [];
const suggestionsByDay: Record<string, ProgressionSuggestion[]> = {};
/** Same history with every rir removed: the rules before reps in reserve. */
const suggestionsWithoutRir: Record<string, ProgressionSuggestion[]> = {};

function setsFor(sessionId: string, dateKey: string, row: SaveTemplateExerciseInput, position: number, perf: Perf): SessionSet[] {
  const exercise = cat(row.exerciseId);
  return perf.values.map((value, index) => ({
    id: `${sessionId}-${position}-${index}`,
    sessionId,
    userId: 'sim-user',
    exerciseId: row.exerciseId,
    exerciseName: exercise.names.de!,
    exercisePosition: position,
    setIndex: index,
    kind: exercise.kind,
    perSide: exercise.perSide,
    targetReps: row.targetReps,
    targetRepsMax: row.targetRepsMax,
    targetSeconds: row.targetSeconds,
    targetSecondsMax: row.targetSecondsMax,
    targetWeightKg: null,
    reps: exercise.kind === 'time' ? null : value,
    seconds: exercise.kind === 'time' ? value : null,
    secondsOtherSide: null,
    weightKg: null,
    completedAt: at(dateKey, 18, position * 7 + index * 2),
    rir: perf.rir?.[index] ?? null,
  }));
}

function unitFromSets(sessionId: string, intensity: GymIntensity, sets: SessionSet[], dropRir = false): ProgressionHistoryUnit {
  return {
    sessionId,
    intensity,
    sets: sets.map((set) => ({
      reps: set.reps,
      seconds: set.seconds,
      secondsOtherSide: set.secondsOtherSide,
      targetReps: set.targetReps,
      targetRepsMax: set.targetRepsMax,
      targetSeconds: set.targetSeconds,
      targetSecondsMax: set.targetSecondsMax,
      done: true,
      rir: dropRir ? null : (set.rir ?? null),
    })),
  };
}

/** Summary suggestions for one exercise: this unit first, then earlier ones (newest first). */
function suggestFor(
  row: SaveTemplateExerciseInput,
  template: SaveTemplateExerciseInput[],
  current: SimSession,
  earlier: SimSession[],
  dropRir: boolean,
): ProgressionSuggestion | null {
  const exercise = cat(row.exerciseId);
  const unitOf = (s: SimSession) =>
    unitFromSets(s.workout.id, s.intensity, s.workout.sets.filter((set) => set.exerciseId === row.exerciseId), dropRir);
  const history = [current, ...earlier.slice().reverse()]
    .map(unitOf)
    .filter((u) => u.sets.length > 0);
  return suggestProgression({
    exercise,
    ladder: ladderOf(exercise),
    currentTarget: {
      targetSets: row.targetSets,
      targetReps: row.targetReps,
      targetRepsMax: row.targetRepsMax,
      targetSeconds: row.targetSeconds,
      targetSecondsMax: row.targetSecondsMax,
    },
    history,
    templateExerciseIds: template.map((t) => t.exerciseId),
    lastEvents: events.filter((ev) => ev.fromExerciseId === row.exerciseId),
  });
}

/** variant_up the user accepts on the summary (Thursday push-ups, Friday rows). */
const ACCEPT: Record<string, string[]> = {
  [THU]: ['incline_push_up'],
  [FRI]: ['inverted_row'],
};

function playWeek() {
  if (sessions.length > 0) {
    return;
  }
  for (const dateKey of DAYS) {
    const day = WEEK[dateKey]!;
    if (day.unit) {
      const template = templates[day.unit];
      const sessionId = `ws-${dateKey}`;
      const trainingSessionId = `ts-${dateKey}`;
      const sets = template.flatMap((row, position) => {
        const perf = day.perf[row.exerciseId];
        assert.ok(perf, `${dateKey}: values for ${row.exerciseId}`);
        return setsFor(sessionId, dateKey, row, position, perf);
      });
      const startedAt = at(dateKey, 18, 0);
      const workout: WorkoutSession = {
        id: sessionId,
        userId: 'sim-user',
        templateId: day.unit,
        templateName: UNIT_META[day.unit].name,
        shortLabel: UNIT_META[day.unit].shortLabel,
        colorKey: day.unit === 'push' ? 'indigo' : 'violet',
        loggedOn: dateKey,
        startedAt,
        finishedAt: new Date(Date.parse(startedAt) + day.durationMinutes * 60_000).toISOString(),
        intensity: day.intensity,
        trainingSessionId,
        createdAt: startedAt,
        sets,
      };
      const current: SimSession = { dateKey, unit: day.unit, intensity: day.intensity, workout, trainingSessionId };
      const earlier = sessions.filter((s) => s.unit === day.unit);
      suggestionsByDay[dateKey] = template
        .map((row) => suggestFor(row, template, current, earlier, false))
        .filter((s): s is ProgressionSuggestion => s != null);
      suggestionsWithoutRir[dateKey] = template
        .map((row) => suggestFor(row, template, current, earlier, true))
        .filter((s): s is ProgressionSuggestion => s != null);

      for (const exerciseId of ACCEPT[dateKey] ?? []) {
        const suggestion = suggestionsByDay[dateKey]!.find((s) => s.exerciseId === exerciseId && s.kind === 'variant_up');
        assert.ok(suggestion, `${dateKey}: variant_up for ${exerciseId}`);
        templates[day.unit] = applyProgression(templates[day.unit], suggestion);
        events.push({
          id: `ev-${dateKey}-${exerciseId}`,
          userId: 'sim-user',
          templateId: day.unit,
          sessionId,
          kind: 'variant_up',
          fromExerciseId: suggestion.exerciseId,
          toExerciseId: suggestion.toExerciseId,
          fromTarget: suggestion.fromTarget,
          toTarget: suggestion.toTarget,
          status: 'accepted',
          createdAt: at(dateKey, 19, 30),
        });
      }

      sessions.push(current);
      trainingRows.push({
        id: trainingSessionId,
        loggedOn: dateKey,
        activity: 'strength',
        intensity: day.intensity,
        kcal: calculateTrainingCalories({
          activity: 'strength',
          weightKg: PROFILE.weightKg,
          durationMinutes: day.durationMinutes,
          intensity: day.intensity,
        }),
      });
    }
    if (day.manualRunMinutes) {
      trainingRows.push({
        id: `ts-run-${dateKey}`,
        loggedOn: dateKey,
        activity: 'other',
        intensity: 'normal',
        kcal: calculateTrainingCalories({ activity: 'other', weightKg: PROFILE.weightKg, durationMinutes: day.manualRunMinutes, intensity: 'normal' }),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

function baseGoal(calorieSource: CalorieSource, todayKey: string, activeEnergyBurnedKcal = 0) {
  return calculateDailyCalorieGoalForSource({
    biologicalSex: PROFILE.biologicalSex,
    birthDate: PROFILE.birthDate,
    heightCm: PROFILE.heightCm,
    weightKg: PROFILE.weightKg,
    activityLevel: PROFILE.activityLevel,
    calorieSource,
    goalType: PROFILE.goalType,
    activeEnergyBurnedKcal,
    today: localDate(todayKey),
  });
}

function baseMacros(dailyCalorieGoal: number) {
  return computeMacroGoals({
    dailyCalorieGoal,
    weightKg: PROFILE.weightKg,
    heightCm: PROFILE.heightCm,
    targetWeightKg: PROFILE.targetWeightKg,
    goalType: PROFILE.goalType,
    dietPreference: PROFILE.diet,
    birthDate: PROFILE.birthDateKey,
  });
}

function sportDayFor(dateKey: string): SportEnergyDay {
  const day = WEEK[dateKey]!;
  const rows = trainingRows.filter((t) => t.loggedOn === dateKey);
  const unit = sessions.find((s) => s.dateKey === dateKey);
  return buildSportEnergyDay({
    activeEnergyKcal: day.activeEnergyKcal,
    workouts: day.watchStrengthKcal
      ? [{ activityType: 50, kcal: day.watchStrengthKcal, intensity: SportIntensity.HIGH, label: 'Krafttraining' }]
      : [],
    trainingSessions: rows.map((t) => ({
      activity: t.activity,
      kcal: t.kcal,
      intensity: mapTrainingIntensityToSportIntensity(t.intensity),
      label: unit && t.id === unit.trainingSessionId ? UNIT_META[unit.unit].name : t.activity,
      ...(unit && t.id === unit.trainingSessionId ? { shortLabel: UNIT_META[unit.unit].shortLabel } : {}),
    })),
    sessionsPerWeek: PROFILE.sessionsPerWeek,
    baselineLabel: 'Alltagsbewegung',
  });
}

/** The day's targets as Today shows them with Apple Health connected. */
function healthDay(dateKey: string) {
  const base = baseGoal(CalorieSource.HEALTH, dateKey);
  const macros = baseMacros(base.baseDailyGoal);
  const sportDay = sportDayFor(dateKey);
  const calorieGoal = resolveEffectiveDailyCalorieGoal({
    calorieSource: CalorieSource.HEALTH,
    baseDailyGoal: base.baseDailyGoal,
    activeEnergyBurnedKcal: sportDay.totalActiveKcal,
    bmr: base.bmr,
  });
  const scaled = scaleMacrosForSportCalories({
    basisKcal: base.baseDailyGoal,
    segments: sportDay.segments,
    proteinG: macros.proteinG!,
    fatBasisG: macros.fatG!,
    carbsBasisG: macros.carbsG!,
    weightKg: PROFILE.weightKg,
  });
  assert.equal(scaled.ok, true, `${dateKey}: macros scale`);
  if (!scaled.ok) {
    throw new Error('unreachable');
  }
  return {
    dateKey,
    base: base.baseDailyGoal,
    bmr: base.bmr,
    calorieGoal,
    totalActiveKcal: sportDay.totalActiveKcal,
    trainingKcal: trainingRows.filter((t) => t.loggedOn === dateKey).reduce((sum, t) => sum + t.kcal, 0),
    proteinG: scaled.proteinG,
    carbsG: scaled.carbsG,
    fatG: scaled.fatG,
    macroKcal: scaled.totalKcal,
    sportDay,
  };
}

// ---------------------------------------------------------------------------
// Output and helpers
// ---------------------------------------------------------------------------

const out: Record<string, unknown> = {};
after(() => {
  const file = process.env.WEEK_SIM_OUT;
  if (file) {
    writeFileSync(file, JSON.stringify(out, null, 2));
  }
});

type Locale = Record<string, unknown>;
const locales: Record<'de' | 'en', Locale> = {
  de: JSON.parse(readFileSync(new URL('../../i18n/locales/de.json', import.meta.url), 'utf8')) as Locale,
  en: JSON.parse(readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8')) as Locale,
};

/** Minimal i18next stand-in: nested keys, {{var}}, _one / _other by count. */
function translator(lang: 'de' | 'en') {
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locales[lang]);
  return (key: string, options?: Record<string, unknown>): string => {
    let template = lookup(key);
    if (template === undefined && options && typeof options.count === 'number') {
      template = lookup(`${key}_${options.count === 1 ? 'one' : 'other'}`);
    }
    assert.equal(typeof template, 'string', `missing i18n key ${lang}:${key}`);
    return (template as string).replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(options?.[name] ?? ''));
  };
}

const SENSITIVE_KEYS = /weight|kg|waist|chest|arm|bodyfat|body_fat|height|bmi|bmr|tdee|calorie|goalkcal|maintenance/i;

/** Every key and number in a sticker: no body data, no load, no calorie or macro targets. */
function assertStickerClean(label: string, data: StickerData, forbiddenNumbers: readonly number[]) {
  const json = JSON.stringify(data);
  const keys: string[] = [];
  const numbers: number[] = [];
  JSON.parse(json, (key, value: unknown) => {
    if (key) {
      keys.push(key);
    }
    if (typeof value === 'number') {
      numbers.push(value);
    }
    return value;
  });
  for (const key of keys) {
    assert.equal(SENSITIVE_KEYS.test(key), false, `${label}: key "${key}" in ${json}`);
  }
  for (const n of forbiddenNumbers) {
    assert.equal(numbers.includes(n), false, `${label}: carries ${n} (${json})`);
  }
  assert.doesNotMatch(json, /\bkg\b|\blbs?\b|Gewicht|Taille|Brust|Oberarm/i, `${label}: ${json}`);
}

function readinessSessions(): ReadinessSession[] {
  return sessions.map((s) => ({
    id: s.workout.id,
    loggedOn: s.dateKey,
    startedAt: s.workout.startedAt,
    finishedAt: s.workout.finishedAt,
    intensity: s.intensity,
    sets: s.workout.sets.map((set) => ({
      exerciseId: set.exerciseId,
      kind: set.kind,
      perSide: set.perSide,
      reps: set.reps,
      seconds: set.seconds,
      secondsOtherSide: set.secondsOtherSide,
      weightKg: set.weightKg,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('week simulation 1.4 (build_muscle, 4 units, Push + Pull & Legs)', () => {
  it('0 plan from the wizard: Push and Pull & Legs, 6 exercises each, within 60 min', () => {
    out.plan = PLAN.sessions.map((s) => ({ kind: s.kind, minutes: s.estimatedMinutes, exercises: s.exercises.map((e) => `${e.slug} ${e.sets}×${e.targetMin}–${e.targetMax}`) }));
    assert.equal(PLAN.sessionsPerWeek, 4);
    assert.deepEqual(PLAN.sessions.map((s) => s.kind), ['push', 'pull_legs']);
    for (const session of PLAN.sessions) {
      assert.equal(session.exercises.length, 6);
      assert.ok(session.estimatedMinutes <= 60);
      for (const exercise of session.exercises) {
        assert.ok(byId.has(exercise.slug), exercise.slug);
      }
    }
    // Assessment 1 starts pushing on incline push-ups and pulling on negatives.
    assert.equal(planSession('push')[0]!.slug, 'incline_push_up');
    assert.equal(planSession('pull_legs')[0]!.slug, 'negative_pull_up');
    assert.deepEqual(PLAN.notes, []);
    assert.equal(goalCategoryForGoalType(PROFILE.goalType), 'muscle');
    assert.equal(weeklySetTarget(PROFILE.goalType), 10);
    assert.equal(isBuildUpGoal(PROFILE.goalType), true);
  });

  it('1a calorie and macro targets per day with Health: training above rest, protein fixed, sums match', () => {
    playWeek();
    const rows = DAYS.map((d) => healthDay(d));
    out.goalsHealth = rows.map(({ sportDay: _s, ...r }) => r);

    const base = baseGoal(CalorieSource.HEALTH, MON);
    // build_muscle is recomposition: no surplus on top of maintenance.
    assert.equal(base.baseDailyGoal, base.maintenanceCalories);
    // Protein 1.8 g/kg (reference weight, omnivore), the same every day.
    const macros = baseMacros(base.baseDailyGoal);
    assert.equal(macros.proteinPerKg, PROTEIN_G_PER_KG_BY_GOAL.build_muscle);
    assert.equal(new Set(rows.map((r) => r.proteinG)).size, 1);
    // Base macros add up to the base goal (± rounding).
    assert.ok(Math.abs(macros.proteinG! * 4 + macros.fatG! * 9 + macros.carbsG! * 4 - base.baseDailyGoal) <= 6);

    for (const r of rows) {
      // Shown calories = macro kcal target (no floor needed on these days).
      assert.equal(r.calorieGoal, r.base + r.totalActiveKcal, r.dateKey);
      assert.equal(r.macroKcal, r.calorieGoal, `${r.dateKey}: macro kcal = calorie goal`);
      assert.ok(Math.abs(r.proteinG * 4 + r.fatG * 9 + r.carbsG * 4 - r.calorieGoal) <= 2, r.dateKey);
    }
    const byDay = Object.fromEntries(rows.map((r) => [r.dateKey, r]));
    // Kolibi-only units (Mon, Tue, Thu) lift the target over the rest day with similar movement.
    for (const d of [MON, TUE, THU]) {
      assert.ok(byDay[d]!.calorieGoal > byDay[WED]!.calorieGoal + byDay[d]!.trainingKcal - 1, d);
      assert.ok(byDay[d]!.carbsG > byDay[WED]!.carbsG, `${d} carbs above the rest day`);
    }
    // "hart" puts a larger share of the extra energy into carbs than "normal".
    const carbShare = (d: string) => {
      const r = byDay[d]!;
      const seg = r.sportDay.breakdown.find((b) => b.kind === 'training_session' && b.counted)!;
      return seg.intensity;
    };
    assert.equal(carbShare(MON), SportIntensity.MODERATE);
    assert.equal(carbShare(THU), SportIntensity.HIGH);
    const perExtraKcal = (d: string) => (byDay[d]!.carbsG - byDay[WED]!.carbsG) / (byDay[d]!.calorieGoal - byDay[WED]!.calorieGoal);
    assert.ok(perExtraKcal(THU) > perExtraKcal(MON), `hard ${perExtraKcal(THU)} vs normal ${perExtraKcal(MON)}`);
  });

  it('1b energy without double counting: totalActiveKcal identical with and without breakdown', () => {
    playWeek();
    const perDay = DAYS.map((d) => {
      const day = WEEK[d]!;
      const sportDay = sportDayFor(d);
      const counted = sportDay.breakdown.filter((b) => b.counted).reduce((sum, b) => sum + b.kcal, 0);
      const segments = sportDay.segments.reduce((sum, s) => sum + s.kcal, 0);
      // Pre-breakdown formula: Active Energy + training rows the watch did not record.
      const watchHasStrength = Boolean(day.watchStrengthKcal);
      const legacy =
        day.activeEnergyKcal +
        trainingRows
          .filter((t) => t.loggedOn === d && !(t.activity === 'strength' && watchHasStrength))
          .reduce((sum, t) => sum + t.kcal, 0);
      return { d, total: sportDay.totalActiveKcal, counted, segments, legacy, suppressed: sportDay.breakdown.filter((b) => !b.counted).length };
    });
    out.energy = perDay;
    for (const row of perDay) {
      assert.equal(row.total, row.legacy, `${row.d}: same as the formula before the breakdown`);
      assert.equal(row.total, row.counted, `${row.d}: breakdown adds up`);
      assert.equal(row.total, row.segments, `${row.d}: macro segments add up`);
    }
    // Friday: the watch recorded the strength unit — the Kolibi row is shown, not counted.
    const fri = perDay.find((r) => r.d === FRI)!;
    assert.equal(fri.total, WEEK[FRI]!.activeEnergyKcal);
    assert.equal(fri.suppressed, 1);
    // Saturday: unlinked run counted once.
    const sat = perDay.find((r) => r.d === SAT)!;
    assert.equal(sat.total - WEEK[SAT]!.activeEnergyKcal, trainingRows.find((t) => t.id === `ts-run-${SAT}`)!.kcal);
  });

  it('1c without Health / observed: the goal ignores active energy and training (no double counting)', () => {
    playWeek();
    const goals = DAYS.map((d) => baseGoal(CalorieSource.ACTIVITY_FACTOR, d, sportDayFor(d).totalActiveKcal));
    out.goalsActivityFactor = goals.map((g) => g.effectiveDailyGoal);
    assert.equal(new Set(goals.map((g) => g.effectiveDailyGoal)).size, 1);
    assert.equal(goals[0]!.effectiveDailyGoal, goals[0]!.maintenanceCalories);
    // Macros on Today without Health: sportKcal 0 → the stored base comes back.
    const macros = baseMacros(goals[0]!.baseDailyGoal);
    const scaled = scaleMacrosForSportCalories({
      basisKcal: goals[0]!.baseDailyGoal,
      sportKcal: 0,
      proteinG: macros.proteinG!,
      fatBasisG: macros.fatG!,
      carbsBasisG: macros.carbsG!,
      weightKg: PROFILE.weightKg,
    });
    assert.deepEqual(scaled.ok && [scaled.proteinG, scaled.fatG, scaled.carbsG], [macros.proteinG, macros.fatG, macros.carbsG]);
    // Observed source never adds active energy on top.
    assert.equal(
      resolveEffectiveDailyCalorieGoal({ calorieSource: CalorieSource.OBSERVED, baseDailyGoal: 2600, activeEnergyBurnedKcal: 700, bmr: 1800 }),
      2600,
    );
    // One week of logging is far from an observed expenditure.
    const observed = computeObservedEnergy({
      meals: DAYS.flatMap((d) => [
        { dateKey: d, totalKcal: 900, proteinG: 50 },
        { dateKey: d, totalKcal: 1100, proteinG: 60 },
      ]),
      weights: DAYS.filter((d) => WEEK[d]!.weightKg).map((d) => ({ weightKg: WEEK[d]!.weightKg!, loggedAt: at(d, 7) })),
      estimatedMaintenanceKcal: goals[0]!.maintenanceCalories,
      bmrKcal: goals[0]!.bmr,
      today: localDate(NEXT_MON),
    });
    assert.deepEqual(observed, { status: 'insufficient', eligibleDays: 7, reason: 'eligible_days' });
  });

  it('1e edge: Active Energy below the watch workouts (sync lag) — breakdown and total part ways', () => {
    // Actual behaviour, documented: totalActiveKcal keeps the pre-breakdown formula (AE + training),
    // the breakdown counts the workout in full. Macro segments then cover 100 kcal more than the goal.
    const day = buildSportEnergyDay({
      activeEnergyKcal: 200,
      workouts: [{ activityType: 37, kcal: 300, intensity: SportIntensity.MODERATE, label: 'Laufen' }],
      trainingSessions: [],
      sessionsPerWeek: 4,
      baselineLabel: 'Alltagsbewegung',
    });
    const counted = day.breakdown.filter((b) => b.counted).reduce((sum, b) => sum + b.kcal, 0);
    out.energyEdge = { total: day.totalActiveKcal, counted };
    assert.equal(day.totalActiveKcal, 200);
    assert.equal(counted, 300);
  });

  it(
    '1d expectation differs: History rebuilds a training day goal from Active Energy only',
    {
      skip:
        'Actual behaviour (history.ts:300): scaledGoal uses daily_health_stats.active_energy_kcal as sportKcal; ' +
        'Kolibi units without a watch workout are missing there, so a past training day shows a lower goal than Today showed.',
    },
    () => {
      playWeek();
      const mon = healthDay(MON);
      const historyGoal = mon.base + WEEK[MON]!.activeEnergyKcal;
      assert.equal(historyGoal, mon.calorieGoal);
    },
  );

  it('2 progression with reps in reserve and "hart"', () => {
    playWeek();
    const show = (list: ProgressionSuggestion[] | undefined) =>
      (list ?? []).map((s) => `${s.exerciseId}:${s.kind}${s.toExerciseId ? `→${s.toExerciseId}` : ''}`).sort();
    out.suggestions = Object.fromEntries(Object.keys(suggestionsByDay).map((d) => [d, show(suggestionsByDay[d])]));
    out.suggestionsWithoutRir = Object.fromEntries(Object.keys(suggestionsWithoutRir).map((d) => [d, show(suggestionsWithoutRir[d])]));
    const find = (d: string, id: string, list = suggestionsByDay) => (list[d] ?? []).find((s) => s.exerciseId === id) ?? null;

    // Tuesday "normal", rows 3 × 12 at the top: level-up offered (the user leaves it for later).
    assert.equal(find(TUE, 'inverted_row')?.kind, 'variant_up');

    // Monday: wall push-ups at the top — the next rung is already in the unit, so +1 set.
    assert.equal(find(MON, 'wall_push_up')?.kind, 'sets_up');
    assert.equal(find(MON, 'incline_push_up'), null);

    // Thursday "hart", incline push-ups 3 × 15 with rir 2 on the first set: level-up now.
    const incline = find(THU, 'incline_push_up');
    assert.equal(incline?.kind, 'variant_up');
    assert.equal(incline?.toExerciseId, 'push_up');
    // Without the rir the old rule holds: "hart" needs a second successful unit.
    assert.equal(find(THU, 'incline_push_up', suggestionsWithoutRir), null);
    // Bench dips 3 × 12 "hart" with rir 0 everywhere: old rule, Monday was no success → nothing.
    assert.equal(find(THU, 'bench_dip'), null);
    // Holds at 40 s "hart" without rir and Monday short of 40 s → nothing.
    assert.equal(find(THU, 'tuck_hollow_hold'), null);

    // Friday "hart", rows 3 × 12 with rir 0: Tuesday was a success too → level-up (old rule).
    const rows = find(FRI, 'inverted_row');
    assert.equal(rows?.kind, 'variant_up');
    assert.equal(rows?.toExerciseId, 'feet_elevated_inverted_row');
    // Negatives 3 × 6 "hart", rir 0, Tuesday 5 · 5 · 4 → wait for a second success.
    assert.equal(find(FRI, 'negative_pull_up'), null);

    // Accepted level-ups changed the plan to the next rung with its own targets.
    const push = templates.push.find((t) => t.position === 0)!;
    assert.deepEqual([push.exerciseId, push.targetSets, push.targetReps, push.targetRepsMax], ['push_up', 3, 8, 15]);
    const row = templates.pull_legs.find((t) => t.exerciseId === 'feet_elevated_inverted_row');
    assert.deepEqual([row?.targetReps, row?.targetRepsMax], [8, 12]);
  });

  it('2b rir rules in isolation: rir ≥ 2 on "hart" is enough, rir 0 and missing rir keep the old rule', () => {
    const exercise = cat('negative_pull_up');
    const target = { targetSets: 3, targetReps: 3, targetRepsMax: 6, targetSeconds: null, targetSecondsMax: null };
    const unit = (id: string, intensity: GymIntensity, values: number[], rir: (number | null)[]): ProgressionHistoryUnit => ({
      sessionId: id,
      intensity,
      sets: values.map((reps, i) => ({ reps, seconds: null, secondsOtherSide: null, targetReps: 3, targetRepsMax: 6, targetSeconds: null, targetSecondsMax: null, done: true, rir: rir[i] ?? null })),
    });
    const run = (history: ProgressionHistoryUnit[]) =>
      suggestProgression({ exercise, ladder: ladderOf(exercise), currentTarget: target, history, templateExerciseIds: ['negative_pull_up'], lastEvents: [] })?.kind ?? null;
    const results = {
      hardRir2: run([unit('a', 'hard', [6, 6, 6], [2, 0, 0])]),
      hardRir3: run([unit('a', 'hard', [6, 6, 6], [3, 3, 3])]),
      hardRir1: run([unit('a', 'hard', [6, 6, 6], [1, 1, 1])]),
      hardRir0: run([unit('a', 'hard', [6, 6, 6], [0, 0, 0])]),
      hardNoRir: run([unit('a', 'hard', [6, 6, 6], [])]),
      hardRir0TwoSuccesses: run([unit('b', 'hard', [6, 6, 6], [0, 0, 0]), unit('a', 'normal', [6, 6, 6], [])]),
      normalRir0: run([unit('a', 'normal', [6, 6, 6], [0, 0, 0])]),
      hardRir2BelowTop: run([unit('a', 'hard', [6, 6, 5], [3, 3, 3])]),
    };
    out.rirRules = results;
    assert.deepEqual(results, {
      hardRir2: 'variant_up',
      hardRir3: 'variant_up',
      hardRir1: null,
      hardRir0: null,
      hardNoRir: null,
      hardRir0TwoSuccesses: 'variant_up',
      normalRir0: 'variant_up',
      // Reserve never replaces reaching the upper bound.
      hardRir2BelowTop: null,
    });
  });

  it('3 bests and "Zum ersten Mal" per unit (history holds the unit itself → withoutSession)', () => {
    playWeek();
    const all = sessions.flatMap((s) => s.workout.sets);
    const perUnit = sessions.map((s) => {
      // History fetched on the summary: every synced set, this unit included.
      const history = all.filter((set) => set.completedAt <= s.workout.finishedAt!);
      const exerciseIds = [...new Set(s.workout.sets.map((set) => set.exerciseId!))];
      return {
        d: s.dateKey,
        marks: Object.fromEntries(
          exerciseIds.map((id) => {
            const own = s.workout.sets.filter((set) => set.exerciseId === id);
            const kind = own[0]!.kind;
            const values = own.map((set) => (kind === 'time' ? set.seconds! : set.reps!));
            const exHistory = history.filter((set) => set.exerciseId === id);
            const milestone = exerciseMilestone({
              sessionBest: bestSessionValue(values),
              priorBest: bestPriorValue(withoutSession(exHistory, s.workout.id), kind),
              historyLoaded: true,
            });
            const naive = exerciseMilestone({ sessionBest: bestSessionValue(values), priorBest: bestPriorValue(exHistory, kind), historyLoaded: true });
            const best = newSessionBest({ values, history: exHistory, kind, sessionId: s.workout.id });
            return [id, { milestone, naive, best }];
          }),
        ),
      };
    });
    out.milestones = perUnit;
    const mon = perUnit[0]!.marks;
    assert.ok(Object.values(mon).every((m) => m.milestone === 'firstTime' && m.best === null), 'Monday: all first time, no best');
    // Without withoutSession the unit would compare with itself: no badge at all.
    assert.ok(Object.values(mon).every((m) => m.naive === null));
    const thu = perUnit[2]!.marks;
    assert.deepEqual(
      Object.fromEntries(Object.entries(thu).map(([id, m]) => [id, m.milestone])),
      {
        incline_push_up: 'newBest',
        elevated_hands_pike_push_up: 'newBest',
        bench_dip: 'newBest',
        wall_push_up: null,
        bench_dip_bent_knees: null,
        tuck_hollow_hold: 'newBest',
      },
    );
    assert.equal(thu.incline_push_up!.best, 15);
    // Friday: the rows 12 again are no new best; negatives 6 > 5 are.
    assert.equal(perUnit[3]!.marks.inverted_row!.milestone, null);
    assert.equal(perUnit[3]!.marks.negative_pull_up!.milestone, 'newBest');
    // Still loading: nothing is claimed.
    assert.equal(exerciseMilestone({ sessionBest: 15, priorBest: null, historyLoaded: false }), null);
  });

  it('4 week card "Diese Woche n von 4" and day markers', () => {
    playWeek();
    const counts = DAYS.map((d) =>
      trainingCardSessionCount({
        rangeDays: 7,
        rangeStartKey: MON,
        todayKey: d,
        manualSessions: trainingRows.filter((t) => t.loggedOn <= d),
        workoutSessions: sessions.filter((s) => s.dateKey <= d).map((s) => s.workout),
      }),
    );
    const markers = buildWeekDayMarkersForKeys(DAYS, trainingRows, sessions.map((s) => s.workout));
    out.weekCard = { counts, markers };
    // One per training day; the linked training row is not a second day.
    assert.deepEqual(counts, [1, 2, 2, 3, 4, 5, 5]);
    assert.deepEqual(markers.map((m) => m.shortLabel ?? (m.filled ? '•' : '')), ['P', 'PL', '', 'P', 'PL', '•', '']);
    // Next Monday is a new week.
    assert.equal(
      trainingCardSessionCount({ rangeDays: 7, rangeStartKey: NEXT_MON, todayKey: NEXT_MON, manualSessions: trainingRows, workoutSessions: sessions.map((s) => s.workout) }),
      0,
    );
  });

  it('5 rolling recap "Meine Woche": Sunday, next Monday, "Mein Monat"', () => {
    playWeek();
    const bestsBefore = (startKey: string) => {
      const map: Record<string, number> = {};
      for (const s of sessions.filter((x) => x.dateKey < startKey)) {
        for (const set of s.workout.sets) {
          const v = (set.kind === 'time' ? set.seconds : set.reps) ?? 0;
          if (set.exerciseId && v > (map[set.exerciseId] ?? 0)) {
            map[set.exerciseId] = v;
          }
        }
      }
      return map;
    };
    const proteinGoal = healthDay(MON).proteinG;
    const proteinDays = DAYS.map((d) => ({ date: d, hit: WEEK[d]!.proteinG >= proteinGoal }));
    const build = (period: 'week' | 'month', todayKey: string) =>
      buildRecapSticker(period, {
        todayKey,
        workoutSessions: sessions.map((s) => s.workout),
        manualSessions: trainingRows,
        beforeBests: bestsBefore(recapWindow(period, todayKey).startKey),
        events,
        proteinDays,
        nameOf: (best) => cat(best.exerciseId!).names.de!,
      });
    const sunday = build('week', SUN);
    const monday = build('week', NEXT_MON);
    const month = build('month', SUN);
    out.recap = { proteinGoal, sunday, monday, month, windows: { sunday: recapWindow('week', SUN), monday: recapWindow('week', NEXT_MON) } };

    assert.deepEqual(recapWindow('week', SUN), { startKey: MON, endKey: SUN });
    assert.deepEqual(recapWindow('week', NEXT_MON), { startKey: TUE, endKey: NEXT_MON });
    // 4 units + the unlinked run; the 4 linked training rows are not counted twice.
    assert.equal(sunday.sessions, 5);
    assert.equal(sunday.levelsCount, 2);
    // First week: nothing before the window, so no best to beat.
    assert.equal(sunday.bestsCount, 0);
    // Rolling: Monday's push unit falls out, its bests become the bar to beat.
    assert.equal(monday.sessions, 4);
    assert.equal(monday.bestsCount, 4);
    assert.deepEqual(monday.biggestGain, { name: 'Hollow Hold angehockt', exerciseKind: 'time', from: 30, to: 40 });
    assert.equal(month.sessions, 5);
    assert.equal(sunday.proteinHitDays, proteinDays.filter((d) => d.hit).length);
    assert.equal(monday.proteinHitDays, proteinDays.filter((d) => d.hit && d.date >= TUE).length);
    assert.equal(sunday.totalReps, sessions.flatMap((s) => s.workout.sets).reduce((sum, set) => sum + (set.reps ?? 0), 0));
  });

  it('6 all sticker builders carry no body weight, measurements, load or calorie targets', () => {
    playWeek();
    const thu = sessions.find((s) => s.dateKey === THU)!;
    const inclineValues = thu.workout.sets.filter((s) => s.exerciseId === 'incline_push_up').map((s) => s.reps!);
    const exercise = buildExerciseSticker({
      exercise: cat('incline_push_up'),
      fallbackName: 'x',
      lang: 'de',
      exerciseKind: 'reps',
      perSide: false,
      values: inclineValues,
      ladder: CATALOG,
      milestone: 'newBest',
    });
    const level = buildLevelSticker({ toExercise: cat('push_up'), fromExercise: cat('incline_push_up'), lang: 'de', ladder: CATALOG })!;
    const session = buildSessionSticker({
      name: thu.workout.templateName,
      dateKey: thu.dateKey,
      durationMinutes: 50,
      totals: {
        reps: thu.workout.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
        seconds: thu.workout.sets.reduce((sum, s) => sum + (s.seconds ?? 0), 0),
      },
      items: templates.push.map((_, i) => i).map((i) => {
        const own = thu.workout.sets.filter((s) => s.exercisePosition === i);
        return { exerciseId: own[0]!.exerciseId!, name: own[0]!.exerciseName, exerciseKind: own[0]!.kind, values: own.map((s) => s.reps ?? s.seconds ?? 0) };
      }),
      bestsCount: 4,
      suggestions: [{ index: 0, kind: 'variant_up' }],
      decisions: { 0: 'accept' },
    });
    const recap = buildRecapSticker('week', {
      todayKey: SUN,
      workoutSessions: sessions.map((s) => s.workout),
      manualSessions: trainingRows,
      beforeBests: {},
      events,
      proteinDays: DAYS.map((d) => ({ date: d, hit: true })),
      nameOf: (best) => best.exerciseName,
    });
    const progress = buildProgressSticker({
      exerciseId: 'push_up',
      exercises: CATALOG,
      units: sessions.map((s) => ({ sessionId: s.workout.id, loggedOn: s.dateKey, sets: s.workout.sets })),
      todayKey: SUN,
      lang: 'de',
    });
    const meal = buildMealSticker({
      items: [
        { name: 'Haferflocken', kcal: 370, proteinG: 13 },
        { name: 'Skyr', kcal: 125, proteinG: 22 },
        { name: 'Banane', kcal: 105, proteinG: 1 },
      ],
      portionFactor: 1,
      photoUri: null,
    });
    const forecast = computeSkillGoalForecast({
      goalExerciseId: 'chin_up',
      targetValue: 8,
      exercises: CATALOG,
      units: sessions.map((s) => ({ loggedOn: s.dateKey, sets: s.workout.sets })),
      todayKey: SUN,
    })!;
    const goal = buildGoalSticker({ goal: { exerciseId: 'chin_up', targetValue: 8 }, forecast, exercises: CATALOG, lang: 'de' });
    out.stickers = { exercise, level, session, recap, progress, meal, goal };

    assert.equal(exercise.name, 'Schräge Liegestütze');
    assert.deepEqual(exercise.level, { step: 2, total: 6 });
    assert.deepEqual(exercise.values, [15, 15, 15]);
    assert.equal(level.name, 'Liegestütze');
    assert.equal(level.previousName, 'Schräge Liegestütze');
    assert.equal(session.levelsCount, 1);
    assert.equal(session.name, 'Push');
    // Ladder progress: incline push-ups (step 2) Mon + Thu; push_up never trained yet.
    assert.deepEqual(Object.keys(progress.views), ['all']);
    assert.equal(progress.name, 'Schräge Liegestütze');
    assert.deepEqual(meal.labels, ['Haferflocken', 'Skyr', 'Banane']);
    assert.equal(meal.kcal, 600);
    assert.equal(goal.name, 'Chin-ups');
    assert.equal(goal.current?.name, 'Negative Klimmzüge');

    const dayGoals = DAYS.map((d) => healthDay(d));
    const forbidden = [
      PROFILE.weightKg,
      PROFILE.targetWeightKg,
      PROFILE.heightCm,
      ...DAYS.flatMap((d) => (WEEK[d]!.weightKg ? [WEEK[d]!.weightKg!] : [])),
      ...dayGoals.flatMap((g) => [g.calorieGoal, g.base, g.bmr, g.carbsG, g.fatG, g.proteinG]),
    ];
    for (const [label, data] of Object.entries({ exercise, level, session, recap, progress, meal, goal })) {
      assertStickerClean(label, data, forbidden);
    }
  });

  it('7 readiness with and without check-in', () => {
    playWeek();
    const all = readinessSessions();
    const checkins: DailyCheckin[] = DAYS.filter((d) => WEEK[d]!.checkin).map((d) => ({ date: d, ...WEEK[d]!.checkin! }));
    const proteinGoal = healthDay(MON).proteinG;
    const nutrition = DAYS.map((d) => ({ date: d, calories: 2400, calorieTarget: healthDay(d).calorieGoal, proteinG: WEEK[d]!.proteinG, proteinTargetG: proteinGoal }));
    const on = (todayKey: string, checkin: DailyCheckin | null) =>
      computeReadiness({
        todayKey,
        checkin: checkin ? { sleep: checkin.sleep, energy: checkin.energy, soreness: checkin.soreness, stress: checkin.stress } : null,
        pastCheckins: checkins.filter((c) => c.date < todayKey),
        // Morning check-in: today's unit has not happened yet.
        sessions: all.filter((s) => s.loggedOn < todayKey),
        nutrition: nutrition.filter((n) => n.date < todayKey),
        plannedUnit: { id: 'pull_legs', name: 'Pull & Legs', muscles: ['back', 'biceps', 'quads', 'glutes'] },
        alternativeUnits: [{ id: 'push', name: 'Push', muscles: ['chest', 'shoulders', 'triceps'] }],
        soreMuscles: ['back', 'biceps'],
      });
    const c = (d: string) => checkins.find((x) => x.date === d)!;
    const results = {
      monNoCheckin: on(MON, null),
      tueGood: on(TUE, c(TUE)),
      wedNoCheckin: on(WED, null),
      thuNeutral: on(THU, c(THU)),
      friLowSleep: on(FRI, c(FRI)),
      satNoCheckin: on(SAT, null),
      satSore: on(SAT, { date: SAT, sleep: 4, energy: 4, soreness: 4, stress: 2 }),
    };
    out.readiness = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { level: r.level, basis: r.basis, learning: r.learning, rating: r.checkinRating, signals: r.signals, load3: r.load3, load7: r.load7, message: r.message.key, action: r.action.key, alternative: r.alternativeUnitId }]));

    // Monday morning, no check-in, nothing before: neutral and says so.
    assert.deepEqual([results.monNoCheckin.level, results.monNoCheckin.basis], ['normal', 'none']);
    // Tuesday 4/4/2/2 = 16: good without a baseline yet ("lernt dich kennen").
    assert.deepEqual([results.tueGood.level, results.tueGood.basis, results.tueGood.learning, results.tueGood.checkinRating], ['ready', 'checkin', true, 'good']);
    // Wednesday without check-in: rated from data (two units), still normal.
    assert.deepEqual([results.wedNoCheckin.level, results.wedNoCheckin.basis], ['normal', 'data']);
    assert.equal(results.thuNeutral.level, 'normal');
    // Friday sleep 1 is a red flag → schonen, sleep sentence; soreness 4 with an alternative unit.
    assert.equal(results.friLowSleep.level, 'gentle');
    assert.ok(results.friLowSleep.signals.includes('lowCheckin'));
    assert.equal(results.friLowSleep.alternativeUnitId, 'push');
    // Saturday without check-in: loads stay under the thresholds, protein low on Wed/Thu (< 70 %?) decides.
    assert.equal(results.satNoCheckin.basis, 'data');
    assert.ok(results.satNoCheckin.load3 < 900 && results.satNoCheckin.load7 < 1800);
    assert.equal(results.satNoCheckin.level, 'normal');
    // Sore back with Pull & Legs planned → gentle, swap to Push.
    assert.equal(results.satSore.level, 'gentle');
    assert.equal(results.satSore.soreMuscle, 'back');
    assert.equal(results.satSore.action.key, 'checkin.readiness.sore.swapAction');
  });

  it('8 recommendations by time of day and goal', () => {
    playWeek();
    const mon = healthDay(MON);
    const wed = healthDay(WED);
    const ctx = (over: Partial<RecommendationContext>): RecommendationContext => ({
      goalCategory: goalCategoryForGoalType(PROFILE.goalType),
      hour: 9,
      minute: 0,
      todayKey: MON,
      nowMs: Date.parse(at(MON, 9)),
      trainingDay: true,
      trainedToday: false,
      consumed: { proteinG: 20, carbsG: 60, fiberG: 5 },
      targets: { kcal: mon.calorieGoal, proteinG: mon.proteinG, carbsG: mon.carbsG, fiberG: 35 },
      readiness: 'normal',
      nextLevel: null,
      muscleDeficits: [],
      lastWeightDateKey: MON,
      lastMeasurementDateKey: null,
      usesMeasurements: false,
      checkinStatus: 'open',
      dismissals: {},
      ...over,
    });
    const kinds = (c: RecommendationContext) => buildRecommendations(c).map((r) => r.kind);
    const results = {
      mon0900: kinds(ctx({})),
      mon1400: buildRecommendations(ctx({ hour: 14, nowMs: Date.parse(at(MON, 14)), consumed: { proteinG: 40, carbsG: 80, fiberG: 10 } })),
      mon1400ProteinOk: kinds(ctx({ hour: 14, nowMs: Date.parse(at(MON, 14)), consumed: { proteinG: 90, carbsG: 80, fiberG: 10 }, checkinStatus: 'answered' })),
      mon1930Trained: kinds(ctx({ hour: 19, minute: 30, trainedToday: true, consumed: { proteinG: 60, carbsG: 120, fiberG: 10 }, checkinStatus: 'answered' })),
      wed1400Rest: kinds(ctx({ todayKey: WED, hour: 14, trainingDay: false, targets: { kcal: wed.calorieGoal, proteinG: wed.proteinG, carbsG: wed.carbsG, fiberG: 35 }, consumed: { proteinG: 90, carbsG: 50, fiberG: 10 }, checkinStatus: 'answered' })),
      friGentle: kinds(ctx({ todayKey: FRI, hour: 15, readiness: 'gentle', consumed: { proteinG: 90, carbsG: 150, fiberG: 10 }, lastWeightDateKey: FRI, checkinStatus: 'answered' })),
      sunWeight6Days: kinds(ctx({ todayKey: SUN, hour: 9, trainingDay: false, checkinStatus: 'answered' })),
      nextMonWeight7Days: kinds(ctx({ todayKey: NEXT_MON, hour: 9, checkinStatus: 'answered' })),
      neverWeighed: buildRecommendations(ctx({ lastWeightDateKey: null, checkinStatus: 'answered' })).map((r) => r.message.key),
      lose1400Rest: kinds(ctx({ goalCategory: 'lose', hour: 14, trainingDay: true, consumed: { proteinG: 40, carbsG: 80, fiberG: 10 }, checkinStatus: 'answered' })),
    };
    out.recommendations = results;

    // 09:00: nothing for nutrition yet, no weight hint (weighed today), check-in card still owns the morning.
    assert.deepEqual(results.mon0900, []);
    // 14:00 on a training day, protein and carbs clearly behind: protein first, then carbs before the unit.
    assert.deepEqual(results.mon1400.map((r) => r.kind), ['protein', 'carbs_training', 'checkin']);
    assert.equal(results.mon1400[0]!.message.params?.grams, mon.proteinG - 40);
    assert.equal(results.mon1400[0]!.reason?.key, 'onboarding2.focus.reason.muscle.protein');
    assert.deepEqual(results.mon1400ProteinOk, ['carbs_training']);
    // After the unit: no more "carbs before training".
    assert.deepEqual(results.mon1930Trained, ['protein']);
    // Rest day: carbs low but no training → no carbs hint.
    assert.deepEqual(results.wed1400Rest, []);
    // Gentle day on a planned unit: rest instead of more load.
    assert.deepEqual(results.friGentle, ['rest_day']);
    // Weight hint after 7 days, not 6.
    assert.deepEqual(results.sunWeight6Days, []);
    assert.deepEqual(results.nextMonWeight7Days, ['weight']);
    assert.deepEqual(results.neverWeighed, ['recommendations.weight.messageFirst']);
    // "Abnehmen" has no carbs focus: protein and its own fiber focus, no carbs hint on the same day.
    assert.deepEqual(results.lose1400Rest, ['protein', 'fiber']);

    // Finding: apply-built-plan saves wizard units with weekdays: []. useRecommendations
    // (trainingDay = a unit planned for this weekday || a session logged today) then only
    // sees a training day after the unit is logged — "Kohlenhydrate vor dem Training"
    // and the gentle-day rest hint never show for a wizard plan without weekdays.
    const trainingDayLikeHook = (weekdays: number[][], isoWeekday: number, loggedToday: boolean) =>
      weekdays.some((days) => days.includes(isoWeekday)) || loggedToday;
    const wizardWeekdays = [[], []];
    const before = kinds(ctx({ hour: 14, nowMs: Date.parse(at(MON, 14)), trainingDay: trainingDayLikeHook(wizardWeekdays, 1, false), consumed: { proteinG: 40, carbsG: 80, fiberG: 10 }, checkinStatus: 'answered' }));
    const gentle = kinds(ctx({ hour: 14, readiness: 'gentle', trainingDay: trainingDayLikeHook(wizardWeekdays, 1, false), consumed: { proteinG: 90, carbsG: 150, fiberG: 10 }, checkinStatus: 'answered' }));
    out.recommendationsWizardWeekdays = { before, gentle };
    assert.deepEqual(before, ['protein']);
    assert.deepEqual(gentle, []);
  });

  it('9 muscle groups counted over the week', () => {
    playWeek();
    const sets = sessions.flatMap((s) => s.workout.sets.map((set) => ({ exerciseId: set.exerciseId, loggedOn: s.dateKey, reps: set.reps, seconds: set.seconds, rir: set.rir ?? null })));
    const counts = countMuscleSets({ sets, resolve: (id) => byId.get(id), todayKey: SUN, days: 7 });
    const status = muscleStatus(counts, weeklySetTarget(PROFILE.goalType));
    out.muscles = { counts, status };
    // Primary 1 set, secondary 0.5 (see muscle-volume.ts), 2 × Push + 2 × Pull & Legs.
    assert.deepEqual(
      { chest: counts.chest, triceps: counts.triceps, shoulders: counts.shoulders, back: counts.back, biceps: counts.biceps, core: counts.core, quads: counts.quads, glutes: counts.glutes, hamstrings: counts.hamstrings },
      { chest: 18, triceps: 21, shoulders: 24, back: 15, biceps: 6, core: 12, quads: 6, glutes: 9, hamstrings: 3 },
    );
    const missing = Object.fromEntries(status.filter((s) => !s.reached).map((s) => [s.group, s.missing]));
    assert.equal(missing.biceps, 4);
    assert.equal(missing.quads, 4);
    assert.equal(missing.hamstrings, 7);
    assert.equal(missing.chest, undefined);
    // Next Monday the 7-day window drops Monday's Push.
    const nextWeek = countMuscleSets({ sets, resolve: (id) => byId.get(id), todayKey: NEXT_MON, days: 7 });
    assert.equal(nextWeek.chest, 9);
    // rir 4 would be a warm-up and is not counted.
    assert.equal(countMuscleSets({ sets: [{ exerciseId: 'push_up', loggedOn: SUN, reps: 10, rir: 4 }], resolve: (id) => byId.get(id), todayKey: SUN, days: 7 }).chest, 0);
  });

  it('10 build-up sentence, metric and imperial', () => {
    playWeek();
    const weights = DAYS.filter((d) => WEEK[d]!.weightKg).map((d) => ({ on: d, value: WEEK[d]!.weightKg! }));
    const input = {
      todayKey: SUN,
      weeks: 4 as const,
      weightKg: weights,
      waistCm: [{ on: MON, value: 84 }, { on: SUN, value: 83.4 }],
      chestCm: [{ on: MON, value: 100 }, { on: SUN, value: 100.2 }],
      armCm: [],
      sessions: sessions.map((s) => ({ loggedOn: s.dateKey, sets: s.workout.sets })),
      beforeBests: {},
      progressionEvents: events.map((ev) => ({ kind: ev.kind, status: ev.status, day: localKey(ev.createdAt) })),
    };
    const week1 = computeBuildUp(input);
    const de = formatBuildUpSentence(week1, { unitSystem: 'metric', locale: 'de-DE', t: translator('de') });
    const en = formatBuildUpSentence(week1, { unitSystem: 'imperial', locale: 'en-US', t: translator('en') });

    // Three earlier weeks of weigh-ins and exercise bests: weight and gains appear.
    const earlierWeights = [-27, -26, -25, -24, -22].map((offset) => ({ on: shiftKey(MON, offset), value: 79.2 }));
    // Best set per exercise before the 4-week window (useExerciseBestsBefore): 3 reps / 10 s below Monday.
    const beforeBests: Record<string, number> = {};
    for (const set of sessions[0]!.workout.sets) {
      const value = set.kind === 'time' ? set.seconds! - 10 : set.reps! - 3;
      beforeBests[set.exerciseId!] = Math.max(beforeBests[set.exerciseId!] ?? 0, value);
    }
    const withHistory = computeBuildUp({ ...input, weightKg: [...earlierWeights, ...weights], beforeBests });
    // use-build-up re-resolves gain names in the app language (displayExerciseName).
    const named = (lang: 'de' | 'en') => ({
      ...withHistory,
      exerciseGains: withHistory.exerciseGains.map((gain) => ({ ...gain, exerciseName: cat(gain.exerciseId).names[lang]! })),
    });
    const deHistory = formatBuildUpSentence(named('de'), { unitSystem: 'metric', locale: 'de-DE', t: translator('de') });
    const enHistory = formatBuildUpSentence(named('en'), { unitSystem: 'imperial', locale: 'en-US', t: translator('en') });
    out.buildUp = { week1, de, en, withHistory, deHistory, enHistory };

    // After one week: weight has no baseline window yet, waist −0.6 → "−0,5 cm", chest stable, 2 levels.
    assert.equal(week1.weightDeltaKg, null);
    assert.equal(de, 'Du baust auf: Taille −0,5 cm, Brust stabil, +2 Stufen.');
    assert.equal(en, "You're building up: waist −0.2 in, chest steady, +2 levels.");
    assert.ok(withHistory.weightDeltaKg != null && withHistory.weightDeltaKg > 0.3);
    // Weight: 7-day mean 80.225 against 79.2 → +1.0 kg = +2.3 lbs; two main exercises with their gain.
    assert.equal(deHistory, 'Du baust auf: Gewicht +1 kg, Taille −0,5 cm, Brust stabil, +2 Stufen, Bankdips: +5, Bankdips (Knie gebeugt): +3.');
    assert.equal(enHistory, "You're building up: weight +2.3 lbs, waist −0.2 in, chest steady, +2 levels, Bench Dips: +5, Bent-Knee Bench Dips: +3.");
  });

  it('11 skill goal forecast: too little data after a week, a period with four weeks', () => {
    playWeek();
    const weekUnits = sessions.map((s) => ({ loggedOn: s.dateKey, sets: s.workout.sets }));
    const week = computeSkillGoalForecast({ goalExerciseId: 'chin_up', targetValue: 8, exercises: CATALOG, units: weekUnits, todayKey: SUN })!;
    // Three earlier weeks of Pull & Legs with negatives rising 3 → 5.
    const earlier = [-26, -23, -19, -16, -12, -9].map((offset, i) => ({
      loggedOn: shiftKey(MON, offset),
      sets: sessions[1]!.workout.sets
        .filter((set) => set.exerciseId === 'negative_pull_up')
        .map((set) => ({ ...set, sessionId: `old-${i}`, reps: 3 + Math.floor(i / 3) })),
    }));
    const month = computeSkillGoalForecast({ goalExerciseId: 'chin_up', targetValue: 8, exercises: CATALOG, units: [...earlier, ...weekUnits], todayKey: SUN })!;
    out.skillGoal = { week, month };
    assert.equal(week.status, 'too_little_data');
    assert.equal(week.status === 'too_little_data' && week.sessionsNeeded, 2);
    assert.equal(week.status === 'too_little_data' && week.daysNeeded, 11);
    assert.equal(week.current?.exerciseId, 'negative_pull_up');
    assert.ok(week.progress > 0 && week.progress < 1);
    assert.equal(month.status, 'ok');
    if (month.status === 'ok') {
      assert.ok(month.etaKey > SUN);
      assert.ok(month.period.from.year >= 2026);
    }
  });

  it('12 meal grouping and protein by time of day', () => {
    const entry = (d: string, h: number, m: number, kcal: number, proteinG: number | null, name: string) => ({ date: d, eatenAt: at(d, h, m), totalCalories: kcal, proteinG, name });
    const entries = DAYS.flatMap((d) => [
      entry(d, 7, 30, 350, 12, 'Müsli'),
      entry(d, 8, 15, 120, 3, 'Kaffee mit Milch'), // 45 min after → same breakfast
      entry(d, 12, 45, 700, 45, 'Mittag'),
      entry(d, 15, 40, 200, 15, 'Quark'),
      entry(d, 19, 0, 800, 55, 'Abendessen'),
      entry(d, 21, 30, 300, 20, 'Brot'), // second meal in the dinner window → snack
    ]);
    const groups = groupMeals(entries, { eatenAt: (e) => e.eatenAt, kcal: (e) => e.totalCalories });
    const mon = groups.filter((g) => g.dateKey === MON);
    const labels = mon.map((g) => mealGroupLabel(g));
    const breakfastTotals = sumMealGroupTotals(mon[0]!.entries.map((e) => ({ kcal: e.totalCalories, proteinG: e.proteinG })));
    const proteinGoal = computeMacroGoals({ dailyCalorieGoal: 2600, weightKg: PROFILE.weightKg, heightCm: PROFILE.heightCm, targetWeightKg: PROFILE.targetWeightKg, goalType: PROFILE.goalType, dietPreference: PROFILE.diet, birthDate: PROFILE.birthDateKey }).proteinG;
    const stats = computeProteinTimingStats({ meals: entries, todayKey: SUN });
    const hint = pickProteinTimingHint({ stats, dailyProteinGoalG: proteinGoal });
    out.meals = { labels, breakfastTotals, stats, hint, proteinGoal };

    assert.deepEqual(labels, ['breakfast', 'lunch', 'afternoonSnack', 'dinner', 'snack']);
    assert.deepEqual(breakfastTotals, { kcal: 470, proteinG: 15 });
    assert.equal(groups.length, DAYS.length * 5);
    // Six closed days (Sunday is today and left out).
    assert.equal(stats.breakfast.mealCount, 6);
    assert.equal(stats.breakfast.averageProteinG, 15);
    assert.equal(stats.snack.mealCount, 12);
    // Breakfast 15 g vs. goal ÷ 3: clearly below → one hint for breakfast.
    assert.equal(hint?.slot, 'breakfast');
    assert.equal(hint?.averageProteinG, 15);
    assert.ok(hint!.addFromG >= 5 && hint!.addToG === hint!.addFromG + 5);
    // One minute later than 45 min starts a new meal.
    const split = groupMeals([entry(MON, 7, 30, 350, 12, 'a'), entry(MON, 8, 16, 120, 3, 'b')], { eatenAt: (e) => e.eatenAt, kcal: (e) => e.totalCalories });
    assert.equal(split.length, 2);
  });

  it('13 imperial display: weight in lbs, distance in mi, foods stay in g', () => {
    const logs = DAYS.filter((d) => WEEK[d]!.weightKg).map((d) => ({ weight_kg: WEEK[d]!.weightKg!, logged_at: at(d, 7) }));
    const display = resolveDisplayWeight({ logs, startOn: MON, today: SUN });
    const imperial = formatWeightForDisplay({ weightKg: display.dailyKg!, unitSystem: 'imperial', kgLabel: 'kg', lbsLabel: 'lbs' });
    const metric = formatWeightForDisplay({ weightKg: display.dailyKg!, unitSystem: 'metric', kgLabel: 'kg', lbsLabel: 'lbs' });
    const delta = formatWeightDeltaForDisplay({ deltaKg: display.barEndKg! - display.barStartKg!, unitSystem: 'imperial', kgLabel: 'kg', lbsLabel: 'lbs' });
    const run = formatDistanceKm({ distanceKm: 5, unitSystem: 'imperial', kmLabel: 'km', miLabel: 'mi' });
    const food = formatQuantity(150, 'g', 'imperial');
    out.imperial = { display, imperial, metric, delta, run, food };
    assert.equal(display.dailyKg, 80.3);
    // Four weigh-ins in the week: the trend is a moving average.
    assert.equal(display.trendUsesMa, true);
    assert.equal(metric, '80.3 kg');
    assert.equal(imperial, '177 lbs');
    assert.equal(run, '3.1 mi');
    assert.equal(food, '150 g');
    assert.match(delta ?? '', /^\+0\.\d lbs$/);
  });
});


// ---------------------------------------------------------------------------
// Test week 2 (1.4.0): six weeks, 2026-08-24 … 2026-10-04, injected time
// ---------------------------------------------------------------------------

describe('week simulation 2 (six weeks, 1.4.0 additions)', () => {
  const W0 = '2026-08-24'; // Monday of week 1
  const TODAY6 = '2026-10-04'; // Sunday of week 6
  const weekStart = (week: number) => shiftKey(W0, (week - 1) * 7);
  const hist = (sessionId: string, reps: number[], extra: Partial<ProgressionHistoryUnit> = {}): ProgressionHistoryUnit => ({
    sessionId,
    intensity: 'normal',
    sets: reps.map((r) => ({
      reps: r,
      seconds: null,
      secondsOtherSide: null,
      targetReps: 8,
      targetRepsMax: 12,
      targetSeconds: null,
      targetSecondsMax: null,
      done: true,
    })),
    ...extra,
  });
  const ladderEx = cat('push_up');
  const target = { targetSets: 3, targetReps: 8, targetRepsMax: 12, targetSeconds: null, targetSecondsMax: null };
  const suggest = (history: ProgressionHistoryUnit[]) =>
    suggestProgression({
      exercise: { ...ladderEx, progressionKind: 'variant' },
      ladder: ladderOf(ladderEx),
      currentTarget: target,
      history,
      templateExerciseIds: [ladderEx.id],
      lastEvents: [],
    });

  it('W2-1 extra sets: 12·12·12·9 suggests, a bonus set at the upper bound counts on "hart", two units with 5 sets → sets_up 4', () => {
    const weak = hist('w1', [9, 9, 9]);
    assert.ok(suggest([hist('w2', [12, 12, 12, 9]), weak]) != null, '12·12·12·9 is a success of the planned sets');
    assert.equal(suggest([hist('w3', [12, 12, 12, 12], { intensity: 'hard' }), weak])?.kind, 'variant_up');
    assert.equal(suggest([hist('w4', [12, 12, 12, 11], { intensity: 'hard' }), weak]), null, 'hard without a bonus set at the bound waits');
    const five = (id: string) => hist(id, [9, 9, 9, 9, 9]);
    const setsUp = suggest([five('w5b'), five('w5a')]);
    assert.equal(setsUp?.kind, 'sets_up');
    assert.equal(setsUp?.toTarget.targetSets, 4);
  });

  it('W2-2 prefill: this unit, then the last unit, then the lower bound', () => {
    const template = {
      id: 'push',
      name: 'Push',
      shortLabel: 'P',
      colorKey: 'indigo',
      weekdays: [1],
      position: 0,
      exercises: [{ id: 'te', exerciseId: 'push_up', exercise: ladderEx, position: 0, targetSets: 3, targetReps: 8, targetRepsMax: 12, targetSeconds: null, targetSecondsMax: null, targetWeightKg: null, restSeconds: 90 }],
    } as unknown as WorkoutTemplate;
    const fresh = buildActiveSessionFromTemplate(template, { userId: 'u', loggedOn: weekStart(6) });
    assert.deepEqual(fresh.items[0]!.sets.map((x) => x.value), [8, 8, 8]);
    const history = lastSetsByExercise([
      { id: 'prev', finishedAt: at(weekStart(5), 19), startedAt: at(weekStart(5), 18), loggedOn: weekStart(5), sets: [0, 1].map((i) => ({ ...sessions0Set(i), reps: [11, 10][i]! })) },
    ]);
    let session = buildActiveSessionFromTemplate(template, { userId: 'u', loggedOn: weekStart(6), lastSetsByExercise: history });
    assert.deepEqual(session.items[0]!.sets.map((x) => x.value), [11, 10, 10]);
    session = adjustCurrent(session, 1);
    session = completeCurrentSet(session, at(weekStart(6), 18))!.session;
    assert.deepEqual(session.items[0]!.sets.map((x) => x.value), [12, 12, 12]);
    session = addSet(session, 0);
    assert.equal(session.items[0]!.sets.at(-1)!.value, 12);
    assert.equal(applySetPrefill(session.items[0]!, null), session.items[0]!);
  });

  function sessions0Set(i: number): SessionSet {
    return {
      id: `prev-${i}`, sessionId: 'prev', userId: 'u', exerciseId: 'push_up', exerciseName: 'Push-up', exercisePosition: 0, setIndex: i,
      kind: 'reps', perSide: false, targetReps: 8, targetRepsMax: 12, targetSeconds: null, targetSecondsMax: null, targetWeightKg: null,
      reps: 10, seconds: null, secondsOtherSide: null, weightKg: null, completedAt: at(weekStart(5), 18, i),
    };
  }

  it('W2-3 post-training hint: strength leads with protein, a run with carbs, fat from 85 %', () => {
    const base = { consumed: { proteinG: 60, carbsG: 120, fatG: 60 }, targets: { proteinG: 150, carbsG: 300, fatG: 70 } };
    const strength = postTrainingNutritionHint({ trainingKind: 'strength', ...base });
    const run = postTrainingNutritionHint({ trainingKind: 'endurance', ...base });
    assert.deepEqual(strength.map((l) => l.kind), ['protein', 'carbs', 'fat']);
    assert.deepEqual(run.map((l) => l.kind), ['carbs', 'protein', 'fat']);
    const lowFat = postTrainingNutritionHint({ trainingKind: 'strength', ...base, consumed: { ...base.consumed, fatG: 59 } });
    assert.equal(lowFat.some((l) => l.kind === 'fat'), false, '59/70 = 84 % stays quiet');
  });

  it('W2-4 focus areas change the order of the recommendations', () => {
    const ctx = (goalCategory: RecommendationContext['goalCategory'], focusAreas: RecommendationContext['focusAreas']): RecommendationContext => ({
      goalCategory,
      hour: 13, minute: 0, todayKey: TODAY6, nowMs: Date.parse(at(TODAY6, 13)),
      trainingDay: true, trainedToday: false,
      consumed: { proteinG: 30, carbsG: 80, fiberG: 4 },
      targets: { kcal: 2600, proteinG: 150, carbsG: 320, fiberG: 35 },
      readiness: 'normal', nextLevel: null, muscleDeficits: [], lastWeightDateKey: TODAY6,
      lastMeasurementDateKey: null, usesMeasurements: false, checkinStatus: 'open', dismissals: {},
      focusAreas,
    } as RecommendationContext);
    const kinds = (c: RecommendationContext) => buildRecommendations(c).map((r) => r.kind);
    assert.deepEqual(kinds(ctx('muscle', null)), ['protein', 'carbs_training', 'checkin']);
    assert.deepEqual(kinds(ctx('muscle', ['more_training_energy'])), ['carbs_training', 'protein', 'checkin']);
    assert.deepEqual(kinds(ctx('lose', null)), ['protein', 'fiber', 'checkin']);
    assert.deepEqual(kinds(ctx('lose', ['more_fiber'])), ['fiber', 'protein', 'checkin']);
    // Fix (Befund 5, test week 2): a focus area can now surface a card the
    // goal's own table would otherwise leave out. "Mehr Ballaststoffe" with
    // build_muscle now yields a fiber hint, ahead of the goal's own topics —
    // the 4th nutrition candidate bumps "checkin" past maxShown.
    assert.deepEqual(kinds(ctx('muscle', ['more_fiber'])), ['fiber', 'protein', 'carbs_training']);
  });

  it('W2-5 lighter week: both triggers, 28-day cooldown, one set less during it, no level-ups, back afterwards', () => {
    const now = Date.parse(at(TODAY6, 9));
    const trainingDayKeys = [3, 4, 5, 6].flatMap((w) => [weekStart(w), shiftKey(weekStart(w), 3)]);
    const weekVolumes = [3, 4, 5, 6].map((w) => ({ weekStartKey: weekStart(w), setCount: 40 }));
    const base: DeloadContext = {
      nowMs: now, todayKey: TODAY6, lastSuggestedAt: null, deloadUntil: null,
      trainingDayKeys, weekVolumes,
      recentReadiness: [0, 1, 2, 3].map((d) => ({ dateKey: shiftKey(TODAY6, -d), level: d < 2 ? 'gentle' : 'normal' })),
      recentUnits: [], exerciseHistory: [], recentCheckins: [], checkinAverages: null,
    };
    assert.deepEqual(suggestDeload(base), { shouldSuggest: true, reason: 'load_and_gentle' });
    const second: DeloadContext = {
      ...base,
      recentReadiness: [],
      recentUnits: [
        { exercises: [{ exerciseId: 'a', bestLoadOrReps: 8 }, { exerciseId: 'b', bestLoadOrReps: 20 }] },
        { exercises: [{ exerciseId: 'a', bestLoadOrReps: 8 }, { exerciseId: 'b', bestLoadOrReps: 21 }] },
      ],
      exerciseHistory: [{ exerciseId: 'a', values: [10, 10, 11] }, { exerciseId: 'b', values: [25, 26] }],
      recentCheckins: [{ energy: 2, soreness: 4 }, { energy: 2, soreness: 4 }, { energy: 2, soreness: 3 }, { energy: 4, soreness: 2 }, { energy: 4, soreness: 2 }],
      checkinAverages: { energy: 3.5, soreness: 2.5 },
    };
    assert.deepEqual(suggestDeload(second), { shouldSuggest: true, reason: 'performance_and_checkin' });
    const cooled = new Date(now - (DELOAD_RULES.suggestCooldownDays - 1) * 86_400_000).toISOString();
    assert.equal(suggestDeload({ ...base, lastSuggestedAt: cooled }).shouldSuggest, false, 'within 28 days');
    const old = new Date(now - (DELOAD_RULES.suggestCooldownDays + 1) * 86_400_000).toISOString();
    assert.equal(suggestDeload({ ...base, lastSuggestedAt: old }).shouldSuggest, true);

    const until = shiftKey(TODAY6, 6);
    const plan = { id: 'p', name: 'Push', shortLabel: 'P', colorKey: 'indigo', weekdays: [], position: 0, exercises: [{ targetSets: 3 }, { targetSets: 1 }] } as unknown as WorkoutTemplate;
    assert.equal(isDeloadActive(until, TODAY6), true);
    assert.deepEqual(templateForStart(plan, until, TODAY6).exercises.map((e) => e.targetSets), [2, 1]);
    assert.equal(suggestDeload({ ...base, deloadUntil: until }).shouldSuggest, false, 'no new suggestion during it');
    assert.equal(templateForStart(plan, until, shiftKey(until, 1)), plan, 'back to the plan after the week');
  });

  it('W2-6 manual entries (is_manual) count on unit days, phantoms do not', () => {
    const day = weekStart(6);
    const units = [{ loggedOn: day, finishedAt: at(day, 19), trainingSessionId: 'linked' }];
    const rows = [
      { id: 'linked', loggedOn: day, activity: 'strength', isManual: false },
      { id: 'phantom', loggedOn: day, activity: 'strength', isManual: false },
      { id: 'yoga-log', loggedOn: day, activity: 'strength', isManual: true },
    ];
    const result = reconcileTrainingRows(rows, units);
    assert.deepEqual(result.kept.map((r) => r.id).sort(), ['linked', 'yoga-log']);
    assert.deepEqual(result.manual.map((r) => r.id), ['yoga-log']);
    assert.deepEqual(result.duplicates.map((r) => r.id), ['phantom']);
  });

  it('W2-7 the stored sport energy is what history uses', () => {
    assert.equal(resolveSportKcalForHistory({ sportEnergyKcal: 640, activeEnergyKcal: 420 }), 640);
    assert.equal(resolveSportKcalForHistory({ sportEnergyKcal: null, activeEnergyKcal: 420 }), 420);
    assert.equal(resolveSportKcalForHistory({ sportEnergyKcal: -1, activeEnergyKcal: null }), null);
  });

  it('W2-8 macro history: scale from 0, summary, in target, today not counted, goal jump marked', () => {
    const dates = [0, 1, 2, 3, 4, 5, 6].map((d) => shiftKey(TODAY6, d - 6));
    const protein = [150, 170, null, 160, 140, 175, 30];
    const goal = [160, 160, 160, 165, 165, 165, 165];
    const domain = macroChartDomain([protein, goal]);
    assert.equal(domain.min, 0);
    assert.ok(domain.max >= 175 * 1.15);
    const summary = macroTrendSummary({ nutrient: 'protein', dates, actual: protein, goal, todayKey: TODAY6 });
    assert.deepEqual(summary, { avg: 159, goal: 163, hit: 2, days: 5 });
    assert.equal(isMacroDayInTarget('fiber', 30, 30), true);
    assert.equal(isMacroDayInTarget('carbs', 331, 300), false);
    assert.equal(isMacroDayInTarget('fat', 63, 70), true);
    assert.deepEqual([...macroGoalChangeIndices(goal)], [3]);
  });

  it('W2-9 several level-ups in one unit become one celebration', () => {
    const celebration = buildCelebration([
      { kind: 'variant_up', name: 'Liegestütze', step: 3, total: 6, levelSticker: null },
      { kind: 'variant_up', name: 'Klimmzüge', step: 5, total: 6, levelSticker: null },
      { kind: 'praise', name: 'Plank', praiseKey: 'training.progression.praise.timeUp' },
    ]);
    assert.equal(celebration?.mode, 'multi_level');
    assert.equal(celebration?.mode === 'multi_level' && celebration.count, 2);
    assert.equal(celebration?.mode === 'multi_level' && celebration.praiseLine?.name, 'Plank');
  });
});
