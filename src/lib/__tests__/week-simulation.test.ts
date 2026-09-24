/**
 * One simulated week of Kolibi use, Monday to Sunday, on the app's pure
 * functions only. Time comes from fixed date keys — never the real clock.
 *
 * Where a module cannot load under node (it pulls in react-native via
 * supabase or expo-localization), the test carries a thin shell that mirrors
 * the app's call and says so. App code is not changed for this test.
 *
 * With WEEK_SIM_OUT=<file> the per-day results are written as JSON for the
 * report (REPORT-week-test.md).
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';

import {
  accuracyFromTrackedDays,
  computeBalanceSummaryHeadline,
  type BalanceSummaryHeadline,
} from '../history-balance-stats.ts';
import type { HistorySummaryStats } from '../history.ts';
import { computeMacroGoals } from '../macro-goals.ts';
import {
  CalorieSource,
  applyGoalAdjustment,
  calculateMaintenanceCalories,
  resolveEffectiveDailyCalorieGoal,
} from '../calorie-goal-math.ts';
import { formatDistanceKm, formatWeightForDisplay } from '../measure-units-core.ts';
import { buildSportEnergyDay } from '../sport-energy-day.ts';
import { scaleMacrosForSportCalories } from '../sport-macro-scaling.ts';
import { calculateTrainingCalories, mapTrainingIntensityToSportIntensity } from '../training-calories.ts';
import {
  buildExerciseSticker,
  buildLevelSticker,
  buildProgressSticker,
  buildRecapSticker,
  buildSessionSticker,
  exerciseMilestone,
  formatSetsCompact,
  recapWindow,
  type StickerData,
} from '../share/sticker-data.ts';
import { applyProgression } from '../workouts/apply-progression.ts';
import { finishActiveSession } from '../workouts/finish-session.ts';
import { activeItemToHistoryUnit } from '../workouts/progression-history.ts';
import {
  suggestProgression,
  type ProgressionHistoryUnit,
  type ProgressionSuggestion,
} from '../workouts/progression.ts';
import type {
  ActiveExercise,
  ActiveSession,
  Exercise,
  GymIntensity,
  ProgressionEvent,
  SessionSet,
  WorkoutSession,
} from '../workouts/types.ts';
import type { SaveTemplateExerciseInput } from '../workouts/workouts-api.ts';
import { trainingCardSessionCount } from '../workouts/week-day-markers.ts';

// ---------------------------------------------------------------------------
// Profile and catalog
// ---------------------------------------------------------------------------

/** 30 years, male, 180 cm, 86 kg, muscle gain, 4 sessions a week, vegan. */
const PROFILE = {
  biologicalSex: 'male' as const,
  // Age is fixed by pairing the birth date with the simulated "today".
  birthDate: new Date(1996, 0, 15),
  heightCm: 180,
  weightKg: 86,
  targetWeightKg: 84,
  activityLevel: 'lightly_active' as const,
  goalType: 'build_muscle' as const,
  diet: 'vegan',
  sessionsPerWeek: 4,
};

const MONDAY = '2026-09-28';
const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const NEXT_MONDAY = '2026-10-05';

function ex(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'names'>): Exercise {
  return {
    userId: null,
    catalogSlug: partial.id,
    kind: 'reps',
    perSide: false,
    defaultSets: 3,
    defaultReps: 8,
    defaultRepsMax: 12,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: 90,
    imageAsset: partial.id,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'variant',
    timeCapSeconds: null,
    ...partial,
  };
}

const n = (de: string, en: string, es: string) => ({ de, en, es });

/**
 * Catalog rungs as the migrations leave them (seed_exercise_catalog,
 * progression, beginner_ladder_steps). Only the ladders of the plan.
 */
const CATALOG: Exercise[] = [
  // push_horizontal
  ex({ id: 'wall_push_up', names: n('Liegestütze an der Wand', 'Wall Push-ups', 'Flexiones en la pared'), ladderKey: 'push_horizontal', ladderStep: 1, defaultReps: 10, defaultRepsMax: 20 }),
  ex({ id: 'incline_push_up', names: n('Schräge Liegestütze', 'Incline Push-ups', 'Flexiones inclinadas'), ladderKey: 'push_horizontal', ladderStep: 2, defaultReps: 8, defaultRepsMax: 15 }),
  ex({ id: 'push_up', names: n('Liegestütze', 'Push-ups', 'Flexiones'), ladderKey: 'push_horizontal', ladderStep: 3, defaultReps: 8, defaultRepsMax: 15 }),
  ex({ id: 'parallette_push_up', names: n('Liegestütze auf Parallettes', 'Parallette Push-ups', 'Flexiones en paralelas'), ladderKey: 'push_horizontal', ladderStep: 4, defaultReps: 8, defaultRepsMax: 12 }),
  ex({ id: 'archer_push_up', names: n('Archer-Liegestütze', 'Archer Push-ups', 'Flexiones arquero'), ladderKey: 'push_horizontal', ladderStep: 5, perSide: true, defaultReps: 5, defaultRepsMax: 8 }),
  ex({ id: 'pseudo_planche_push_up', names: n('Pseudo-Planche-Liegestütze', 'Pseudo Planche Push-ups', 'Flexiones pseudo plancha'), ladderKey: 'push_horizontal', ladderStep: 6, defaultReps: 5, defaultRepsMax: 10 }),
  // dip
  ex({ id: 'bench_dip_bent_knees', names: n('Bankdips, Knie gebeugt', 'Bent-Knee Bench Dips', 'Fondos en banco con rodillas flexionadas'), ladderKey: 'dip', ladderStep: 1 }),
  ex({ id: 'bench_dip', names: n('Bankdips', 'Bench Dips', 'Fondos en banco'), ladderKey: 'dip', ladderStep: 2 }),
  ex({ id: 'parallel_bar_dip', names: n('Barren-Dips', 'Parallel Bar Dips', 'Fondos en paralelas'), ladderKey: 'dip', ladderStep: 3, defaultReps: 5, defaultRepsMax: 10 }),
  ex({ id: 'straight_bar_dip', names: n('Dips an der geraden Stange', 'Straight Bar Dips', 'Fondos en barra recta'), ladderKey: 'dip', ladderStep: 4 }),
  // push_vertical
  ex({ id: 'elevated_hands_pike_push_up', names: n('Pike Push-ups, Hände erhöht', 'Elevated-Hands Pike Push-ups', 'Flexiones pike con manos elevadas'), ladderKey: 'push_vertical', ladderStep: 1 }),
  ex({ id: 'pike_push_up', names: n('Pike Push-ups', 'Pike Push-ups', 'Flexiones pike'), ladderKey: 'push_vertical', ladderStep: 2, defaultReps: 6, defaultRepsMax: 10 }),
  ex({ id: 'elevated_pike_push_up', names: n('Pike Push-ups erhöht', 'Elevated Pike Push-ups', 'Flexiones pike elevadas'), ladderKey: 'push_vertical', ladderStep: 3 }),
  ex({ id: 'wall_handstand_push_up', names: n('Handstand-Liegestütze an der Wand', 'Wall Handstand Push-ups', 'Flexiones en pino contra la pared'), ladderKey: 'push_vertical', ladderStep: 4 }),
  // hollow
  ex({ id: 'tuck_hollow_hold', names: n('Hollow Hold angehockt', 'Tuck Hollow Hold', 'Hollow hold encogido'), kind: 'time', ladderKey: 'hollow', ladderStep: 1, defaultReps: null, defaultRepsMax: null, defaultSeconds: 20, defaultSecondsMax: 40, timeCapSeconds: 60 }),
  ex({ id: 'hollow_hold', names: n('Hollow Hold', 'Hollow Hold', 'Hollow hold'), kind: 'time', ladderKey: 'hollow', ladderStep: 2, defaultReps: null, defaultRepsMax: null, defaultSeconds: 20, defaultSecondsMax: 30, timeCapSeconds: 60 }),
  // pull_vertical
  ex({ id: 'dead_hang', names: n('Hängen', 'Dead Hang', 'Colgarse'), kind: 'time', ladderKey: 'pull_vertical', ladderStep: 1 }),
  ex({ id: 'active_hang', names: n('Aktives Hängen', 'Active Hang', 'Colgarse activo'), kind: 'time', ladderKey: 'pull_vertical', ladderStep: 2 }),
  ex({ id: 'negative_pull_up', names: n('Negative Klimmzüge', 'Negative Pull-ups', 'Dominadas negativas'), ladderKey: 'pull_vertical', ladderStep: 3 }),
  ex({ id: 'chin_up', names: n('Chin-ups', 'Chin-ups', 'Dominadas supinas'), ladderKey: 'pull_vertical', ladderStep: 4 }),
  ex({ id: 'pull_up', names: n('Klimmzüge', 'Pull-ups', 'Dominadas'), ladderKey: 'pull_vertical', ladderStep: 5, defaultReps: 3, defaultRepsMax: 8 }),
  ex({ id: 'archer_pull_up', names: n('Archer-Klimmzüge', 'Archer Pull-ups', 'Dominadas arquero'), ladderKey: 'pull_vertical', ladderStep: 6, perSide: true }),
  // row
  ex({ id: 'inverted_row_bent_knees', names: n('Barren-Rudern, Knie gebeugt', 'Bent-Knee Inverted Rows', 'Remo invertido con rodillas flexionadas'), ladderKey: 'row', ladderStep: 1 }),
  ex({ id: 'inverted_row', names: n('Barren-Rudern', 'Inverted Rows', 'Remo invertido'), ladderKey: 'row', ladderStep: 2 }),
  ex({ id: 'feet_elevated_inverted_row', names: n('Barren-Rudern, Füße erhöht', 'Feet-Elevated Inverted Rows', 'Remo invertido con pies elevados'), ladderKey: 'row', ladderStep: 3 }),
  // squat_single
  ex({ id: 'box_squat', names: n('Kniebeuge zur Box', 'Box Squat', 'Sentadilla a caja'), ladderKey: 'squat_single', ladderStep: 1 }),
  ex({ id: 'bodyweight_squat', names: n('Kniebeuge', 'Bodyweight Squat', 'Sentadilla'), ladderKey: 'squat_single', ladderStep: 2 }),
  ex({ id: 'split_squat', names: n('Split Squats', 'Split Squats', 'Sentadilla dividida'), ladderKey: 'squat_single', ladderStep: 3, perSide: true }),
  ex({ id: 'bulgarian_split_squat', names: n('Bulgarian Split Squats', 'Bulgarian Split Squats', 'Sentadilla búlgara'), ladderKey: 'squat_single', ladderStep: 4, perSide: true }),
  ex({ id: 'pistol_squat_box', names: n('Pistol Squat zur Box', 'Box Pistol Squat', 'Pistol a caja'), ladderKey: 'squat_single', ladderStep: 5, perSide: true }),
  ex({ id: 'pistol_squat', names: n('Pistol Squat', 'Pistol Squat', 'Pistol'), ladderKey: 'squat_single', ladderStep: 6, perSide: true }),
  // side_plank
  ex({ id: 'side_plank_knees', names: n('Seitstütz auf den Knien', 'Kneeling Side Plank', 'Plancha lateral de rodillas'), kind: 'time', perSide: true, ladderKey: 'side_plank', ladderStep: 1, timeCapSeconds: 60 }),
  ex({ id: 'side_plank', names: n('Seitstütz', 'Side Plank', 'Plancha lateral'), kind: 'time', perSide: true, ladderKey: 'side_plank', ladderStep: 2, defaultReps: null, defaultRepsMax: null, defaultSeconds: 20, defaultSecondsMax: 40, timeCapSeconds: 60 }),
  ex({ id: 'side_plank_leg_raise', names: n('Seitstütz mit Beinheben', 'Side Plank with Leg Raise', 'Plancha lateral con elevación de pierna'), kind: 'time', perSide: true, ladderKey: 'side_plank', ladderStep: 3, timeCapSeconds: 45 }),
];
const byId = new Map(CATALOG.map((row) => [row.id, row]));
const cat = (id: string) => byId.get(id)!;

type PlanRow = {
  exerciseId: string;
  sets: number;
  reps: number | null;
  repsMax: number | null;
  seconds: number | null;
  secondsMax: number | null;
};

const row = (exerciseId: string, sets: number, lo: number, hi: number): PlanRow =>
  cat(exerciseId).kind === 'time'
    ? { exerciseId, sets, reps: null, repsMax: null, seconds: lo, secondsMax: hi }
    : { exerciseId, sets, reps: lo, repsMax: hi, seconds: null, secondsMax: null };

/** "Push" and "Pull & Legs" as the user sets them up. */
const PLAN: Record<'push' | 'pull', { name: string; shortLabel: string; rows: PlanRow[] }> = {
  push: {
    name: 'Push',
    shortLabel: 'P',
    rows: [row('push_up', 3, 8, 12), row('parallel_bar_dip', 3, 7, 10), row('pike_push_up', 3, 6, 10), row('hollow_hold', 2, 20, 30)],
  },
  pull: {
    name: 'Pull & Legs',
    shortLabel: 'PL',
    rows: [row('pull_up', 3, 3, 8), row('inverted_row', 3, 8, 12), row('bulgarian_split_squat', 3, 8, 12), row('side_plank', 2, 20, 40)],
  },
};

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

type DayPlan = {
  unit: 'push' | 'pull' | null;
  intensity: GymIntensity;
  /** Values per plan row, per set. Per-side time: [side A, side B]. */
  values: number[][];
  otherSide?: (number[] | null)[];
  durationMinutes: number;
  /** Share of the protein goal eaten. */
  proteinShare: number;
  manualRunMinutes?: number;
  weightKg?: number;
};

const WEEK: DayPlan[] = [
  // Mo: Push, normal
  { unit: 'push', intensity: 'normal', values: [[10, 9, 8], [8, 7, 7], [7, 6, 6], [25, 22]], durationMinutes: 45, proteinShare: 0.98 },
  // Di: Pull & Legs, normal
  { unit: 'pull', intensity: 'normal', values: [[6, 5, 5], [10, 9, 9], [10, 10, 9], [30, 28]], otherSide: [null, null, null, [28, 27]], durationMinutes: 50, proteinShare: 1.0 },
  // Mi: rest, protein clearly under goal
  { unit: null, intensity: 'normal', values: [], durationMinutes: 0, proteinShare: 0.6 },
  // Do: Push, push-ups at the upper bound
  { unit: 'push', intensity: 'normal', values: [[12, 12, 12], [8, 8, 7], [7, 7, 6], [26, 24]], durationMinutes: 47, proteinShare: 1.02 },
  // Fr: Pull & Legs, hard, pull-ups 8 · 8 · 8
  { unit: 'pull', intensity: 'hard', values: [[8, 8, 8], [11, 10, 10], [11, 10, 10], [32, 30]], otherSide: [null, null, null, [31, 30]], durationMinutes: 55, proteinShare: 0.97 },
  // Sa: Push, push-ups 3 × 12 again, plus a 30 min run
  { unit: 'push', intensity: 'normal', values: [[12, 12, 12], [9, 8, 8], [8, 7, 7], [28, 26]], durationMinutes: 46, proteinShare: 1.0, manualRunMinutes: 30 },
  // So: rest, weight logged
  { unit: null, intensity: 'normal', values: [], durationMinutes: 0, proteinShare: 0.95, weightKg: 85.6 },
];

function setsFor(r: PlanRow, values: number[], other: number[] | null | undefined, sessionId: string, dateKey: string, position: number): SessionSet[] {
  const exercise = cat(r.exerciseId);
  return values.map((value, index) => ({
    id: `${sessionId}-${position}-${index}`,
    sessionId,
    userId: 'sim-user',
    exerciseId: r.exerciseId,
    exerciseName: exercise.names.de,
    exercisePosition: position,
    setIndex: index,
    kind: exercise.kind,
    perSide: exercise.perSide,
    targetReps: r.reps,
    targetRepsMax: r.repsMax,
    targetSeconds: r.seconds,
    targetSecondsMax: r.secondsMax,
    // A load on a set must never reach a sticker.
    targetWeightKg: r.exerciseId === 'bulgarian_split_squat' ? 10 : null,
    reps: exercise.kind === 'time' ? null : value,
    seconds: exercise.kind === 'time' ? value : null,
    secondsOtherSide: other?.[index] ?? null,
    weightKg: r.exerciseId === 'bulgarian_split_squat' ? 10 : null,
    completedAt: `${dateKey}T${String(17 + Math.floor(position / 2)).padStart(2, '0')}:${String(10 + index * 3 + (position % 2) * 20).padStart(2, '0')}:00.000Z`,
  }));
}

function activeItem(r: PlanRow, values: number[], other: number[] | null | undefined): ActiveExercise {
  const exercise = cat(r.exerciseId);
  return {
    exerciseId: r.exerciseId,
    name: exercise.names.de,
    names: exercise.names,
    catalogSlug: exercise.catalogSlug,
    kind: exercise.kind,
    perSide: exercise.perSide,
    imageAsset: exercise.imageAsset,
    imagePath: null,
    note: null,
    targetSets: r.sets,
    targetReps: r.reps,
    targetRepsMax: r.repsMax,
    targetSeconds: r.seconds,
    targetSecondsMax: r.secondsMax,
    targetWeightKg: null,
    restSeconds: 90,
    addedInSession: false,
    skipped: false,
    sets: values.map((value, index) => ({
      id: `set-${index}`,
      value,
      done: true,
      completedAt: null,
      secondsOtherSide: other?.[index] ?? null,
    })),
  };
}

type SimSession = {
  dateKey: string;
  dayIndex: number;
  unit: 'push' | 'pull';
  intensity: GymIntensity;
  plan: PlanRow[];
  workout: WorkoutSession;
  active: ActiveSession;
  trainingSessionId: string;
  trainingKcal: number;
};

/**
 * The template the user trains from. Accepted progression changes it the way
 * the summary does (applyProgression on SaveTemplateExerciseInput rows).
 */
let pushTemplate: SaveTemplateExerciseInput[] = PLAN.push.rows.map((r, position) => ({
  exerciseId: r.exerciseId,
  position,
  targetSets: r.sets,
  targetReps: r.reps,
  targetRepsMax: r.repsMax,
  targetSeconds: r.seconds,
  targetSecondsMax: r.secondsMax,
  targetWeightKg: null,
  restSeconds: 90,
})) as SaveTemplateExerciseInput[];

const sessions: SimSession[] = [];
const events: ProgressionEvent[] = [];
const suggestionsByDay: Record<string, ProgressionSuggestion[]> = {};
const trainingRows: { id: string; loggedOn: string; kcal: number; intensity: GymIntensity; activity: 'strength' | 'other' }[] = [];

/** Finish a session the way the app does: one training_sessions row, linked once. */
async function finish(active: ActiveSession, intensity: GymIntensity, durationMinutes: number) {
  const inserted: string[] = [];
  const result = await finishActiveSession(
    active,
    { intensity, userId: active.userId, queryClient: {} as never, finishedAt: active.finishedAt ?? undefined, durationMinutes },
    {
      flush: async () => {},
      peekQueueLength: () => 0,
      enqueueUpsertSession: () => {},
      enqueueUpsertSets: () => {},
      fetchLatestWeightKg: async () => PROFILE.weightKg,
      insertTrainingSession: async (params) => {
        const id = `ts-${active.sessionId}`;
        inserted.push(id);
        trainingRows.push({
          id,
          loggedOn: params.loggedOn,
          kcal: calculateTrainingCalories({ activity: params.activity, weightKg: params.weightKg, durationMinutes: params.durationMinutes, intensity: params.intensity }),
          intensity: params.intensity,
          activity: params.activity,
        });
        return { id };
      },
      upsertWorkoutSession: async () => {},
      invalidateTrainingQueries: async () => {},
      captureException: () => {},
    },
  );
  return { result, inserted };
}

/** History units newest first, as the summary feeds suggestProgression. */
function historyFor(exerciseId: string, before: SimSession[]): ProgressionHistoryUnit[] {
  return before
    .slice()
    .reverse()
    .flatMap((s) => {
      const index = s.plan.findIndex((r) => r.exerciseId === exerciseId);
      return index < 0 ? [] : [activeItemToHistoryUnit(s.active.items[index], s.active.sessionId, s.intensity)];
    });
}

function planFromTemplate(unit: 'push' | 'pull'): PlanRow[] {
  if (unit === 'pull') {
    return PLAN.pull.rows;
  }
  return pushTemplate.map((t) => ({
    exerciseId: t.exerciseId,
    sets: t.targetSets,
    reps: t.targetReps,
    repsMax: t.targetRepsMax,
    seconds: t.targetSeconds,
    secondsMax: t.targetSecondsMax,
  }));
}

const finishes: { dateKey: string; inserted: string[]; again: string[] }[] = [];

/** Plays the week once, in order. Called by `before`-style lazy init. */
let played = false;
async function playWeek() {
  if (played) {
    return;
  }
  played = true;
  for (let dayIndex = 0; dayIndex < WEEK.length; dayIndex += 1) {
    const day = WEEK[dayIndex]!;
    const dateKey = DAYS[dayIndex]!;
    if (day.unit) {
      const plan = planFromTemplate(day.unit);
      const sessionId = `ws-${dateKey}`;
      const items = plan.map((r, i) => activeItem(r, day.values[i] ?? [], day.otherSide?.[i]));
      const startedAt = `${dateKey}T17:00:00.000Z`;
      const finishedAt = new Date(Date.parse(startedAt) + day.durationMinutes * 60_000).toISOString();
      const active: ActiveSession = {
        sessionId,
        userId: 'sim-user',
        templateId: day.unit,
        templateName: PLAN[day.unit].name,
        shortLabel: PLAN[day.unit].shortLabel,
        colorKey: 'indigo',
        startedAt,
        loggedOn: dateKey,
        finishedAt,
        intensity: day.intensity,
        trainingSessionId: null,
        phase: 'summary',
        items,
        cursor: { exerciseIndex: 0, setIndex: 0 },
        summaryDraft: { intensity: day.intensity, adopt: {}, addToTemplate: {}, decisions: {} },
      };

      // Summary: suggestions from this unit plus earlier ones (newest first).
      const suggestions: ProgressionSuggestion[] = [];
      plan.forEach((r, i) => {
        const exercise = cat(r.exerciseId);
        const suggestion = suggestProgression({
          exercise,
          ladder: CATALOG.filter((c) => c.ladderKey === exercise.ladderKey),
          currentTarget: { targetSets: r.sets, targetReps: r.reps, targetRepsMax: r.repsMax, targetSeconds: r.seconds, targetSecondsMax: r.secondsMax },
          history: [activeItemToHistoryUnit(items[i]!, sessionId, day.intensity), ...historyFor(r.exerciseId, sessions)],
          templateExerciseIds: plan.map((p) => p.exerciseId),
          lastEvents: events.filter((ev) => ev.fromExerciseId === r.exerciseId),
        });
        if (suggestion) {
          suggestions.push(suggestion);
        }
      });
      suggestionsByDay[dateKey] = suggestions;

      // Thursday: the user sees the level-up and moves on without deciding.
      // Saturday: accepts it (the user flow of day 3 in the app test).
      if (dateKey === DAYS[5]) {
        for (const suggestion of suggestions.filter((s) => s.kind === 'variant_up')) {
          pushTemplate = applyProgression(pushTemplate, suggestion);
          events.push({
            id: `ev-${dateKey}-${suggestion.exerciseId}`,
            userId: 'sim-user',
            templateId: 'push',
            sessionId,
            kind: 'variant_up',
            fromExerciseId: suggestion.exerciseId,
            toExerciseId: suggestion.toExerciseId,
            fromTarget: suggestion.fromTarget,
            toTarget: suggestion.toTarget,
            status: 'accepted',
            createdAt: `${dateKey}T18:00:00.000Z`,
          });
          const index = plan.findIndex((p) => p.exerciseId === suggestion.exerciseId);
          active.summaryDraft.decisions[index] = 'accept';
        }
      }

      const { result, inserted } = await finish(active, day.intensity, day.durationMinutes);
      assert.equal(result.ok, true);
      // Retrying a finish that already linked a row must not insert a second one.
      const again = await finish({ ...active, trainingSessionId: inserted[0] ?? null }, day.intensity, day.durationMinutes);
      finishes.push({ dateKey, inserted, again: again.inserted });

      const workout: WorkoutSession = {
        id: sessionId,
        userId: 'sim-user',
        templateId: day.unit,
        templateName: PLAN[day.unit].name,
        shortLabel: PLAN[day.unit].shortLabel,
        colorKey: 'indigo',
        loggedOn: dateKey,
        startedAt,
        finishedAt,
        intensity: day.intensity,
        trainingSessionId: inserted[0] ?? null,
        createdAt: startedAt,
        sets: plan.flatMap((r, i) => setsFor(r, day.values[i] ?? [], day.otherSide?.[i], sessionId, dateKey, i)),
      };
      sessions.push({
        dateKey,
        dayIndex,
        unit: day.unit,
        intensity: day.intensity,
        plan,
        workout,
        active,
        trainingSessionId: inserted[0]!,
        trainingKcal: trainingRows.find((t) => t.id === inserted[0])?.kcal ?? 0,
      });
    }
    if (day.manualRunMinutes) {
      // There is no "running" activity in the logger; the run goes in as "other".
      trainingRows.push({
        id: `ts-run-${dateKey}`,
        loggedOn: dateKey,
        kcal: calculateTrainingCalories({ activity: 'other', weightKg: PROFILE.weightKg, durationMinutes: day.manualRunMinutes, intensity: 'normal' }),
        intensity: 'normal',
        activity: 'other',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

const today = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

function baseGoal(calorieSource: CalorieSource) {
  const maintenance = calculateMaintenanceCalories({
    biologicalSex: PROFILE.biologicalSex,
    birthDate: PROFILE.birthDate,
    heightCm: PROFILE.heightCm,
    weightKg: PROFILE.weightKg,
    activityLevel: PROFILE.activityLevel,
    calorieSource,
    today: today(MONDAY),
  });
  const dailyCalorieGoal = applyGoalAdjustment({
    weightKg: PROFILE.weightKg,
    maintenanceCalories: maintenance,
    goalType: PROFILE.goalType,
  });
  const macros = computeMacroGoals({
    dailyCalorieGoal,
    weightKg: PROFILE.weightKg,
    heightCm: PROFILE.heightCm,
    targetWeightKg: PROFILE.targetWeightKg,
    goalType: PROFILE.goalType,
    dietPreference: PROFILE.diet,
    birthDate: '1996-01-15',
  });
  return { maintenance, dailyCalorieGoal, macros };
}

/**
 * The day's goal as Home shows it with Apple Health connected: base + active
 * energy, training_sessions counted through buildSportEnergyDay (only then
 * does the home screen compute a sport energy day, home.tsx:203).
 */
function healthDayGoal(dateKey: string, activeEnergyBaselineKcal: number) {
  const { dailyCalorieGoal, macros } = baseGoal(CalorieSource.HEALTH);
  const rows = trainingRows.filter((t) => t.loggedOn === dateKey);
  const sportDay = buildSportEnergyDay({
    activeEnergyKcal: activeEnergyBaselineKcal,
    workouts: [],
    trainingSessions: rows.map((t) => ({
      activity: t.activity,
      kcal: t.kcal,
      intensity: mapTrainingIntensityToSportIntensity(t.intensity),
      label: t.activity,
    })),
    sessionsPerWeek: PROFILE.sessionsPerWeek,
    baselineLabel: 'Alltag',
  });
  const scaled = scaleMacrosForSportCalories({
    basisKcal: dailyCalorieGoal,
    segments: sportDay.segments,
    proteinG: macros.proteinG!,
    fatBasisG: macros.fatG!,
    carbsBasisG: macros.carbsG!,
    weightKg: PROFILE.weightKg,
  });
  assert.equal(scaled.ok, true);
  const calorieGoal = resolveEffectiveDailyCalorieGoal({
    calorieSource: CalorieSource.HEALTH,
    baseDailyGoal: dailyCalorieGoal,
    activeEnergyBurnedKcal: sportDay.totalActiveKcal,
  });
  return {
    calorieGoal,
    trainingKcal: rows.reduce((sum, t) => sum + t.kcal, 0),
    activeKcal: sportDay.totalActiveKcal,
    ...(scaled.ok ? { proteinG: scaled.proteinG, carbsG: scaled.carbsG, fatG: scaled.fatG } : { proteinG: 0, carbsG: 0, fatG: 0 }),
  };
}

/** Without Health (the fresh anonymous user): the stored base, every day. */
function activityFactorDayGoal() {
  const { dailyCalorieGoal, macros } = baseGoal(CalorieSource.ACTIVITY_FACTOR);
  return {
    calorieGoal: resolveEffectiveDailyCalorieGoal({
      calorieSource: CalorieSource.ACTIVITY_FACTOR,
      baseDailyGoal: dailyCalorieGoal,
      activeEnergyBurnedKcal: 0,
    }),
    proteinG: macros.proteinG!,
    carbsG: macros.carbsG!,
    fatG: macros.fatG!,
  };
}

// ---------------------------------------------------------------------------
// Report output
// ---------------------------------------------------------------------------

const out: Record<string, unknown> = {};
after(() => {
  const file = process.env.WEEK_SIM_OUT;
  if (file) {
    writeFileSync(file, JSON.stringify(out, null, 2));
  }
});

const SENSITIVE = /weight|kg\b|kcal|calor|waist|bodyfat|body_fat|lean|height|bmi/i;
function assertNoSensitive(label: string, data: StickerData) {
  const text = JSON.stringify(data);
  assert.equal(SENSITIVE.test(text), false, `${label} carries sensitive data: ${text}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('week simulation', () => {
  it('1a goals with Health: training days above rest days, protein constant, carbs and fat follow intensity', async () => {
    await playWeek();
    const baseline = 350;
    const rows = DAYS.map((dateKey, i) => ({ day: DAY_NAMES[i], dateKey, ...healthDayGoal(dateKey, baseline) }));
    out.goalsHealth = rows;
    const rest = rows.filter((r) => r.trainingKcal === 0);
    const training = rows.filter((r) => r.trainingKcal > 0);
    for (const t of training) {
      for (const r of rest) {
        assert.ok(t.calorieGoal > r.calorieGoal, `${t.day} ${t.calorieGoal} should exceed ${r.day} ${r.calorieGoal}`);
      }
    }
    assert.equal(new Set(rows.map((r) => r.proteinG)).size, 1, 'protein stays constant');
    // Friday is "hard": more of the extra energy goes to carbs than on a normal day.
    const mon = rows[0]!;
    const fri = rows[4]!;
    const restDay = rows[2]!;
    const carbShare = (r: typeof mon) => (r.carbsG - restDay.carbsG) * 4 / (r.calorieGoal - restDay.calorieGoal);
    assert.ok(carbShare(fri) > carbShare(mon), `hard ${carbShare(fri)} vs normal ${carbShare(mon)}`);
    assert.ok(fri.fatG >= restDay.fatG && mon.fatG >= restDay.fatG);
  });

  it('1 report data: goals without Health', async () => {
    await playWeek();
    out.goalsNoHealth = activityFactorDayGoal();
    out.maintenance = { activityFactor: baseGoal(CalorieSource.ACTIVITY_FACTOR).maintenance, health: baseGoal(CalorieSource.HEALTH).maintenance };
  });

  it(
    '1b expectation differs: without Health the goal is the same on training and rest days',
    { skip: 'Actual behaviour, see REPORT-week-test.md: training energy reaches the day goal only with Apple Health connected (home.tsx:203).' },
    async () => {
      await playWeek();
      const goal = activityFactorDayGoal();
      for (const dateKey of DAYS) {
        assert.equal(activityFactorDayGoal().calorieGoal, goal.calorieGoal, dateKey);
      }
    },
  );

  it(
    '1c expectation differs: "Muskelaufbau" has no deficit, the goal is maintenance',
    { skip: 'Actual behaviour, see REPORT-week-test.md: build_muscle is recomposition at maintenance (GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK.build_muscle = 0).' },
    async () => {
      const goal = activityFactorDayGoal();
      assert.equal(goal.calorieGoal, baseGoal(CalorieSource.ACTIVITY_FACTOR).maintenance);
    },
  );

  it('2 training energy is plausible and each unit is counted once', async () => {
    await playWeek();
    out.trainingEnergy = trainingRows;
    out.finishes = finishes;
    for (const f of finishes) {
      assert.equal(f.inserted.length, 1, `${f.dateKey}: one training row`);
      assert.equal(f.again.length, 0, `${f.dateKey}: a repeated finish inserts nothing`);
    }
    for (const t of trainingRows.filter((r) => r.activity === 'strength')) {
      assert.ok(t.kcal >= 200 && t.kcal <= 500, `${t.loggedOn} strength ${t.kcal} kcal`);
    }
    const run = trainingRows.find((r) => r.activity === 'other')!;
    assert.ok(run.kcal >= 150 && run.kcal <= 300, `run ${run.kcal}`);
    // Saturday: workout + run, both counted, the workout once.
    const sat = trainingRows.filter((r) => r.loggedOn === DAYS[5]);
    assert.equal(sat.length, 2);
  });

  it('3a first level-up suggestion for push-ups comes on Thursday (3 × 12 at the upper bound)', async () => {
    await playWeek();
    const pushUps = (key: string) =>
      (suggestionsByDay[key] ?? []).filter((s) => s.exerciseId === 'push_up').map((s) => `${s.kind}→${s.toExerciseId}`);
    out.pushUpSuggestions = Object.fromEntries(DAYS.map((d, i) => [DAY_NAMES[i], pushUps(d)]));
    assert.deepEqual(pushUps(DAYS[0]!), []);
    assert.deepEqual(pushUps(DAYS[3]!), ['variant_up→parallette_push_up']);
    assert.deepEqual(pushUps(DAYS[5]!), ['variant_up→parallette_push_up']);
  });

  it('3b "hard" needs two successes: Friday pull-ups 8 · 8 · 8 alone do not level up', async () => {
    await playWeek();
    const fri = (suggestionsByDay[DAYS[4]!] ?? []).filter((s) => s.exerciseId === 'pull_up');
    out.pullUpFriday = fri;
    assert.deepEqual(fri, []);
    // The same unit as "normal" would have been enough.
    const friday = sessions.find((s) => s.dateKey === DAYS[4])!;
    const r = friday.plan[0]!;
    const normal = suggestProgression({
      exercise: cat('pull_up'),
      ladder: CATALOG.filter((c) => c.ladderKey === 'pull_vertical'),
      currentTarget: { targetSets: r.sets, targetReps: r.reps, targetRepsMax: r.repsMax, targetSeconds: null, targetSecondsMax: null },
      history: [activeItemToHistoryUnit(friday.active.items[0]!, friday.active.sessionId, 'normal')],
      templateExerciseIds: friday.plan.map((p) => p.exerciseId),
      lastEvents: [],
    });
    assert.equal(normal?.kind, 'variant_up');
    assert.equal(normal?.toExerciseId, 'archer_pull_up');
  });

  it('3c after accepting: the plan holds the next rung with its own targets', async () => {
    await playWeek();
    const first = pushTemplate[0]!;
    out.pushTemplateAfter = pushTemplate.map((t) => ({ exerciseId: t.exerciseId, sets: t.targetSets, reps: t.targetReps, max: t.targetRepsMax }));
    assert.equal(first.exerciseId, 'parallette_push_up');
    assert.deepEqual([first.targetSets, first.targetReps, first.targetRepsMax], [3, 8, 12]);
  });

  it('4 personal bests and "Zum ersten Mal" per unit', async () => {
    await playWeek();
    const perUnit = sessions.map((s, index) => {
      const earlier = sessions.slice(0, index);
      const marks = s.plan.map((r, i) => {
        const best = Math.max(...s.active.items[i]!.sets.map((set) => set.value));
        const prior = earlier
          .flatMap((e) => e.workout.sets.filter((set) => set.exerciseId === r.exerciseId))
          .map((set) => (set.kind === 'time' ? set.seconds : set.reps) ?? 0);
        return { exerciseId: r.exerciseId, milestone: exerciseMilestone({ sessionBest: best, priorBest: prior.length ? Math.max(...prior) : null, historyLoaded: true }) };
      });
      return { day: DAY_NAMES[s.dayIndex], unit: s.unit, marks };
    });
    out.milestones = perUnit;
    assert.ok(perUnit[0]!.marks.every((m) => m.milestone === 'firstTime'), 'Monday: all first time');
    assert.ok(perUnit[1]!.marks.every((m) => m.milestone === 'firstTime'), 'Tuesday: all first time');
    const thu = perUnit[2]!.marks;
    assert.equal(thu.find((m) => m.exerciseId === 'push_up')!.milestone, 'newBest');
    const fri = perUnit[3]!.marks;
    assert.equal(fri.find((m) => m.exerciseId === 'pull_up')!.milestone, 'newBest');
    const sat = perUnit[4]!.marks;
    // 12 again is not a new best.
    assert.equal(sat.find((m) => m.exerciseId === 'push_up')!.milestone, null);
  });

  it('5 week card "Diese Woche n von 4" per day', async () => {
    await playWeek();
    const perDay = DAYS.map((dateKey, i) => ({
      day: DAY_NAMES[i],
      count: trainingCardSessionCount({
        rangeDays: 7,
        rangeStartKey: DAYS[0]!,
        todayKey: dateKey,
        manualSessions: trainingRows.filter((t) => t.loggedOn <= dateKey),
        workoutSessions: sessions.filter((s) => s.dateKey <= dateKey).map((s) => s.workout),
      }),
    }));
    out.weekCard = perDay;
    assert.deepEqual(perDay.map((d) => d.count), [1, 2, 2, 3, 4, 5, 5]);
  });

  it('6 recap "Meine Woche" on Sunday and the following Monday, "Mein Monat"', async () => {
    await playWeek();
    const nameOf = (best: { exerciseId: string | null; exerciseName: string }) =>
      best.exerciseId ? cat(best.exerciseId).names.de : best.exerciseName;
    const beforeBests = (startKey: string) => {
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
    const proteinDays = DAYS.map((date, i) => ({ date, hit: WEEK[i]!.proteinShare >= 1 }));
    const build = (period: 'week' | 'month', todayKey: string) =>
      buildRecapSticker(period, {
        todayKey,
        workoutSessions: sessions.map((s) => s.workout),
        manualSessions: trainingRows,
        beforeBests: beforeBests(recapWindow(period, todayKey).startKey),
        events: events,
        proteinDays,
        nameOf,
      });
    const sunday = build('week', DAYS[6]!);
    const monday = build('week', NEXT_MONDAY);
    const month = build('month', DAYS[6]!);
    out.recap = { sunday, monday, month };
    for (const [label, r] of Object.entries({ sunday, monday, month })) {
      assertNoSensitive(`recap ${label}`, r);
    }
    // 5 units + the unlinked run; the linked training rows are not counted twice.
    assert.equal(sunday.sessions, 6);
    assert.equal(sunday.levelsCount, 1);
    // Rolling window: next Monday drops last Monday's Push.
    assert.equal(monday.sessions, 5);
    assert.equal(month.sessions, 6);
    assert.equal(sunday.proteinHitDays, 3);
  });

  it(
    '6b expectation differs: the first week shows no personal bests in "Meine Woche"',
    { skip: 'Actual behaviour, see REPORT-week-test.md: bests compare with the best before the window; a first execution is no best, so week one shows 0 bests and no biggest gain although reps rose within the week.' },
    async () => {
      await playWeek();
      const recap = buildRecapSticker('week', {
        todayKey: DAYS[6]!,
        workoutSessions: sessions.map((s) => s.workout),
        manualSessions: trainingRows,
        beforeBests: {},
        events,
        proteinDays: [],
        nameOf: (best) => best.exerciseName,
      });
      assert.equal(recap.bestsCount, 0);
      assert.equal(recap.biggestGain, null);
    },
  );

  it('7 all five sticker objects carry the right content and nothing sensitive', async () => {
    await playWeek();
    const fri = sessions.find((s) => s.dateKey === DAYS[4])!;
    const bulgarianIndex = fri.plan.findIndex((r) => r.exerciseId === 'bulgarian_split_squat');
    const exercise = buildExerciseSticker({
      exercise: cat('bulgarian_split_squat'),
      fallbackName: 'x',
      lang: 'de',
      exerciseKind: 'reps',
      perSide: true,
      values: fri.active.items[bulgarianIndex]!.sets.map((s) => s.value),
      ladder: CATALOG,
      milestone: 'newBest',
    });
    const level = buildLevelSticker({ toExercise: cat('parallette_push_up'), fromExercise: cat('push_up'), lang: 'de', ladder: CATALOG });
    const session = buildSessionSticker({
      name: fri.active.templateName,
      dateKey: fri.dateKey,
      durationMinutes: 55,
      totals: { reps: fri.active.items.filter((i) => i.kind !== 'time').flatMap((i) => i.sets).reduce((sum, s) => sum + s.value, 0), seconds: 0 },
      items: fri.active.items.map((item) => ({ exerciseId: item.exerciseId, name: item.name, exerciseKind: item.kind, values: item.sets.map((s) => s.value) })),
      bestsCount: 3,
      suggestions: [],
      decisions: {},
    });
    const progress = buildProgressSticker({
      exerciseId: 'push_up',
      exercises: CATALOG,
      units: sessions.map((s) => ({ sessionId: s.workout.id, loggedOn: s.dateKey, sets: s.workout.sets })),
      todayKey: DAYS[6]!,
      lang: 'de',
    });
    out.stickers = { exercise, level, session, progress, exerciseSets: formatSetsCompact(exercise.values, 'reps') };
    assert.equal(exercise.name, 'Bulgarian Split Squats');
    assert.deepEqual(exercise.level, { step: 4, total: 6 });
    assert.equal(formatSetsCompact(exercise.values, 'reps'), '11 · 10 · 10');
    assert.equal(level?.name, 'Liegestütze auf Parallettes');
    assert.deepEqual(level?.level, { step: 4, total: 6 });
    assert.equal(level?.previousName, 'Liegestütze');
    assert.equal(session.name, 'Pull & Legs');
    assert.equal(session.topExercises[0]?.name, 'Barren-Rudern');
    // One week of history: only "seit Beginn", 10 → 12 over three Push units.
    assert.deepEqual(Object.keys(progress.views), ['all']);
    assert.deepEqual([progress.views.all!.start.value, progress.views.all!.current.value], [10, 12]);
    for (const [label, data] of Object.entries({ exercise, level: level!, session, progress })) {
      assertNoSensitive(label, data);
    }
  });

  it('8 evaluation sentence on Wednesday and Sunday', async () => {
    await playWeek();
    const goal = activityFactorDayGoal();
    /**
     * Shell for buildHistorySummaryStats (lib/history.ts cannot load under
     * node): averages over closed days with meals, today excluded.
     */
    const summaryOn = (todayKey: string): HistorySummaryStats => {
      const closed = DAYS.map((date, i) => ({ date, day: WEEK[i]! })).filter((d) => d.date < todayKey);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
      const protein = closed.map((d) => goal.proteinG * d.day.proteinShare);
      return {
        calorieAvg: avg(closed.map(() => goal.calorieGoal * 0.98)),
        calorieGoalAvg: goal.calorieGoal,
        proteinAvg: avg(protein),
        proteinGoalAvg: goal.proteinG,
        proteinHitDays: closed.filter((d) => d.day.proteinShare >= 1).length,
        proteinTrackedDays: closed.length,
        carbsAvg: goal.carbsG,
        carbsGoalAvg: goal.carbsG,
        fatAvg: goal.fatG,
        fatGoalAvg: goal.fatG,
        fiberAvg: 32,
        fiberGoalAvg: 32,
        loggedDays: closed.length,
        rangeDayCount: closed.length,
      };
    };
    const headlineOn = (todayKey: string): BalanceSummaryHeadline | null => {
      const summary = summaryOn(todayKey);
      return computeBalanceSummaryHeadline({
        summary,
        referenceWeightKg: PROFILE.weightKg,
        macroAccuracy: accuracyFromTrackedDays(summary.proteinTrackedDays),
      });
    };
    const wednesday = headlineOn(DAYS[2]!);
    const sunday = headlineOn(DAYS[6]!);
    out.headline = { wednesday, sunday, wednesdayAccuracy: accuracyFromTrackedDays(2), sundayAccuracy: accuracyFromTrackedDays(6) };
    // Two closed days are too thin for a claim.
    assert.equal(wednesday, null);
    // Wednesday's low protein pulls the week's average under the goal.
    assert.equal(sunday?.kind, 'small');
    assert.equal(sunday && 'nutrient' in sunday ? sunday.nutrient : null, 'protein');
  });

  it('9 imperial: distances in mi, weight in lb, foods stay in grams', () => {
    const km = 5.2;
    const metric = formatDistanceKm({ distanceKm: km, unitSystem: 'metric', kmLabel: 'km', miLabel: 'mi' });
    const imperial = formatDistanceKm({ distanceKm: km, unitSystem: 'imperial', kmLabel: 'km', miLabel: 'mi' });
    const weight = formatWeightForDisplay({ weightKg: 85.6, unitSystem: 'imperial', kgLabel: 'kg', lbsLabel: 'lb' });
    out.imperial = { metric, imperial, weight };
    assert.equal(metric, '5.2 km');
    assert.equal(imperial, '3.2 mi');
    assert.match(weight, /^188(\.\d)? lb$/);
    // Foods: meals.ts formats stored g/ml and ignores the unit system
    // (formatTodayMealQuantityLabel's `_unitSystem`); that module cannot load
    // under node, so this is documented in the report rather than asserted.
  });
});
