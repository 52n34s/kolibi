import type { ActiveExercise, Exercise, SessionSet } from '@/lib/workouts/types';

/** Minimal Exercise for ExerciseThumb / viewer from session snapshot fields. */
export function exerciseStubFromActive(item: ActiveExercise): Exercise {
  return {
    id: item.exerciseId,
    userId: item.catalogSlug != null ? null : 'local',
    catalogSlug: item.catalogSlug ?? null,
    names:
      item.names && Object.keys(item.names).length > 0
        ? item.names
        : { de: item.name },
    kind: item.kind,
    perSide: item.perSide,
    defaultSets: item.targetSets,
    defaultReps: item.targetReps,
    defaultRepsMax: item.targetRepsMax,
    defaultSeconds: item.targetSeconds,
    defaultSecondsMax: item.targetSecondsMax,
    defaultRestSeconds: item.restSeconds,
    imageAsset: item.imageAsset,
    imagePath: item.imagePath,
    note: item.note,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'none',
    timeCapSeconds: null,
  };
}

/** Minimal Exercise for history lists when only SessionSet fields are available. */
export function exerciseStubFromSessionSet(set: SessionSet): Exercise {
  return {
    id: set.exerciseId ?? set.id,
    userId: null,
    catalogSlug: null,
    names: { de: set.exerciseName },
    kind: set.kind,
    perSide: set.perSide,
    defaultSets: 1,
    defaultReps: set.targetReps,
    defaultRepsMax: set.targetRepsMax,
    defaultSeconds: set.targetSeconds,
    defaultSecondsMax: set.targetSecondsMax,
    defaultRestSeconds: null,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'none',
    timeCapSeconds: null,
  };
}
