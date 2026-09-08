/**
 * Estimated net calories for manual training sessions.
 *
 * Formula: kcal = (MET − 1) × weightKg × durationHours
 * The −1 removes resting metabolism already counted in BMR/TDEE.
 *
 * MET values (Compendium bands) — treat like macro-rules:
 * subject to clinical review before user count grows.
 */
import { SportIntensity } from '@/lib/sport-macro-scaling';

export type TrainingIntensity = 'easy' | 'normal' | 'hard';

export type TrainingActivity =
  | 'strength'
  | 'yoga'
  | 'swimming'
  | 'cycling'
  | 'other';

export const TRAINING_ACTIVITIES: TrainingActivity[] = [
  'strength',
  'yoga',
  'swimming',
  'cycling',
  'other',
];

/** MET by activity × talk-test intensity. */
export const TRAINING_MET: Record<
  TrainingActivity,
  Record<TrainingIntensity, number>
> = {
  strength: { easy: 3.5, normal: 5.0, hard: 6.0 },
  yoga: { easy: 2.5, normal: 3.0, hard: 4.0 },
  swimming: { easy: 5.0, normal: 7.0, hard: 9.5 },
  cycling: { easy: 4.0, normal: 6.8, hard: 10.0 },
  other: { easy: 3.5, normal: 5.0, hard: 6.0 },
};

export function isTrainingActivity(value: string): value is TrainingActivity {
  return (
    value === 'strength' ||
    value === 'yoga' ||
    value === 'swimming' ||
    value === 'cycling' ||
    value === 'other'
  );
}

export function isTrainingIntensity(value: string): value is TrainingIntensity {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

/** Talk-test intensities → same LOW/MODERATE/HIGH bands as HealthKit workouts. */
export function mapTrainingIntensityToSportIntensity(
  intensity: TrainingIntensity,
): SportIntensity {
  if (intensity === 'easy') {
    return SportIntensity.LOW;
  }
  if (intensity === 'hard') {
    return SportIntensity.HIGH;
  }
  return SportIntensity.MODERATE;
}

export function calculateTrainingCalories(params: {
  activity: TrainingActivity;
  weightKg: number;
  durationMinutes: number;
  intensity: TrainingIntensity;
}): number {
  const { activity, weightKg, durationMinutes, intensity } = params;

  if (!(weightKg > 0) || !(durationMinutes > 0)) {
    return 0;
  }

  const met = TRAINING_MET[activity][intensity];
  const durationHours = durationMinutes / 60;
  return Math.round((met - 1) * weightKg * durationHours);
}
