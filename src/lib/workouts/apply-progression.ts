import type { SaveTemplateExerciseInput } from '@/lib/workouts/workouts-api';
import type { ProgressionSuggestion } from '@/lib/workouts/progression';

/**
 * Apply one progression suggestion onto a template exercise list.
 * variant_up/down replaces the exercise id; load_up leaves targets unchanged.
 */
export function applyProgression(
  exercises: SaveTemplateExerciseInput[],
  suggestion: ProgressionSuggestion,
): SaveTemplateExerciseInput[] {
  return exercises.map((row) => {
    if (row.exerciseId !== suggestion.exerciseId) {
      return row;
    }

    if (suggestion.kind === 'load_up') {
      return row;
    }

    if (suggestion.kind === 'variant_up' || suggestion.kind === 'variant_down') {
      const nextId = suggestion.toExerciseId;
      if (nextId == null) {
        return row;
      }
      return {
        ...row,
        exerciseId: nextId,
        targetSets: suggestion.toTarget.targetSets,
        targetReps: suggestion.toTarget.targetReps,
        targetRepsMax: suggestion.toTarget.targetRepsMax,
        targetSeconds: suggestion.toTarget.targetSeconds,
        targetSecondsMax: suggestion.toTarget.targetSecondsMax,
      };
    }

    return {
      ...row,
      targetSets: suggestion.toTarget.targetSets,
      targetReps: suggestion.toTarget.targetReps,
      targetRepsMax: suggestion.toTarget.targetRepsMax,
      targetSeconds: suggestion.toTarget.targetSeconds,
      targetSecondsMax: suggestion.toTarget.targetSecondsMax,
    };
  });
}
