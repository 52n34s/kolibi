/** Domain types for the workout logger (camelCase ↔ DB snake_case in workouts-api). */

export type ExerciseKind = 'reps' | 'weighted' | 'time';

export type UnitColorKey = 'indigo' | 'violet' | 'sky' | 'teal' | 'amber' | 'pink';

export const UNIT_COLOR_KEYS: readonly UnitColorKey[] = [
  'indigo',
  'violet',
  'sky',
  'teal',
  'amber',
  'pink',
] as const;

export type GymIntensity = 'easy' | 'normal' | 'hard';

export type ProgressionKind = 'variant' | 'load' | 'none';

export type ProgressionEventKind =
  | 'variant_up'
  | 'variant_down'
  | 'sets_up'
  | 'range_up'
  | 'range_down'
  | 'time_up'
  | 'load_up';

export type ProgressionEventStatus = 'accepted' | 'declined';

/** Target snapshot stored on progression_events / used by suggestProgression. */
export type ProgressionTarget = {
  targetSets: number;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
};

export type ProgressionEvent = {
  id: string;
  userId: string;
  templateId: string | null;
  sessionId: string | null;
  kind: ProgressionEventKind;
  fromExerciseId: string | null;
  toExerciseId: string | null;
  fromTarget: ProgressionTarget;
  toTarget: ProgressionTarget;
  status: ProgressionEventStatus;
  createdAt: string;
};

export type Exercise = {
  id: string;
  userId: string | null;
  catalogSlug: string | null;
  names: Record<string, string>;
  kind: ExerciseKind;
  perSide: boolean;
  defaultSets: number;
  defaultReps: number | null;
  defaultRepsMax: number | null;
  defaultSeconds: number | null;
  defaultSecondsMax: number | null;
  defaultRestSeconds: number | null;
  imageAsset: string | null;
  imagePath: string | null;
  note: string | null;
  archivedAt: string | null;
  ladderKey: string | null;
  ladderStep: number | null;
  progressionKind: ProgressionKind;
  timeCapSeconds: number | null;
};

export type TemplateExercise = {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  position: number;
  targetSets: number;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  position: number;
  /** Soft-archive timestamp; `fetchTemplates` only returns rows with null. */
  archivedAt: string | null;
  exercises: TemplateExercise[];
};

export type WorkoutSession = {
  id: string;
  userId: string;
  templateId: string | null;
  templateName: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  loggedOn: string;
  startedAt: string;
  finishedAt: string | null;
  intensity: GymIntensity | null;
  trainingSessionId: string | null;
  createdAt: string;
  sets: SessionSet[];
};

export type SessionSet = {
  id: string;
  sessionId: string;
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
  /** Other side when perSide time holds; seconds is the minimum of both. */
  secondsOtherSide: number | null;
  weightKg: number | null;
  completedAt: string;
  /** Reps in reserve 0–3 (3 = "3 or more"). Missing before the rir migration. */
  rir?: number | null;
};

/** In-progress session snapshot (Zustand store). */
export type ActiveSet = {
  id: string;
  /** Reps or seconds for the current set. */
  value: number;
  done: boolean;
  completedAt: string | null;
  secondsOtherSide: number | null;
  /**
   * "Wie viele wären noch gegangen?" 0–3 (3 = "3 or more"); null / missing =
   * not tapped. Optional: sessions persisted before this field load as-is.
   */
  rir?: number | null;
};

export type ActiveExercise = {
  exerciseId: string;
  /** Snapshot name at session start (also written to session_sets). */
  name: string;
  /** Full locale map for catalog re-resolve on language change. Optional for legacy MMKV. */
  names?: Record<string, string>;
  /** Non-null ⇒ catalog exercise; re-resolve via resolveExerciseName. Optional for legacy MMKV. */
  catalogSlug?: string | null;
  kind: ExerciseKind;
  perSide: boolean;
  imageAsset: string | null;
  imagePath: string | null;
  note: string | null;
  targetSets: number;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
  /** True when added mid-session; template stays unchanged until user opts in. */
  addedInSession: boolean;
  /**
   * Set by "Überspringen" in the session overview. The cursor walks past it;
   * only an explicit jump from the overview brings it back.
   */
  skipped: boolean;
  sets: ActiveSet[];
};

export type ActiveSessionCursor = {
  exerciseIndex: number;
  setIndex: number;
};

export type SummaryDecision = 'accept' | 'later';

/**
 * What the user picked on the summary screen, keyed by session item index.
 *
 * Persisted with the session: this used to be local component state, so a tab
 * switch or "Zurück zur Einheit" silently threw away a ticked adopt box.
 */
export type SummaryDraft = {
  intensity: GymIntensity | null;
  adopt: Record<number, boolean>;
  addToTemplate: Record<number, boolean>;
  decisions: Record<number, SummaryDecision>;
  /**
   * "Was war los?" picks (ShortfallReason values). Optional: drafts persisted
   * before this field come back without it.
   */
  shortfallReasons?: string[];
};

export function emptySummaryDraft(): SummaryDraft {
  return { intensity: null, adopt: {}, addToTemplate: {}, decisions: {} };
}

/** In-progress workout logger session (Zustand + MMKV). */
export type ActiveSession = {
  sessionId: string;
  /**
   * Owner at the time the session was started. Everything this session writes
   * carries this id — never the currently signed-in user — so a logged-out
   * session can never land in the next account.
   */
  userId: string;
  templateId: string | null;
  templateName: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  startedAt: string;
  loggedOn: string;
  finishedAt: string | null;
  intensity: GymIntensity | null;
  /** Linked training_sessions row once insert succeeded (retry-safe). */
  trainingSessionId: string | null;
  phase: 'active' | 'summary';
  items: ActiveExercise[];
  cursor: ActiveSessionCursor;
  summaryDraft: SummaryDraft;
};

export function isUnitColorKey(value: string): value is UnitColorKey {
  return (UNIT_COLOR_KEYS as readonly string[]).includes(value);
}

export function isExerciseKind(value: string): value is ExerciseKind {
  return value === 'reps' || value === 'weighted' || value === 'time';
}

export function isGymIntensity(value: string): value is GymIntensity {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

export function isProgressionKind(value: string): value is ProgressionKind {
  return value === 'variant' || value === 'load' || value === 'none';
}

export function isProgressionEventKind(value: string): value is ProgressionEventKind {
  return (
    value === 'variant_up' ||
    value === 'variant_down' ||
    value === 'sets_up' ||
    value === 'range_up' ||
    value === 'range_down' ||
    value === 'time_up' ||
    value === 'load_up'
  );
}

export function isProgressionEventStatus(value: string): value is ProgressionEventStatus {
  return value === 'accepted' || value === 'declined';
}
