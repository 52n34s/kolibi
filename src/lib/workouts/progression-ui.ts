import { formatExerciseTarget } from '@/lib/workouts/format-target';
import type { ProgressionSuggestion } from '@/lib/workouts/progression';
import type { Exercise, ProgressionEventKind } from '@/lib/workouts/types';

export function isDescentKind(kind: ProgressionEventKind): boolean {
  return kind === 'variant_down' || kind === 'range_down';
}

export function isAscentKind(kind: ProgressionEventKind): boolean {
  return !isDescentKind(kind);
}

export function formatTargetFromSuggestionTarget(
  kind: Exercise['kind'],
  target: {
    targetSets: number;
    targetReps: number | null;
    targetRepsMax: number | null;
    targetSeconds: number | null;
    targetSecondsMax: number | null;
  },
  perSide: boolean,
  perSideLabel: string | null,
): string {
  return formatExerciseTarget({
    sets: target.targetSets,
    kind,
    reps: target.targetReps,
    repsMax: target.targetRepsMax,
    seconds: target.targetSeconds,
    secondsMax: target.targetSecondsMax,
    perSide,
    perSideLabel,
  });
}

/** "Klimmzüge: 3 × 3–8 → 4 × 3–8" */
export function formatProgressionChangeLine(params: {
  name: string;
  kind: Exercise['kind'];
  perSide: boolean;
  perSideLabel: string | null;
  suggestion: ProgressionSuggestion;
}): string {
  const from = formatTargetFromSuggestionTarget(
    params.kind,
    params.suggestion.fromTarget,
    params.perSide,
    params.perSideLabel,
  );
  const toKind =
    params.suggestion.toExerciseId != null && params.suggestion.kind.startsWith('variant')
      ? params.kind
      : params.kind;
  const to = formatTargetFromSuggestionTarget(
    toKind,
    params.suggestion.toTarget,
    params.perSide,
    params.perSideLabel,
  );
  return `${params.name}: ${from} → ${to}`;
}

export const CELEBRATION_SUBTITLE_KEYS = [
  'training.progression.celebration.subtitle1',
  'training.progression.celebration.subtitle2',
  'training.progression.celebration.subtitle3',
  'training.progression.celebration.subtitle4',
] as const;

export function pickCelebrationSubtitleKey(seed: string): (typeof CELEBRATION_SUBTITLE_KEYS)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % CELEBRATION_SUBTITLE_KEYS.length;
  }
  return CELEBRATION_SUBTITLE_KEYS[hash]!;
}
