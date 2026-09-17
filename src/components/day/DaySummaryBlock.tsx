import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeProgressRows, type HomeProgressRowItem } from '@/components/home/home-progress-rows';
import type { NutrientTileState } from '@/components/home/nutrient-tile';
import {
  getOnboardingIdleCardStyle,
  getOnboardingSecondarySurfaceStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { useDayMeals } from '@/hooks/use-day-meals';
import { useDaySummary } from '@/hooks/use-day-summary';
import { useObservedEnergy } from '@/hooks/use-observed-energy';
import { useHasPremiumAccess } from '@/hooks/use-premium-access';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useRevenueCatPremiumEntitlement } from '@/hooks/use-revenuecat-premium-entitlement';
import {
  getCalorieGoalDisplay,
  getDynamicCalorieGoalDisplay,
} from '@/lib/home';
import {
  buildHomeNutrientTileEntries,
  type NutrientKey,
} from '@/lib/home-nutrients';
import type { TodayMealItem } from '@/lib/meals';
import { scaleMacrosForSportCalories } from '@/lib/sport-macro-scaling';
import {
  buildWidgetSnapshot,
  widgetSnapshotComparableJson,
  writeWidgetSnapshot,
} from '@/lib/widget-snapshot';
import { formatKcal } from '@/utils/format';

const CALORIE_GOAL_ACCENT = '#4F46E5';
const CALORIE_OVER_GOAL_COLOR = '#D97706';

/** Dev-only: set e.g. 2269 to preview over-goal layout in the simulator */
const DEV_PREVIEW_CONSUMED_CALORIES = 0;

const ITEM_MACRO_FIELD: Record<NutrientKey, keyof TodayMealItem> = {
  protein: 'protein_g',
  carbs: 'carbs_g',
  fat: 'fat_g',
  fiber: 'fiber_g',
};

function resolveDayNutrientCoverage(
  items: TodayMealItem[],
  key: NutrientKey,
): NutrientTileState {
  // No meals today → known zero, not unknown.
  if (items.length === 0) {
    return 'value';
  }

  const field = ITEM_MACRO_FIELD[key];
  let present = 0;

  for (const item of items) {
    if (item[field] != null) {
      present += 1;
    }
  }

  if (present === 0) {
    return 'empty';
  }

  if (present === items.length) {
    return 'value';
  }

  return 'partial';
}

type DaySummaryBlockProps = {
  date: string;
};

export function DaySummaryBlock({ date }: DaySummaryBlockProps) {
  const { t } = useTranslation();
  const lastWidgetSnapshotJsonRef = useRef<string | null>(null);
  const {
    userId,
    isToday,
    isLoading,
    hasCalorieGoalSource,
    dailyCalorieGoal,
    dayGoal,
    consumption,
    dietPreference,
    latestWeightKg,
    healthConnectedPreference,
    adaptMacrosToTraining,
    sportEnergyDay,
    activeEnergyBurned,
  } = useDaySummary(date);

  const { data: dayMeals } = useDayMeals(userId, date);
  const { data: profileSettings } = useProfileSettings(userId);
  const profile = profileSettings?.profile;
  const { data: observedEnergy } = useObservedEnergy({
    userId,
    biologicalSex: profile?.biological_sex,
    birthDate: profile?.birth_date,
    heightCm: profile?.height_cm,
    weightKg: profile?.latest_weight_kg ?? latestWeightKg,
    activityLevel: profile?.activity_level,
    healthConnected: healthConnectedPreference === true,
  });
  const observedReady = observedEnergy?.status === 'ready';

  const { hasAccess: hasPremiumAccessDb } = useHasPremiumAccess(userId);
  const { isPremiumEntitlementActive } = useRevenueCatPremiumEntitlement();
  const isPremiumForWidget = isPremiumEntitlementActive || hasPremiumAccessDb;

  const hasCalorieGoal = hasCalorieGoalSource && dailyCalorieGoal != null;
  const consumedCalories = __DEV__
    ? DEV_PREVIEW_CONSUMED_CALORIES || (consumption?.kcal ?? 0)
    : (consumption?.kcal ?? 0);

  const burnedForDynamicGoal =
    sportEnergyDay?.totalActiveKcal ?? activeEnergyBurned ?? null;

  const calorieGoalDisplay = useMemo(() => {
    if (!hasCalorieGoal || dailyCalorieGoal == null) {
      return null;
    }

    if (
      healthConnectedPreference &&
      adaptMacrosToTraining &&
      burnedForDynamicGoal != null &&
      !observedReady
    ) {
      return getDynamicCalorieGoalDisplay(
        dailyCalorieGoal,
        consumedCalories,
        burnedForDynamicGoal,
      );
    }

    return getCalorieGoalDisplay(dailyCalorieGoal, consumedCalories);
  }, [
    adaptMacrosToTraining,
    burnedForDynamicGoal,
    consumedCalories,
    dailyCalorieGoal,
    hasCalorieGoal,
    healthConnectedPreference,
    observedReady,
  ]);

  const calorieBarWidthPercent = useMemo(() => {
    if (calorieGoalDisplay == null) {
      return 0;
    }

    if (calorieGoalDisplay.isOverGoal) {
      return 100;
    }

    const goal =
      calorieGoalDisplay.mode === 'dynamic'
        ? calorieGoalDisplay.dailyGoal + (calorieGoalDisplay.activeEnergyBurned ?? 0)
        : calorieGoalDisplay.dailyGoal;

    if (goal <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (calorieGoalDisplay.consumedToday / goal) * 100));
  }, [calorieGoalDisplay]);

  const openMacroGoalsEditor = useCallback(() => {
    if (latestWeightKg == null) {
      router.push({ pathname: '/onboarding', params: { mode: 'review' } } as Href);
      return;
    }

    router.push('/koli/macro-goals' as Href);
  }, [latestWeightKg]);

  const openCalorieGoalSettings = useCallback(() => {
    router.push('/koli/calorie-goal' as Href);
  }, []);

  const nutrientTiles = useMemo(() => {
    const macros = consumption;
    const goal = dayGoal;
    const basisKcal = dailyCalorieGoal;
    const baseProteinG = goal?.proteinG ?? null;
    const baseFatG = goal?.fatG ?? null;
    const baseCarbsG = goal?.carbsG ?? null;

    let proteinGoal = baseProteinG;
    let fatGoal = baseFatG;
    let carbsGoal = baseCarbsG;

    if (
      adaptMacrosToTraining &&
      basisKcal != null &&
      baseProteinG != null &&
      baseFatG != null &&
      baseCarbsG != null
    ) {
      const scaled =
        sportEnergyDay != null
          ? scaleMacrosForSportCalories({
              basisKcal,
              segments: sportEnergyDay.segments,
              proteinG: baseProteinG,
              fatBasisG: baseFatG,
              carbsBasisG: baseCarbsG,
              weightKg: latestWeightKg,
            })
          : scaleMacrosForSportCalories({
              basisKcal,
              sportKcal:
                healthConnectedPreference === true && activeEnergyBurned != null
                  ? activeEnergyBurned
                  : 0,
              proteinG: baseProteinG,
              fatBasisG: baseFatG,
              carbsBasisG: baseCarbsG,
              weightKg: latestWeightKg,
            });
      if (scaled.ok) {
        proteinGoal = scaled.proteinG;
        fatGoal = scaled.fatG;
        carbsGoal = scaled.carbsG;
      }
    }

    const dayItems = (dayMeals ?? []).flatMap((meal) => meal.items);
    // undefined = still loading; [] = confirmed empty day → show 0, not "—".
    const mealsResolved = dayMeals != null;
    const hasMeals = (dayMeals ?? []).length > 0;
    const coverage: Record<NutrientKey, NutrientTileState> = {
      protein: resolveDayNutrientCoverage(dayItems, 'protein'),
      carbs: resolveDayNutrientCoverage(dayItems, 'carbs'),
      fat: resolveDayNutrientCoverage(dayItems, 'fat'),
      fiber: resolveDayNutrientCoverage(dayItems, 'fiber'),
    };

    const resolvedTotal = (
      key: NutrientKey,
      macroValue: number | null | undefined,
    ): number | null => {
      if (coverage[key] === 'empty') {
        return null;
      }
      if (macroValue != null) {
        return macroValue;
      }
      return mealsResolved && !hasMeals ? 0 : null;
    };

    return buildHomeNutrientTileEntries({
      dietPreference,
      labels: {
        protein: t('home.nutrients.protein'),
        carbs: t('home.nutrients.carbs'),
        fat: t('home.nutrients.fat'),
        fiber: t('home.nutrients.fiber'),
      },
      totals: {
        protein: resolvedTotal('protein', macros?.proteinG),
        carbs: resolvedTotal('carbs', macros?.carbsG),
        fat: resolvedTotal('fat', macros?.fatG),
        fiber: resolvedTotal('fiber', macros?.fiberG),
      },
      unit: t('home.nutrients.unitGrams'),
    }).map((entry) => ({
      ...entry,
      coverage: coverage[entry.key],
      goalValue:
        entry.key === 'protein'
          ? proteinGoal
          : entry.key === 'carbs'
            ? carbsGoal
            : entry.key === 'fat'
              ? fatGoal
              : entry.key === 'fiber'
                ? (goal?.fiberG ?? null)
                : null,
      onPress: openMacroGoalsEditor,
    }));
  }, [
    activeEnergyBurned,
    adaptMacrosToTraining,
    dailyCalorieGoal,
    consumption,
    dayGoal,
    dayMeals,
    dietPreference,
    healthConnectedPreference,
    latestWeightKg,
    openMacroGoalsEditor,
    sportEnergyDay,
    t,
  ]);

  const calorieMacroRows = useMemo((): HomeProgressRowItem[] => {
    return nutrientTiles.map((tile) => ({
      key: tile.key,
      label: tile.label,
      actual: tile.value,
      goal: tile.goalValue ?? null,
      decimals: 0 as const,
      coverage: tile.coverage,
      onPress: tile.onPress,
    }));
  }, [nutrientTiles]);

  useEffect(() => {
    if (!isToday || calorieGoalDisplay == null) {
      return;
    }

    const unit = t('home.nutrients.unitGrams');
    const goalFormatted = formatKcal(calorieGoalDisplay.dailyGoalContextValue);
    const burned = calorieGoalDisplay.activeEnergyBurned ?? 0;
    const burnedFormatted = formatKcal(burned);
    const totalFormatted = formatKcal(calorieGoalDisplay.dailyGoal + burned);
    const snapshot = buildWidgetSnapshot({
      dateKey: date,
      remainingValue: formatKcal(calorieGoalDisplay.mainValue),
      isOverGoal: calorieGoalDisplay.isOverGoal,
      labelRemaining: t(
        calorieGoalDisplay.mode === 'dynamic'
          ? 'home.calorieGoal.dynamicLabel'
          : 'home.calorieGoal.label',
      ),
      labelFooter:
        calorieGoalDisplay.mode === 'dynamic'
          ? t('home.calorieGoal.dynamicDailyGoalReference', {
              total: totalFormatted,
              burned: burnedFormatted,
            })
          : t('home.calorieGoal.dailyGoalReference', {
              goal: goalFormatted,
            }),
      labelFooterCompact:
        calorieGoalDisplay.mode === 'dynamic'
          ? `${totalFormatted} (+${burnedFormatted})`
          : goalFormatted,
      macros: nutrientTiles.map((tile) => ({
        label: tile.label,
        value: tile.value == null ? '–' : `${Math.round(tile.value)}${unit}`,
      })),
      premium: isPremiumForWidget,
      progress: calorieBarWidthPercent / 100,
    });

    const comparable = widgetSnapshotComparableJson(snapshot);
    if (comparable === lastWidgetSnapshotJsonRef.current) {
      return;
    }

    lastWidgetSnapshotJsonRef.current = comparable;
    writeWidgetSnapshot(snapshot);
  }, [
    calorieBarWidthPercent,
    calorieGoalDisplay,
    date,
    isPremiumForWidget,
    isToday,
    nutrientTiles,
    t,
  ]);

  if (isLoading) {
    return (
      <View
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="items-center py-10">
        <ActivityIndicator size="small" color={ONBOARDING_ACCENT} />
      </View>
    );
  }

  if (calorieGoalDisplay) {
    return (
      <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
        <View className="px-5 py-6">
          <Text
            style={[
              styles.calorieHeroValue,
              {
                color: calorieGoalDisplay.isOverGoal
                  ? CALORIE_OVER_GOAL_COLOR
                  : CALORIE_GOAL_ACCENT,
                textAlign: 'center',
              },
            ]}>
            {formatKcal(calorieGoalDisplay.mainValue)}
          </Text>
          {calorieGoalDisplay.showOverLabel ? (
            <Text className="mt-1 text-center text-base font-medium text-amber-700">
              {t('home.calorieGoal.overGoal')}
            </Text>
          ) : null}
          <Text
            className={`text-center text-sm text-gray-500 ${calorieGoalDisplay.showOverLabel ? 'mt-1' : 'mt-2'}`}>
            {calorieGoalDisplay.mode === 'dynamic'
              ? t('home.calorieGoal.dynamicDailyGoalReference', {
                  total: formatKcal(
                    calorieGoalDisplay.dailyGoal +
                      (calorieGoalDisplay.activeEnergyBurned ?? 0),
                  ),
                  burned: formatKcal(calorieGoalDisplay.activeEnergyBurned ?? 0),
                })
              : t('home.calorieGoal.dailyGoalReference', {
                  goal: formatKcal(calorieGoalDisplay.dailyGoalContextValue),
                })}
          </Text>
          <View className="mt-5">
            <HomeProgressRows rows={calorieMacroRows} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={getOnboardingSecondarySurfaceStyle()}>
      <Pressable
        onPress={openCalorieGoalSettings}
        style={({ pressed }) => [
          pressed && { backgroundColor: GLASS_SURFACE_PRESSED.backgroundColor },
        ]}>
        <View className="flex-row items-center px-4 py-3">
          <Text className="flex-1 text-sm text-gray-500">
            {t('home.calorieGoal.emptyPrefix')}
            <Text className="font-medium text-[#4F46E5]">
              {t('home.calorieGoal.emptyAction')}
            </Text>
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  calorieHeroValue: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 52,
  },
});
