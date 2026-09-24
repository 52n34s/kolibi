import { newId } from '../id';
import { resolveExerciseName } from './exercise-name';
import {
  emptySummaryDraft,
  type ActiveExercise,
  type ActiveSession,
  type ActiveSessionCursor,
  type ActiveSet,
  type Exercise,
  type ExerciseKind,
  type GymIntensity,
  type TemplateExercise,
  type WorkoutTemplate,
} from './types';

/** Queue/API payload for a completed set (camelCase). */
export type SessionSetUpsertPayload = {
  id: string;
  sessionId: string;
  /** Owner of the session this set belongs to. */
  userId: string;
  exerciseId: string | null;
  exerciseName: string;
  exercisePosition: number;
  setIndex: number;
  kind: ExerciseKind;
  perSide: boolean;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
  targetWeightKg: number | null;
  reps: number | null;
  seconds: number | null;
  secondsOtherSide: number | null;
  weightKg: number | null;
  completedAt: string;
};

/** Lower-bound target for set prefill (never history, never max). */
export function defaultSetValue(
  item: Pick<ActiveExercise, 'kind' | 'targetReps' | 'targetSeconds'>,
): number {
  if (item.kind === 'time') {
    return Math.max(0, item.targetSeconds ?? 0);
  }
  return Math.max(0, item.targetReps ?? 0);
}

export function createEmptySet(
  item: Pick<ActiveExercise, 'kind' | 'targetReps' | 'targetSeconds'>,
): ActiveSet {
  return {
    id: newId(),
    value: defaultSetValue(item),
    done: false,
    completedAt: null,
    secondsOtherSide: null,
  };
}

function snapshotFromTemplateExercise(te: TemplateExercise, lang: string): ActiveExercise {
  const exercise = te.exercise;
  const base: ActiveExercise = {
    exerciseId: te.exerciseId,
    name: resolveExerciseName(exercise, lang),
    names: { ...(exercise.names ?? {}) },
    catalogSlug: exercise.catalogSlug,
    kind: exercise.kind,
    perSide: exercise.perSide,
    imageAsset: exercise.imageAsset,
    imagePath: exercise.imagePath,
    note: exercise.note,
    targetSets: te.targetSets,
    targetReps: te.targetReps,
    targetRepsMax: te.targetRepsMax,
    targetSeconds: te.targetSeconds,
    targetSecondsMax: te.targetSecondsMax,
    targetWeightKg: te.targetWeightKg,
    // Plan value only — a null here means "use the standard rest"
    // (training.rest_seconds_last), never the catalog default.
    restSeconds: te.restSeconds,
    addedInSession: false,
    skipped: false,
    sets: [],
  };
  const count = Math.max(1, te.targetSets);
  base.sets = Array.from({ length: count }, () => createEmptySet(base));
  return base;
}

export function buildActiveSessionFromTemplate(
  template: WorkoutTemplate,
  opts: { userId: string; loggedOn: string; startedAt?: string; lang?: string },
): ActiveSession {
  const lang = opts.lang ?? 'de';
  const items = template.exercises
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((te) => snapshotFromTemplateExercise(te, lang));

  return {
    sessionId: newId(),
    userId: opts.userId,
    templateId: template.id,
    templateName: template.name,
    shortLabel: template.shortLabel,
    colorKey: template.colorKey,
    startedAt: opts.startedAt ?? new Date().toISOString(),
    loggedOn: opts.loggedOn,
    finishedAt: null,
    intensity: null,
    trainingSessionId: null,
    phase: 'active',
    items,
    cursor: { exerciseIndex: 0, setIndex: 0 },
    summaryDraft: emptySummaryDraft(),
  };
}

export function buildActiveExerciseFromCatalog(
  exercise: Exercise,
  opts: { lang?: string; targetSets?: number } = {},
): ActiveExercise {
  const lang = opts.lang ?? 'de';
  const targetSets = Math.max(1, opts.targetSets ?? exercise.defaultSets ?? 1);
  const base: ActiveExercise = {
    exerciseId: exercise.id,
    name: resolveExerciseName(exercise, lang),
    names: { ...(exercise.names ?? {}) },
    catalogSlug: exercise.catalogSlug,
    kind: exercise.kind,
    perSide: exercise.perSide,
    imageAsset: exercise.imageAsset,
    imagePath: exercise.imagePath,
    note: exercise.note,
    targetSets,
    targetReps: exercise.defaultReps,
    targetRepsMax: null,
    targetSeconds: exercise.defaultSeconds,
    targetSecondsMax: null,
    targetWeightKg: null,
    // Added mid-session: no plan value, so the standard rest applies.
    restSeconds: null,
    addedInSession: true,
    skipped: false,
    sets: [],
  };
  base.sets = Array.from({ length: targetSets }, () => createEmptySet(base));
  return base;
}

function clampNonNeg(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function withCurrentSet(
  session: ActiveSession,
  updater: (set: ActiveSet, item: ActiveExercise) => ActiveSet,
): ActiveSession {
  const { exerciseIndex, setIndex } = session.cursor;
  const items = session.items.map((item, ei) => {
    if (ei !== exerciseIndex) {
      return item;
    }
    const sets = item.sets.map((set, si) => {
      if (si !== setIndex) {
        return set;
      }
      return updater(set, item);
    });
    return { ...item, sets };
  });
  return { ...session, items };
}

export function adjustCurrent(session: ActiveSession, delta: number): ActiveSession {
  return withCurrentSet(session, (set) => ({
    ...set,
    value: clampNonNeg(set.value + delta),
  }));
}

export function setCurrent(session: ActiveSession, value: number): ActiveSession {
  return withCurrentSet(session, (set) => ({
    ...set,
    value: clampNonNeg(value),
  }));
}

/** Hold-timer write for per-side time: value = min, secondsOtherSide = max. */
export function setCurrentSides(
  session: ActiveSession,
  seconds: number,
  secondsOtherSide: number,
): ActiveSession {
  const a = clampNonNeg(seconds);
  const b = clampNonNeg(secondsOtherSide);
  return withCurrentSet(session, (set) => ({
    ...set,
    value: Math.min(a, b),
    secondsOtherSide: Math.max(a, b),
  }));
}

/** Open = has an unfinished set AND was not skipped. */
function hasOpenSets(item: ActiveExercise): boolean {
  return !item.skipped && item.sets.some((set) => !set.done);
}

/** Next open set after (exerciseIndex, setIndex), or null if session is complete. */
export function findNextOpenCursor(
  session: ActiveSession,
  fromExerciseIndex: number,
  fromSetIndex: number,
): ActiveSessionCursor | null {
  for (let ei = fromExerciseIndex; ei < session.items.length; ei += 1) {
    const item = session.items[ei]!;
    if (item.skipped) {
      continue;
    }
    const startSi = ei === fromExerciseIndex ? fromSetIndex + 1 : 0;
    for (let si = startSi; si < item.sets.length; si += 1) {
      if (!item.sets[si]!.done) {
        return { exerciseIndex: ei, setIndex: si };
      }
    }
  }
  return null;
}

export type CompleteCurrentSetResult = {
  session: ActiveSession;
  restSeconds: number | null;
  isLastSet: boolean;
  completedSet: ActiveSet;
  exercise: ActiveExercise;
  exerciseIndex: number;
  setIndex: number;
};

export function completeCurrentSet(
  session: ActiveSession,
  completedAt: string = new Date().toISOString(),
): CompleteCurrentSetResult | null {
  if (session.phase !== 'active') {
    return null;
  }
  const { exerciseIndex, setIndex } = session.cursor;
  const exercise = session.items[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set || set.done) {
    return null;
  }

  const completedSet: ActiveSet = {
    ...set,
    done: true,
    completedAt,
  };

  const items = session.items.map((item, ei) => {
    if (ei !== exerciseIndex) {
      return item;
    }
    return {
      ...item,
      sets: item.sets.map((s, si) => (si === setIndex ? completedSet : s)),
    };
  });

  // Forward first, then wrap to the front — same fallback as skipExercise.
  // Jumping ahead from the overview used to end the session while earlier
  // exercises were still open.
  const withSet = { ...session, items };
  const nextCursor =
    findNextOpenCursor(withSet, exerciseIndex, setIndex) ??
    findNextOpenCursor(withSet, 0, -1);
  const isLastSet = nextCursor == null;
  const next: ActiveSession = {
    ...session,
    items,
    cursor: nextCursor ?? session.cursor,
    phase: isLastSet ? 'summary' : 'active',
  };

  return {
    session: next,
    restSeconds: isLastSet ? null : exercise.restSeconds,
    isLastSet,
    completedSet,
    exercise,
    exerciseIndex,
    setIndex,
  };
}

export function addSet(session: ActiveSession, exerciseIndex: number): ActiveSession {
  const items = session.items.map((item, ei) => {
    if (ei !== exerciseIndex) {
      return item;
    }
    return { ...item, sets: [...item.sets, createEmptySet(item)] };
  });
  const next = { ...session, items };
  // Completing all sets moves to summary; adding a set on summary re-opens active.
  if (session.phase === 'summary' && hasOpenSets(items[exerciseIndex]!)) {
    const open = findNextOpenCursor(next, exerciseIndex, -1);
    return {
      ...next,
      phase: 'active',
      cursor: open ?? session.cursor,
    };
  }
  return next;
}

export type RemoveLastSetResult = {
  session: ActiveSession;
  deletedSetId: string | null;
};

export function removeLastSet(
  session: ActiveSession,
  exerciseIndex: number,
): RemoveLastSetResult {
  const item = session.items[exerciseIndex];
  if (!item || item.sets.length <= 1) {
    return { session, deletedSetId: null };
  }
  const last = item.sets[item.sets.length - 1]!;
  const deletedSetId = last.done ? last.id : null;

  const items = session.items.map((ex, ei) => {
    if (ei !== exerciseIndex) {
      return ex;
    }
    return { ...ex, sets: ex.sets.slice(0, -1) };
  });

  let cursor = session.cursor;
  if (cursor.exerciseIndex === exerciseIndex && cursor.setIndex >= items[exerciseIndex]!.sets.length) {
    cursor = {
      exerciseIndex,
      setIndex: Math.max(0, items[exerciseIndex]!.sets.length - 1),
    };
  }

  let phase = session.phase;
  if (phase === 'summary' && items.some(hasOpenSets)) {
    phase = 'active';
  }

  return { session: { ...session, items, cursor, phase }, deletedSetId };
}

export type RemoveOpenTrailingSetResult = {
  session: ActiveSession;
  removed: boolean;
};

/**
 * Chip-bar delete path: drop only an open trailing set when more than one set
 * exists. Never touches a done set and never enqueues a server delete — unlike
 * `removeLastSet` (overview), which can delete a completed last set.
 */
export function removeOpenTrailingSet(
  session: ActiveSession,
  exerciseIndex: number,
  setIndex: number,
): RemoveOpenTrailingSetResult {
  const item = session.items[exerciseIndex];
  if (!item || item.sets.length <= 1) {
    return { session, removed: false };
  }
  const set = item.sets[setIndex];
  if (!set || set.done || setIndex !== item.sets.length - 1) {
    return { session, removed: false };
  }

  const items = session.items.map((ex, ei) => {
    if (ei !== exerciseIndex) {
      return ex;
    }
    return { ...ex, sets: ex.sets.slice(0, -1) };
  });

  let cursor = session.cursor;
  if (cursor.exerciseIndex === exerciseIndex && cursor.setIndex >= items[exerciseIndex]!.sets.length) {
    cursor = {
      exerciseIndex,
      setIndex: Math.max(0, items[exerciseIndex]!.sets.length - 1),
    };
  }

  let phase = session.phase;
  if (phase === 'summary' && items.some(hasOpenSets)) {
    phase = 'active';
  }

  return { session: { ...session, items, cursor, phase }, removed: true };
}

/**
 * Mark an exercise as skipped and move on. It stays out of the rotation until
 * the user jumps back to it from the overview.
 */
export function skipExercise(session: ActiveSession, exerciseIndex: number): ActiveSession {
  const target = session.items[exerciseIndex];
  if (!target) {
    return session;
  }
  const items = session.items.map((item, ei) =>
    ei === exerciseIndex ? { ...item, skipped: true } : item,
  );
  const next: ActiveSession = { ...session, items };

  const cursor = findNextOpenCursor(next, exerciseIndex, Number.MAX_SAFE_INTEGER);
  if (cursor) {
    return { ...next, cursor, phase: 'active' };
  }

  const fromStart = findNextOpenCursor(next, 0, -1);
  if (fromStart) {
    return { ...next, cursor: fromStart, phase: 'active' };
  }

  return { ...next, phase: 'summary' };
}

export function moveExercise(session: ActiveSession, from: number, to: number): ActiveSession {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= session.items.length ||
    to >= session.items.length
  ) {
    return session;
  }
  const items = session.items.slice();
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved!);

  let { exerciseIndex, setIndex } = session.cursor;
  if (exerciseIndex === from) {
    exerciseIndex = to;
  } else if (from < exerciseIndex && to >= exerciseIndex) {
    exerciseIndex -= 1;
  } else if (from > exerciseIndex && to <= exerciseIndex) {
    exerciseIndex += 1;
  }

  return { ...session, items, cursor: { exerciseIndex, setIndex } };
}

export function jumpTo(
  session: ActiveSession,
  exerciseIndex: number,
  setIndex: number,
): ActiveSession {
  const item = session.items[exerciseIndex];
  if (!item) {
    return session;
  }
  const clampedSet = Math.max(0, Math.min(setIndex, item.sets.length - 1));
  // Jumping to a skipped exercise puts it back in play — that is the only way
  // back in, by design.
  const items = item.skipped
    ? session.items.map((row, ei) => (ei === exerciseIndex ? { ...row, skipped: false } : row))
    : session.items;
  return {
    ...session,
    items,
    phase: 'active',
    cursor: { exerciseIndex, setIndex: clampedSet },
  };
}

export function editDoneSet(
  session: ActiveSession,
  exerciseIndex: number,
  setIndex: number,
  value: number,
  otherSide?: number | null,
): ActiveSession {
  const item = session.items[exerciseIndex];
  const set = item?.sets[setIndex];
  if (!item || !set || !set.done) {
    return session;
  }
  const items = session.items.map((ex, ei) => {
    if (ei !== exerciseIndex) {
      return ex;
    }
    return {
      ...ex,
      sets: ex.sets.map((s, si) => {
        if (si !== setIndex) {
          return s;
        }
        const next: ActiveSet = { ...s, value: clampNonNeg(value) };
        if (otherSide !== undefined) {
          next.secondsOtherSide =
            otherSide == null ? null : clampNonNeg(otherSide);
        }
        return next;
      }),
    };
  });
  return { ...session, items };
}

export function addExerciseToSession(
  session: ActiveSession,
  exercise: Exercise,
  opts: { lang?: string } = {},
): ActiveSession {
  const nextItem = buildActiveExerciseFromCatalog(exercise, opts);
  const items = [...session.items, nextItem];
  return {
    ...session,
    phase: 'active',
    items,
    // Move to the exercise the user just picked. Without this nothing on
    // screen changes and the add looks like it did nothing at all.
    cursor: { exerciseIndex: items.length - 1, setIndex: 0 },
  };
}

export function markSessionFinished(
  session: ActiveSession,
  intensity: GymIntensity,
  finishedAt: string = new Date().toISOString(),
): ActiveSession {
  return {
    ...session,
    intensity,
    finishedAt,
    phase: 'summary',
  };
}

/** Duration minutes from startedAt → finishedAt, clamped to 1–300. */
export function sessionDurationMinutes(session: ActiveSession, nowIso?: string): number {
  const end = Date.parse(session.finishedAt ?? nowIso ?? new Date().toISOString());
  const start = Date.parse(session.startedAt);
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start) {
    return 1;
  }
  const minutes = Math.round((end - start) / 60_000);
  return Math.min(300, Math.max(1, minutes));
}

export function toSessionSetUpsert(
  session: ActiveSession,
  exerciseIndex: number,
  setIndex: number,
): SessionSetUpsertPayload | null {
  const exercise = session.items[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set || !set.done || !set.completedAt) {
    return null;
  }

  const isTime = exercise.kind === 'time';
  return {
    id: set.id,
    sessionId: session.sessionId,
    userId: session.userId,
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    exercisePosition: exerciseIndex,
    setIndex,
    kind: exercise.kind,
    perSide: exercise.perSide,
    targetReps: exercise.targetReps,
    targetRepsMax: exercise.targetRepsMax,
    targetSeconds: exercise.targetSeconds,
    targetSecondsMax: exercise.targetSecondsMax,
    targetWeightKg: exercise.targetWeightKg,
    reps: isTime ? null : set.value,
    seconds: isTime ? set.value : null,
    secondsOtherSide: isTime && exercise.perSide ? set.secondsOtherSide : null,
    weightKg: exercise.kind === 'weighted' ? exercise.targetWeightKg : null,
    completedAt: set.completedAt,
  };
}

export function allDoneSetUpserts(session: ActiveSession): SessionSetUpsertPayload[] {
  const out: SessionSetUpsertPayload[] = [];
  session.items.forEach((_, ei) => {
    session.items[ei]!.sets.forEach((set, si) => {
      if (!set.done) {
        return;
      }
      const payload = toSessionSetUpsert(session, ei, si);
      if (payload) {
        out.push(payload);
      }
    });
  });
  return out;
}

/**
 * Exercises that still have an unfinished set — skipped ones included.
 * The summary lists these so nothing quietly falls off the end of a session.
 */
export function openExerciseNames(session: ActiveSession): string[] {
  return session.items
    .filter((item) => item.sets.some((set) => !set.done))
    .map((item) => item.name);
}

export function currentExerciseIsPerSide(session: ActiveSession): boolean {
  return session.items[session.cursor.exerciseIndex]?.perSide === true;
}
