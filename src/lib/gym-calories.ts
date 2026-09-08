/**
 * Estimated net calories for manual strength training.
 *
 * Formula: kcal = (MET − 1) × weightKg × durationHours
 * The −1 removes resting metabolism already counted in BMR/TDEE.
 *
 * MET values (Compendium / strength-training band) — treat like macro-rules:
 * subject to clinical review before user count grows.
 */
import { SportIntensity } from '@/lib/sport-macro-scaling';

export type GymIntensity = 'easy' | 'normal' | 'hard';

export const GYM_MET_BY_INTENSITY: Record<GymIntensity, number> = {
  easy: 3.5,
  normal: 5,
  hard: 6,
};

/** Talk-test intensities → same LOW/MODERATE/HIGH bands as HealthKit workouts. */
export function mapGymIntensityToSportIntensity(intensity: GymIntensity): SportIntensity {
  if (intensity === 'easy') {
    return SportIntensity.LOW;
  }
  if (intensity === 'hard') {
    return SportIntensity.HIGH;
  }
  return SportIntensity.MODERATE;
}

export function calculateGymCalories(params: {
  weightKg: number;
  durationMinutes: number;
  intensity: GymIntensity;
}): number {
  const { weightKg, durationMinutes, intensity } = params;

  if (!(weightKg > 0) || !(durationMinutes > 0)) {
    return 0;
  }

  const met = GYM_MET_BY_INTENSITY[intensity];
  const durationHours = durationMinutes / 60;
  return Math.round((met - 1) * weightKg * durationHours);
}
