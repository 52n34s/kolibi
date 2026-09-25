/**
 * Rule based plan builder for the plan wizard (Block 2.3). Pure: same answers,
 * same plan. No AI — fixed rules over the PLAN_CATALOG snapshot.
 *
 * Rules in short:
 * - Split: 2–3 days full body A/B, 4 days Push + Pull & Legs, 5 days Push,
 *   Pull, Legs; "single" scope builds one session for the focus.
 * - Exercises per session by minutes (20→3 … 75+→7), one of them core from 30.
 * - Start rung per ladder from the assessment, nearest rung the gear allows.
 * - Sets: 3, beginners 2 (the first two exercises of a session keep 3), lots of
 *   cardio −1 per leg exercise, focus +1 while the time budget allows.
 * - Rest: fat loss shorter, strength & skills longer with lower rep ranges.
 *
 * Side effects (catalog lookup, save) live in apply-built-plan.ts.
 */

import {
  PLAN_CATALOG,
  getPlanCatalogEntry,
  hasPlanEquipment,
  planCatalogName,
  planLadder,
  type PlanCatalogEntry,
  type PlanEquipment,
  type PlanMuscle,
} from '@/lib/workouts/plan-catalog';
import type { ExerciseKind, UnitColorKey } from '@/lib/workouts/types';

export type PlanGoal = 'muscle' | 'strength_skills' | 'fat_loss' | 'fitness';
export type PlanDays = 2 | 3 | 4 | 5;
/** 75 stands for "75+". */
export type PlanMinutes = 20 | 30 | 45 | 60 | 75;
/** Index of the answer bucket, 0 = lowest (e.g. 0 push-ups). */
export type AssessmentLevel = 0 | 1 | 2 | 3;
export type PlanAssessment = {
  push: AssessmentLevel;
  pull: AssessmentLevel;
  legs: AssessmentLevel;
};
export type PlanFocus = 'balanced' | 'upper' | 'chest_shoulders' | 'back' | 'legs';
export type PlanCardio = 'none' | 'some' | 'lots';
export type PlanScope = 'full' | 'single';

export type PlanWizardAnswers = {
  goal: PlanGoal;
  days: PlanDays;
  minutes: PlanMinutes;
  /** Empty = nothing. */
  equipment: PlanEquipment[];
  assessment: PlanAssessment;
  focus: PlanFocus;
  cardio: PlanCardio;
  scope: PlanScope;
};

export const PLAN_GOALS: readonly PlanGoal[] = ['muscle', 'strength_skills', 'fat_loss', 'fitness'];
export const PLAN_DAYS: readonly PlanDays[] = [2, 3, 4, 5];
export const PLAN_MINUTES: readonly PlanMinutes[] = [20, 30, 45, 60, 75];
export const ASSESSMENT_LEVELS: readonly AssessmentLevel[] = [0, 1, 2, 3];
export const PLAN_FOCUSES: readonly PlanFocus[] = [
  'balanced',
  'upper',
  'chest_shoulders',
  'back',
  'legs',
];
export const PLAN_CARDIO: readonly PlanCardio[] = ['none', 'some', 'lots'];
export const PLAN_SCOPES: readonly PlanScope[] = ['full', 'single'];

export type PlanSessionKind =
  | 'full_a'
  | 'full_b'
  | 'full'
  | 'push'
  | 'pull_legs'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'chest_shoulders'
  | 'back';

export type BuiltPlanExercise = {
  slug: string;
  kind: ExerciseKind;
  perSide: boolean;
  muscle: PlanMuscle;
  sets: number;
  targetMin: number;
  targetMax: number;
  restSeconds: number;
};

export type BuiltPlanSession = {
  kind: PlanSessionKind;
  /** i18n key, e.g. planWizard.sessions.full_a → "Ganzkörper A". */
  nameKey: string;
  /** i18n key for the 1–2 letter unit label. */
  shortLabelKey: string;
  color: UnitColorKey;
  exercises: BuiltPlanExercise[];
  estimatedMinutes: number;
};

/**
 * Hints for the preview when the gear changed what the rules would pick.
 * pull_alternative: no bar or rings, so rows and pull-ups became a backpack
 * row or Y-T-W raises.
 */
export type BuiltPlanNote = 'pull_alternative';

export type BuiltPlan = {
  /** Training days the plan is meant for; null for a single session. */
  sessionsPerWeek: number | null;
  sessions: BuiltPlanSession[];
  notes: BuiltPlanNote[];
};

/** Same work estimate as template minutes (training-panel-utils): 45 s per set. */
export const PLAN_WORK_SECONDS_PER_SET = 45;

const EXERCISES_PER_SESSION: Record<PlanMinutes, number> = {
  20: 3,
  30: 4,
  45: 5,
  60: 6,
  75: 7,
};

const SESSION_COLORS: readonly UnitColorKey[] = ['indigo', 'violet', 'teal', 'amber', 'sky'];

const MAX_SETS = 5;
const MIN_SETS_AFTER_CUTS = 2;

type CoreLadder = 'hollow' | 'side_plank' | 'hanging' | 'l_sit';

/**
 * Non-core slots in priority order. "…2" slots are a second rung of the same
 * ladder one step below the first; they only fill long sessions.
 */
type Slot =
  | 'push_h'
  | 'push_v'
  | 'dip'
  | 'pull_v'
  | 'row'
  | 'squat'
  | 'bridge'
  | 'ytw'
  | 'backpack_curl'
  | 'push_h2'
  | 'push_v2'
  | 'dip2'
  | 'pull_v2'
  | 'row2'
  | 'squat2'
  | 'bridge2';

type SessionBlueprint = { slots: readonly Slot[]; core: readonly CoreLadder[] };

const FULL_A: SessionBlueprint = {
  slots: ['push_h', 'pull_v', 'squat', 'dip', 'bridge', 'row', 'push_v', 'push_h2', 'squat2'],
  core: ['hollow', 'side_plank', 'hanging'],
};

const PUSH: SessionBlueprint = {
  slots: ['push_h', 'push_v', 'dip', 'push_h2', 'push_v2', 'dip2'],
  core: ['hollow', 'l_sit', 'side_plank'],
};

const PULL: SessionBlueprint = {
  slots: ['pull_v', 'row', 'ytw', 'backpack_curl', 'pull_v2', 'row2'],
  core: ['hanging', 'hollow', 'side_plank'],
};

const BLUEPRINTS: Record<PlanSessionKind, SessionBlueprint> = {
  full_a: FULL_A,
  full: FULL_A,
  full_b: {
    slots: ['row', 'push_v', 'bridge', 'squat', 'pull_v', 'dip', 'push_h', 'row2', 'bridge2'],
    core: ['side_plank', 'hanging', 'hollow'],
  },
  push: PUSH,
  chest_shoulders: {
    slots: ['push_h', 'push_v', 'dip', 'push_h2', 'push_v2', 'dip2', 'ytw'],
    core: ['hollow', 'l_sit', 'side_plank'],
  },
  pull: PULL,
  back: PULL,
  legs: {
    slots: ['squat', 'bridge', 'squat2', 'bridge2'],
    core: ['side_plank', 'hanging', 'hollow'],
  },
  pull_legs: {
    slots: ['pull_v', 'squat', 'row', 'bridge', 'ytw', 'squat2', 'backpack_curl', 'bridge2'],
    core: ['hanging', 'side_plank', 'hollow'],
  },
  upper: {
    slots: ['push_h', 'pull_v', 'push_v', 'row', 'dip', 'ytw', 'backpack_curl', 'push_h2'],
    core: ['hollow', 'side_plank', 'hanging'],
  },
};

const SLOT_LADDER: Partial<Record<Slot, string>> = {
  push_h: 'push_horizontal',
  push_h2: 'push_horizontal',
  push_v: 'push_vertical',
  push_v2: 'push_vertical',
  dip: 'dip',
  dip2: 'dip',
  pull_v: 'pull_vertical',
  pull_v2: 'pull_vertical',
  row: 'row',
  row2: 'row',
  squat: 'squat_single',
  squat2: 'squat_single',
  bridge: 'bridge',
  bridge2: 'bridge',
};

const SECONDARY_OF: Partial<Record<Slot, Slot>> = {
  push_h2: 'push_h',
  push_v2: 'push_v',
  dip2: 'dip',
  pull_v2: 'pull_v',
  row2: 'row',
  squat2: 'squat',
  bridge2: 'bridge',
};

const FOCUS_MUSCLES: Record<PlanFocus, readonly PlanMuscle[]> = {
  balanced: [],
  upper: ['push', 'pull'],
  chest_shoulders: ['push'],
  back: ['pull'],
  legs: ['legs', 'hips'],
};

const SINGLE_SESSION_FOR_FOCUS: Record<PlanFocus, PlanSessionKind> = {
  balanced: 'full',
  upper: 'upper',
  chest_shoulders: 'chest_shoulders',
  back: 'back',
  legs: 'legs',
};

/** Session kinds per training week, in rotation order. */
export function planSessionKinds(answers: Pick<PlanWizardAnswers, 'days' | 'scope' | 'focus'>): PlanSessionKind[] {
  if (answers.scope === 'single') {
    return [SINGLE_SESSION_FOR_FOCUS[answers.focus]];
  }
  if (answers.days >= 5) {
    return ['push', 'pull', 'legs'];
  }
  if (answers.days === 4) {
    return ['push', 'pull_legs'];
  }
  return ['full_a', 'full_b'];
}

export function exercisesPerSession(minutes: PlanMinutes): number {
  return EXERCISES_PER_SESSION[minutes];
}

/** Core has no own question: rounded mean of the three assessments. */
export function coreLevel(assessment: PlanAssessment): AssessmentLevel {
  const mean = (assessment.push + assessment.pull + assessment.legs) / 3;
  return Math.min(3, Math.max(0, Math.round(mean))) as AssessmentLevel;
}

function levelForMuscle(muscle: PlanMuscle, assessment: PlanAssessment): AssessmentLevel {
  switch (muscle) {
    case 'push':
      return assessment.push;
    case 'pull':
      return assessment.pull;
    case 'legs':
    case 'hips':
      return assessment.legs;
    case 'core':
      return coreLevel(assessment);
  }
}

/**
 * Target ladder step for the assessment, before gear is applied. null = the
 * ladder is left out at this level (L-sit for beginners).
 *
 * pull_vertical: 0 pull-ups start on negatives (plus rows); only when push-ups
 * are at 0 as well the hang rungs from the beginner migration come first.
 */
export function startLadderStep(ladderKey: string, assessment: PlanAssessment): number | null {
  const { push, pull, legs } = assessment;
  const core = coreLevel(assessment);
  switch (ladderKey) {
    case 'push_horizontal':
      return [1, 2, 3, 4][push]!;
    case 'push_vertical':
      return [1, 1, 2, 3][push]!;
    case 'dip':
      return [1, 2, 2, 3][push]!;
    case 'pull_vertical':
      if (pull === 0 && push === 0) {
        return 1;
      }
      return [3, 3, 5, 6][pull]!;
    case 'row':
      return [1, 2, 3, 4][pull]!;
    case 'squat_single':
      return [1, 2, 3, 4][legs]!;
    case 'bridge':
      return [1, 1, 2, 3][legs]!;
    case 'hollow':
      return [1, 1, 2, 2][core]!;
    case 'side_plank':
      return [1, 2, 2, 3][core]!;
    case 'hanging':
      return [1, 2, 2, 3][core]!;
    case 'l_sit':
      return core >= 2 ? core - 1 : null;
    default:
      return null;
  }
}

/** Nearest rung the gear allows; ties go to the easier rung. */
export function nearestAvailableRung(
  ladderKey: string,
  targetStep: number,
  equipment: readonly PlanEquipment[],
): PlanCatalogEntry | null {
  let best: PlanCatalogEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const rung of planLadder(ladderKey)) {
    if (!hasPlanEquipment(rung, equipment)) {
      continue;
    }
    const distance = Math.abs((rung.ladderStep ?? 0) - targetStep);
    if (distance < bestDistance) {
      best = rung;
      bestDistance = distance;
    }
  }
  return best;
}

function roundTo15(seconds: number): number {
  return Math.round(seconds / 15) * 15;
}

/** Rest between sets for the goal, based on the catalog default. */
export function restSecondsForGoal(defaultRestSeconds: number, goal: PlanGoal): number {
  if (goal === 'fat_loss') {
    return Math.max(30, roundTo15(defaultRestSeconds * 0.66));
  }
  if (goal === 'strength_skills') {
    return Math.min(180, roundTo15(defaultRestSeconds * 1.5));
  }
  return defaultRestSeconds;
}

/**
 * Target range for the goal. Strength & skills trains the lower half of rep
 * ranges wide enough to split (≥ 3 reps apart); holds keep their range.
 */
export function targetRangeForGoal(
  entry: Pick<PlanCatalogEntry, 'kind' | 'rangeMin' | 'rangeMax'>,
  goal: PlanGoal,
): { targetMin: number; targetMax: number } {
  if (goal === 'strength_skills' && entry.kind === 'reps' && entry.rangeMax - entry.rangeMin >= 3) {
    return {
      targetMin: entry.rangeMin,
      targetMax: Math.ceil((entry.rangeMin + entry.rangeMax) / 2),
    };
  }
  return { targetMin: entry.rangeMin, targetMax: entry.rangeMax };
}

function isLegExercise(exercise: Pick<BuiltPlanExercise, 'muscle'>): boolean {
  return exercise.muscle === 'legs' || exercise.muscle === 'hips';
}

function setSeconds(exercise: Pick<BuiltPlanExercise, 'restSeconds'>): number {
  return PLAN_WORK_SECONDS_PER_SET + Math.max(0, exercise.restSeconds);
}

/** sets × (work + rest), in seconds. */
export function estimateSessionSeconds(
  exercises: readonly Pick<BuiltPlanExercise, 'sets' | 'restSeconds'>[],
): number {
  let seconds = 0;
  for (const exercise of exercises) {
    seconds += Math.max(1, exercise.sets) * setSeconds(exercise);
  }
  return seconds;
}

export function estimateSessionMinutes(
  exercises: readonly Pick<BuiltPlanExercise, 'sets' | 'restSeconds'>[],
): number {
  return Math.max(1, Math.round(estimateSessionSeconds(exercises) / 60));
}

/** Targets and rest for a catalog entry; sets are decided by the caller. */
export function planExerciseFromEntry(
  entry: PlanCatalogEntry,
  sets: number,
  goal: PlanGoal,
): BuiltPlanExercise {
  const range = targetRangeForGoal(entry, goal);
  return {
    slug: entry.slug,
    kind: entry.kind,
    perSide: entry.perSide,
    muscle: entry.muscle,
    sets,
    targetMin: range.targetMin,
    targetMax: range.targetMax,
    restSeconds: restSecondsForGoal(entry.defaultRestSeconds, goal),
  };
}

type SlotResult = { entry: PlanCatalogEntry; note?: BuiltPlanNote } | null;

function resolveRowFallback(equipment: readonly PlanEquipment[]): PlanCatalogEntry {
  const backpackRow = getPlanCatalogEntry('backpack_row_single_arm')!;
  if (hasPlanEquipment(backpackRow, equipment)) {
    return backpackRow;
  }
  return getPlanCatalogEntry('ytw_raise')!;
}

function resolveSlot(
  slot: Slot,
  answers: PlanWizardAnswers,
  picked: ReadonlyMap<Slot, PlanCatalogEntry>,
): SlotResult {
  const { equipment, assessment } = answers;

  if (slot === 'ytw') {
    return { entry: getPlanCatalogEntry('ytw_raise')! };
  }
  if (slot === 'backpack_curl') {
    const curl = getPlanCatalogEntry('backpack_curl')!;
    return hasPlanEquipment(curl, equipment) ? { entry: curl } : null;
  }

  const primary = SECONDARY_OF[slot];
  if (primary) {
    // Second rung: one step below the first pick of the same ladder.
    const first = picked.get(primary);
    if (!first || first.ladderKey == null || first.ladderStep == null || first.ladderStep <= 1) {
      return null;
    }
    const lower = planLadder(first.ladderKey).find(
      (rung) => rung.ladderStep === first.ladderStep! - 1,
    );
    return lower && hasPlanEquipment(lower, equipment) ? { entry: lower } : null;
  }

  const ladderKey = SLOT_LADDER[slot]!;
  const target = startLadderStep(ladderKey, assessment);
  const rung = target == null ? null : nearestAvailableRung(ladderKey, target, equipment);
  if (rung) {
    return { entry: rung };
  }

  if (slot === 'pull_v') {
    // Without bar or rings: row variants carry the pulling work.
    return resolveSlot('row', answers, picked);
  }
  if (slot === 'row') {
    return { entry: resolveRowFallback(equipment), note: 'pull_alternative' };
  }
  return null;
}

function resolveCore(ladder: CoreLadder, answers: PlanWizardAnswers): PlanCatalogEntry | null {
  const target = startLadderStep(ladder, answers.assessment);
  if (target == null) {
    return null;
  }
  return nearestAvailableRung(ladder, target, answers.equipment);
}

function coreOrder(blueprint: SessionBlueprint, answers: PlanWizardAnswers): CoreLadder[] {
  if (answers.goal !== 'strength_skills') {
    return [...blueprint.core];
  }
  // Strength & skills: the L-sit leads whenever gear and level allow it.
  return ['l_sit', ...blueprint.core.filter((ladder) => ladder !== 'l_sit')];
}

/** 3 sets; beginners (level 0 for that muscle) 2 after the first two exercises. */
function baseSets(entry: PlanCatalogEntry, answers: PlanWizardAnswers, position: number): number {
  const beginner = levelForMuscle(entry.muscle, answers.assessment) === 0;
  if (beginner && position >= 2) {
    return 2;
  }
  return 3;
}

function budgetSeconds(minutes: PlanMinutes): number {
  return minutes * 60;
}

/** Cuts sets from the back of the session (never below 2) until it fits. */
function trimToBudget(exercises: BuiltPlanExercise[], minutes: PlanMinutes): void {
  const budget = budgetSeconds(minutes);
  while (estimateSessionSeconds(exercises) > budget) {
    let cut = false;
    for (let index = exercises.length - 1; index >= 0; index -= 1) {
      const exercise = exercises[index]!;
      if (exercise.sets > MIN_SETS_AFTER_CUTS) {
        exercise.sets -= 1;
        cut = true;
        break;
      }
    }
    if (!cut) {
      return;
    }
  }
}

/** +1 set for each focus exercise while the session stays inside the budget. */
function addFocusSets(
  exercises: BuiltPlanExercise[],
  focus: PlanFocus,
  minutes: PlanMinutes,
): void {
  const muscles = FOCUS_MUSCLES[focus];
  if (muscles.length === 0) {
    return;
  }
  const budget = budgetSeconds(minutes);
  for (const exercise of exercises) {
    if (!muscles.includes(exercise.muscle) || exercise.sets >= MAX_SETS) {
      continue;
    }
    if (estimateSessionSeconds(exercises) + setSeconds(exercise) > budget) {
      continue;
    }
    exercise.sets += 1;
  }
}

function buildSession(
  kind: PlanSessionKind,
  index: number,
  answers: PlanWizardAnswers,
  notes: Set<BuiltPlanNote>,
): BuiltPlanSession {
  const blueprint = BLUEPRINTS[kind];
  const total = exercisesPerSession(answers.minutes);
  const coreCount = answers.minutes >= 30 ? 1 : 0;
  const mainCount = total - coreCount;

  const picked = new Map<Slot, PlanCatalogEntry>();
  const usedSlugs = new Set<string>();
  const main: PlanCatalogEntry[] = [];

  for (const slot of blueprint.slots) {
    if (main.length >= mainCount) {
      break;
    }
    const result = resolveSlot(slot, answers, picked);
    if (!result || usedSlugs.has(result.entry.slug)) {
      continue;
    }
    picked.set(slot, result.entry);
    usedSlugs.add(result.entry.slug);
    main.push(result.entry);
    if (result.note) {
      notes.add(result.note);
    }
  }

  // Core fills its own slot and whatever the main slots could not.
  const coreWanted = total - main.length;
  const core: PlanCatalogEntry[] = [];
  const usedCoreLadders = new Set<string>();
  for (const ladder of coreOrder(blueprint, answers)) {
    if (core.length >= coreWanted) {
      break;
    }
    const entry = resolveCore(ladder, answers);
    if (!entry || usedSlugs.has(entry.slug) || usedCoreLadders.has(ladder)) {
      continue;
    }
    usedSlugs.add(entry.slug);
    usedCoreLadders.add(ladder);
    core.push(entry);
  }

  const exercises = [...main, ...core].map((entry, position) =>
    planExerciseFromEntry(entry, baseSets(entry, answers, position), answers.goal),
  );

  if (answers.cardio === 'lots') {
    for (const exercise of exercises) {
      if (isLegExercise(exercise)) {
        exercise.sets = Math.max(MIN_SETS_AFTER_CUTS, exercise.sets - 1);
      }
    }
  }

  trimToBudget(exercises, answers.minutes);
  addFocusSets(exercises, answers.focus, answers.minutes);

  return {
    kind,
    nameKey: `planWizard.sessions.${kind}`,
    shortLabelKey: `planWizard.sessionShort.${kind}`,
    color: SESSION_COLORS[index % SESSION_COLORS.length]!,
    exercises,
    estimatedMinutes: estimateSessionMinutes(exercises),
  };
}

export function buildPlan(answers: PlanWizardAnswers): BuiltPlan {
  const notes = new Set<BuiltPlanNote>();
  const sessions = planSessionKinds(answers).map((kind, index) =>
    buildSession(kind, index, answers, notes),
  );
  return {
    sessionsPerWeek: answers.scope === 'single' ? null : answers.days,
    sessions,
    notes: [...notes].sort(),
  };
}

// ---------------------------------------------------------------------------
// Editing the preview (swap / remove), immutable
// ---------------------------------------------------------------------------

/**
 * Swap candidates for one exercise: other rungs of the same ladder first
 * (easiest first), then other exercises for the same muscle. Gear is applied;
 * exercises already in the session are left out.
 */
export function swapOptions(
  session: BuiltPlanSession,
  exerciseIndex: number,
  equipment: readonly PlanEquipment[],
): PlanCatalogEntry[] {
  const current = session.exercises[exerciseIndex];
  const entry = current ? getPlanCatalogEntry(current.slug) : undefined;
  if (!current || !entry) {
    return [];
  }
  const inSession = new Set(session.exercises.map((exercise) => exercise.slug));
  const options: PlanCatalogEntry[] = [];
  const seen = new Set<string>();
  const add = (candidate: PlanCatalogEntry) => {
    if (inSession.has(candidate.slug) || seen.has(candidate.slug)) {
      return;
    }
    if (!hasPlanEquipment(candidate, equipment)) {
      return;
    }
    seen.add(candidate.slug);
    options.push(candidate);
  };

  if (entry.ladderKey) {
    planLadder(entry.ladderKey).forEach(add);
  }
  // PLAN_CATALOG is grouped by ladder, easiest rung first.
  for (const candidate of PLAN_CATALOG) {
    if (candidate.muscle === entry.muscle) {
      add(candidate);
    }
  }
  return options;
}

function withSession(
  plan: BuiltPlan,
  sessionIndex: number,
  update: (exercises: BuiltPlanExercise[]) => BuiltPlanExercise[],
): BuiltPlan {
  return {
    ...plan,
    sessions: plan.sessions.map((session, index) => {
      if (index !== sessionIndex) {
        return session;
      }
      const exercises = update(session.exercises.map((exercise) => ({ ...exercise })));
      return { ...session, exercises, estimatedMinutes: estimateSessionMinutes(exercises) };
    }),
  };
}

/** Replace one exercise; sets stay, targets and rest follow the new rung. */
export function replacePlanExercise(
  plan: BuiltPlan,
  sessionIndex: number,
  exerciseIndex: number,
  slug: string,
  goal: PlanGoal,
): BuiltPlan {
  const entry = getPlanCatalogEntry(slug);
  if (!entry) {
    return plan;
  }
  return withSession(plan, sessionIndex, (exercises) =>
    exercises.map((exercise, index) =>
      index === exerciseIndex ? planExerciseFromEntry(entry, exercise.sets, goal) : exercise,
    ),
  );
}

export function removePlanExercise(
  plan: BuiltPlan,
  sessionIndex: number,
  exerciseIndex: number,
): BuiltPlan {
  return withSession(plan, sessionIndex, (exercises) =>
    exercises.filter((_, index) => index !== exerciseIndex),
  );
}

/** Unique catalog slugs in first-appearance order (for the catalog lookup). */
export function collectBuiltPlanSlugs(plan: BuiltPlan): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const session of plan.sessions) {
    for (const exercise of session.exercises) {
      if (!seen.has(exercise.slug)) {
        seen.add(exercise.slug);
        slugs.push(exercise.slug);
      }
    }
  }
  return slugs;
}

// ---------------------------------------------------------------------------
// Markdown (reports, reviews)
// ---------------------------------------------------------------------------

/** "8–12", "20–40 s", with "/ side" for one-sided exercises. */
export function formatPlanTarget(exercise: BuiltPlanExercise): string {
  const range =
    exercise.targetMax > exercise.targetMin
      ? `${exercise.targetMin}–${exercise.targetMax}`
      : `${exercise.targetMin}`;
  const unit = exercise.kind === 'time' ? ' s' : '';
  return `${range}${unit}${exercise.perSide ? ' / side' : ''}`;
}

/**
 * Plan as a readable markdown table: session, exercise (slug and name), sets,
 * target, rest. sessionName defaults to the session kind.
 */
export function formatPlanMarkdown(
  plan: BuiltPlan,
  options: { language?: string; sessionName?: (session: BuiltPlanSession) => string } = {},
): string {
  const language = options.language ?? 'de';
  const sessionName = options.sessionName ?? ((session) => session.kind);
  const lines = [
    '| Session | Exercise | Sets | Target | Rest |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const session of plan.sessions) {
    session.exercises.forEach((exercise, index) => {
      const entry = getPlanCatalogEntry(exercise.slug);
      const name = entry ? planCatalogName(entry, language) : exercise.slug;
      const sessionCell =
        index === 0 ? `${sessionName(session)} (~${session.estimatedMinutes} min)` : '';
      lines.push(
        `| ${sessionCell} | \`${exercise.slug}\` ${name} | ${exercise.sets} | ${formatPlanTarget(exercise)} | ${exercise.restSeconds} s |`,
      );
    });
  }
  return lines.join('\n');
}
