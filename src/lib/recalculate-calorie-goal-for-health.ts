import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { upsertDailyCalorieGoal } from '@/lib/calorie-goals';
import {
  calculateDailyCalorieGoal,
  resolveCalorieSource,
  type GoalType,
} from '@/lib/onboarding';
import { fetchProfileSettings } from '@/lib/profile';

export async function recalculateCalorieGoalForHealthKitChange(
  userId: string,
  healthConnected: boolean,
): Promise<void> {
  const profile = await fetchProfileSettings(userId);

  if (profile.calorie_goal_source === 'custom') {
    return;
  }

  if (
    !profile.birth_date ||
    !profile.activity_level ||
    !profile.goal_type ||
    profile.height_cm == null ||
    profile.latest_weight_kg == null
  ) {
    return;
  }

  const goalType = profile.goal_type;
  if (goalType === 'custom') {
    return;
  }

  const calorieSource = resolveCalorieSource(healthConnected);

  const { dailyCalorieGoal, maintenanceCalories } = calculateDailyCalorieGoal({
    biologicalSex: profile.biological_sex ?? 'prefer_not_to_say',
    birthDate: parseDateOnly(profile.birth_date),
    heightCm: profile.height_cm,
    weightKg: profile.latest_weight_kg,
    activityLevel: profile.activity_level,
    calorieSource,
    goalType: goalType as Exclude<GoalType, 'custom'>,
  });

  await upsertDailyCalorieGoal({
    userId,
    dailyCalorieGoal,
    source: 'calculated',
    effectiveFrom: localDateKey(),
    tdee: maintenanceCalories,
  });
}
