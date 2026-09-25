import {
  calculateMaintenanceCalories,
  KCAL_PER_KG_BODY_WEIGHT,
  type ActivityLevel,
  type BiologicalSex,
  type CalorieSource,
  type GoalType,
} from '@/lib/calorie-goal-math';

export const TARGET_WEIGHT_FORECAST_MAX_WEEKS = 104;
const MAX_WEEKLY_WEIGHT_CHANGE_FRACTION = 0.01;

export type TargetWeightForecastInput = {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  dailyCalorieGoal: number | null;
  biologicalSex: BiologicalSex | null;
  birthDate: Date | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  calorieSource: CalorieSource;
  /** When calorieSource is OBSERVED. */
  observedMaintenanceKcal?: number;
  goalType: GoalType | null;
  /** The macro editor's muscle-building profile, derived from the profile goal. */
  macroGoalProfile: 'muscle' | null;
  weighDaysLast30: number | null;
  today?: Date;
};

export type TargetWeightForecast =
  | { status: 'ok'; etaDate: Date; weeks: number }
  | { status: 'muscle_building' }
  | { status: 'unavailable' };

/**
 * Only recomposition (`build_muscle`) makes body weight an unreliable gauge.
 * The macro mapping also files `gain_weight` under MUSKELAUFBAU, but there the
 * weight change is the goal itself, so it gets a date like weight loss does.
 */
export function resolveForecastMacroGoalProfile(
  goalType: string | null | undefined,
): 'muscle' | null {
  return goalType === 'build_muscle' ? 'muscle' : null;
}

function isReached(currentWeightKg: number, targetWeightKg: number): boolean {
  return Math.abs(currentWeightKg - targetWeightKg) < 0.05;
}

/**
 * Projects target weight one week at a time. Maintenance is deliberately
 * recalculated after every weekly weight change, using the same calorie-source
 * calculation as the stored calorie goal. There is currently no persisted FFM
 * value, so `calculateMaintenanceCalories` supplies its Mifflin-St Jeor path.
 */
export function calculateTargetWeightForecast(
  input: TargetWeightForecastInput,
): TargetWeightForecast {
  const {
    currentWeightKg,
    targetWeightKg,
    dailyCalorieGoal,
    biologicalSex,
    birthDate,
    heightCm,
    activityLevel,
    calorieSource,
    goalType,
    macroGoalProfile,
    weighDaysLast30,
  } = input;
  const observedMaintenanceKcal = input.observedMaintenanceKcal;

  // Training frequency alone is not recomp — only the muscle macro profile.
  if (macroGoalProfile === 'muscle') {
    return { status: 'muscle_building' };
  }

  if (
    goalType === 'maintain' ||
    weighDaysLast30 == null ||
    weighDaysLast30 < 8 ||
    currentWeightKg == null ||
    targetWeightKg == null ||
    dailyCalorieGoal == null ||
    biologicalSex == null ||
    birthDate == null ||
    heightCm == null ||
    activityLevel == null ||
    !(currentWeightKg > 0) ||
    !(targetWeightKg > 0) ||
    !(dailyCalorieGoal > 0) ||
    !(heightCm > 0)
  ) {
    return { status: 'unavailable' };
  }

  const direction = targetWeightKg < currentWeightKg ? 'loss' : 'gain';
  const today = input.today ?? new Date();
  const startDate = new Date(today);
  startDate.setHours(0, 0, 0, 0);

  if (isReached(currentWeightKg, targetWeightKg)) {
    return { status: 'ok', etaDate: startDate, weeks: 0 };
  }

  let weightKg = currentWeightKg;
  for (let weeks = 0; weeks < TARGET_WEIGHT_FORECAST_MAX_WEEKS; weeks += 1) {
    const maintenanceCalories = calculateMaintenanceCalories({
      biologicalSex,
      birthDate,
      heightCm,
      weightKg,
      activityLevel,
      calorieSource,
      observedMaintenanceKcal,
      today: startDate,
    });
    const weeklyWeightChangeKg =
      ((dailyCalorieGoal - maintenanceCalories) * 7) / KCAL_PER_KG_BODY_WEIGHT;

    const movesTowardTarget =
      direction === 'loss' ? weeklyWeightChangeKg < 0 : weeklyWeightChangeKg > 0;
    if (
      !movesTowardTarget ||
      Math.abs(weeklyWeightChangeKg) / weightKg > MAX_WEEKLY_WEIGHT_CHANGE_FRACTION
    ) {
      return { status: 'unavailable' };
    }

    weightKg += weeklyWeightChangeKg;
    const completedWeeks = weeks + 1;
    if (
      direction === 'loss'
        ? weightKg <= targetWeightKg
        : weightKg >= targetWeightKg
    ) {
      const etaDate = new Date(startDate);
      etaDate.setDate(etaDate.getDate() + completedWeeks * 7);
      return { status: 'ok', etaDate, weeks: completedWeeks };
    }
  }

  return { status: 'unavailable' };
}
