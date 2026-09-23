/**
 * Pure sport-energy day assembly: named breakdown → totalActiveKcal.
 * HealthKit I/O stays in health.ts; this module is Node-testable.
 */
import type { TrainingActivity } from '@/lib/training-calories';
import {
  SportIntensity,
  type SportEnergySegment,
  type SportIntensity as SportIntensityType,
} from '@/lib/sport-macro-scaling';

/** HKWorkoutActivityType raw values that match a manual training_sessions activity. */
export const TRAINING_ACTIVITY_HK_TYPE_NUMBERS: Record<
  TrainingActivity,
  readonly number[]
> = {
  strength: [50, 20], // traditionalStrengthTraining, functionalStrengthTraining
  yoga: [57, 66], // yoga, pilates
  swimming: [46],
  cycling: [13],
  other: [],
};

export type SportEnergyBreakdownKind =
  | 'baseline'
  | 'hk_workout'
  | 'training_session';

export type SportEnergyBreakdownItem = {
  kind: SportEnergyBreakdownKind;
  label: string;
  kcal: number;
  intensity: SportIntensityType;
  counted: boolean;
  suppressedBy?: 'healthkit';
  /** Present when a Kolibi workout_sessions row links to this training_session. */
  shortLabel?: string;
  colorKey?: string;
};

export type SportEnergyHkWorkoutInput = {
  activityType: number;
  /** Already filtered (≥5 min) and rounded; must be > 0. */
  kcal: number;
  intensity: SportIntensityType;
  label: string;
};

export type SportEnergyTrainingSessionInput = {
  activity: TrainingActivity;
  kcal: number;
  intensity: SportIntensityType;
  label: string;
  shortLabel?: string;
  colorKey?: string;
};

export type BuildSportEnergyDayInput = {
  activeEnergyKcal: number;
  workouts: readonly SportEnergyHkWorkoutInput[];
  /**
   * All HK activity types observed today — including short / zero-kcal samples
   * that never become workout rows. Defaults to workouts' activityType values.
   */
  hkActivityTypesPresent?: readonly number[];
  trainingSessions: readonly SportEnergyTrainingSessionInput[];
  /** null / <1 → training_sessions are omitted entirely (today's rule). */
  sessionsPerWeek: number | null;
  baselineLabel: string;
};

export type SportEnergyDay = {
  /** Total Active Energy for the day (calorie hero / dynamic goal). */
  totalActiveKcal: number;
  /** Named sources for the burned breakdown sheet. */
  breakdown: SportEnergyBreakdownItem[];
  /** Counted items only — macro scaling. */
  segments: SportEnergySegment[];
};

/**
 * i18n key for a HealthKit workout activity type.
 * Unknown types fall back to `home.calorieGoal.hkActivity.other`.
 */
export function hkWorkoutActivityI18nKey(activityType: number): string {
  switch (activityType) {
    case 37:
      return 'home.calorieGoal.hkActivity.running';
    case 13:
      return 'home.calorieGoal.hkActivity.cycling';
    case 52:
      return 'home.calorieGoal.hkActivity.walking';
    case 24:
      return 'home.calorieGoal.hkActivity.hiking';
    case 46:
      return 'home.calorieGoal.hkActivity.swimming';
    case 50:
    case 20:
      return 'home.calorieGoal.hkActivity.strength';
    case 57:
      return 'home.calorieGoal.hkActivity.yoga';
    case 66:
      return 'home.calorieGoal.hkActivity.pilates';
    case 63:
      return 'home.calorieGoal.hkActivity.hiit';
    case 16:
      return 'home.calorieGoal.hkActivity.elliptical';
    case 36:
      return 'home.calorieGoal.hkActivity.rowing';
    case 14:
      return 'home.calorieGoal.hkActivity.dance';
    case 78:
      return 'home.calorieGoal.hkActivity.socialDance';
    default:
      return 'home.calorieGoal.hkActivity.other';
  }
}

/**
 * Assembles the day's sport energy from already-resolved inputs.
 *
 * totalActiveKcal = activeEnergyKcal + counted training kcal
 * (identical to the pre-breakdown HealthKit implementation).
 */
export function buildSportEnergyDay(input: BuildSportEnergyDayInput): SportEnergyDay {
  const breakdown: SportEnergyBreakdownItem[] = [];
  let workoutKcalSum = 0;

  for (const workout of input.workouts) {
    breakdown.push({
      kind: 'hk_workout',
      label: workout.label,
      kcal: workout.kcal,
      intensity: workout.intensity,
      counted: true,
    });
    workoutKcalSum += workout.kcal;
  }

  const residualKcal = Math.max(0, input.activeEnergyKcal - workoutKcalSum);
  if (residualKcal > 0) {
    // Everyday movement first in the sheet; macros only care about the set.
    breakdown.unshift({
      kind: 'baseline',
      label: input.baselineLabel,
      kcal: residualKcal,
      intensity: SportIntensity.LOW,
      counted: true,
    });
  }

  const hkTypes = new Set(
    input.hkActivityTypesPresent ?? input.workouts.map((w) => w.activityType),
  );

  let trainingKcalAdded = 0;
  const sessionsPerWeek = input.sessionsPerWeek;
  const includeTraining =
    sessionsPerWeek != null && Number.isFinite(sessionsPerWeek) && sessionsPerWeek >= 1;

  if (includeTraining) {
    for (const session of input.trainingSessions) {
      if (!(session.kcal > 0)) {
        continue;
      }

      const matchingHkTypes = TRAINING_ACTIVITY_HK_TYPE_NUMBERS[session.activity];
      const hkAlreadyHasMatching = matchingHkTypes.some((type) => hkTypes.has(type));

      if (hkAlreadyHasMatching) {
        breakdown.push({
          kind: 'training_session',
          label: session.label,
          kcal: session.kcal,
          intensity: session.intensity,
          counted: false,
          suppressedBy: 'healthkit',
          ...(session.shortLabel != null ? { shortLabel: session.shortLabel } : {}),
          ...(session.colorKey != null ? { colorKey: session.colorKey } : {}),
        });
        continue;
      }

      trainingKcalAdded += session.kcal;
      breakdown.push({
        kind: 'training_session',
        label: session.label,
        kcal: session.kcal,
        intensity: session.intensity,
        counted: true,
        ...(session.shortLabel != null ? { shortLabel: session.shortLabel } : {}),
        ...(session.colorKey != null ? { colorKey: session.colorKey } : {}),
      });
    }
  }

  const segments: SportEnergySegment[] = breakdown
    .filter((item) => item.counted)
    .map((item) => ({ kcal: item.kcal, intensity: item.intensity }));

  return {
    totalActiveKcal: input.activeEnergyKcal + trainingKcalAdded,
    breakdown,
    segments,
  };
}
