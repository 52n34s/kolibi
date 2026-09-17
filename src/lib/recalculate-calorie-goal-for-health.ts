import { fetchRecentActiveEnergy } from '@/lib/daily-health-stats';
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
  const recentActiveEnergy = healthConnected
    ? await fetchRecentActiveEnergy(userId).catch((error) => {
        console.error('[CalorieGoal] recent active energy lookup failed:', error);
        return null;
      })
    : null;

  const { dailyCalorieGoal, maintenanceCalories } = calculateDailyCalorieGoal({
    biologicalSex: profile.biological_sex ?? 'prefer_not_to_say',
    birthDate: parseDateOnly(profile.birth_date),
    heightCm: profile.height_cm,
    weightKg: profile.latest_weight_kg,
    activityLevel: profile.activity_level,
    calorieSource,
    goalType: goalType as Exclude<GoalType, 'custom'>,
    recentActiveEnergy,
  });

  await upsertDailyCalorieGoal({
    userId,
    dailyCalorieGoal,
    source: 'calculated',
    effectiveFrom: localDateKey(),
    tdee: maintenanceCalories,
  });
}
