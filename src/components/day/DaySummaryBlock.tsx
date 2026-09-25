import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeProgressRows, type HomeProgressRowItem } from '@/components/home/home-progress-rows';
import type { NutrientTileState } from '@/components/home/nutrient-tile';
import { SportEnergyBreakdownSheet } from '@/components/day/SportEnergyBreakdownSheet';
import {
  getOnboardingIdleCardStyle,
  getOnboardingSecondarySurfaceStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { calculateAge, calculateBmr } from '@/lib/calorie-goal-math';
import { balanceMacroGoalsToCalories } from '@/lib/macro-display-balance';
import { resolveProteinRefKg } from '@/lib/macro-rules';
import { parseDateOnly } from '@/lib/day-window';
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
  /**
   * One-line summary for the Today tab: kcal left (or over) and protein, from
   * the same numbers as the full card. Tapping calls onPress (opens Ernährung).
   */
  compact?: boolean;
  onPress?: () => void;
};

export function DaySummaryBlock({ date, compact = false, onPress }: DaySummaryBlockProps) {
  const { t } = useTranslation();
  const lastWidgetSnapshotJsonRef = useRef<string | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
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

  const profileBmr = useMemo(() => {
    if (
      !profile?.birth_date ||
      profile.height_cm == null ||
      (profile.latest_weight_kg ?? latestWeightKg) == null
    ) {
      return null;
    }

    return Math.round(
      calculateBmr({
        biologicalSex: profile.biological_sex ?? 'prefer_not_to_say',
        weightKg: (profile.latest_weight_kg ?? latestWeightKg)!,
        heightCm: profile.height_cm,
        age: calculateAge(parseDateOnly(profile.birth_date)),
      }),
    );
  }, [latestWeightKg, profile]);

  const macroRefWeightKg = useMemo(() => {
    const weightKg = profile?.latest_weight_kg ?? latestWeightKg;
    if (weightKg == null) {
      return null;
    }

    return resolveProteinRefKg({
      weightKg,
      heightCm: profile?.height_cm ?? null,
      targetWeightKg: profile?.target_weight_kg ?? null,
    });
  }, [latestWeightKg, profile]);

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
        profileBmr,
      );
    }

    return getCalorieGoalDisplay(dailyCalorieGoal, consumedCalories, profileBmr);
  }, [
    adaptMacrosToTraining,
    burnedForDynamicGoal,
    consumedCalories,
    dailyCalorieGoal,
    hasCalorieGoal,
    healthConnectedPreference,
    observedReady,
    profileBmr,
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

    // The floor can lift the shown calories above base + movement. Re-balance so
    // the bars still add up to the number the user reads above them.
    if (
      calorieGoalDisplay != null &&
      proteinGoal != null &&
      fatGoal != null &&
      carbsGoal != null
    ) {
      const shownKcal =
        calorieGoalDisplay.mode === 'dynamic'
          ? calorieGoalDisplay.dailyGoal + (calorieGoalDisplay.activeEnergyBurned ?? 0)
          : calorieGoalDisplay.dailyGoal;
      const balanced = balanceMacroGoalsToCalories({
        targetKcal: shownKcal,
        proteinG: proteinGoal,
        fatG: fatGoal,
        carbsG: carbsGoal,
        bodyWeightKg: profile?.latest_weight_kg ?? latestWeightKg,
        refWeightKg: macroRefWeightKg,
      });
      proteinGoal = balanced.proteinG;
      fatGoal = balanced.fatG;
      carbsGoal = balanced.carbsG;
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
                // Deliberately unbalanced: fiber carries no energy, so it is not
                // part of the protein/fat/carb sum. Its own target does track
                // calories (max(30 g, 14 g per 1000 kcal)), so above ~2143 kcal
                // it lags a floored or movement-raised number. Left as-is.
                ? (goal?.fiberG ?? null)
                : null,
    }));
  }, [
    activeEnergyBurned,
    adaptMacrosToTraining,
    calorieGoalDisplay,
    dailyCalorieGoal,
    consumption,
    dayGoal,
    dayMeals,
    dietPreference,
    healthConnectedPreference,
    latestWeightKg,
    macroRefWeightKg,
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

  if (compact && calorieGoalDisplay) {
    const protein = nutrientTiles.find((tile) => tile.key === 'protein');
    return (
      <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
        <Pressable
          testID="today.nutrition"
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          className="flex-row items-center px-5 py-4">
          <View className="flex-1">
            <Text
              style={[
                styles.compactValue,
                {
                  color: calorieGoalDisplay.isOverGoal
                    ? CALORIE_OVER_GOAL_COLOR
                    : CALORIE_GOAL_ACCENT,
                },
              ]}>
              {formatKcal(calorieGoalDisplay.mainValue)}
            </Text>
            <Text className="text-sm text-gray-500">
              {calorieGoalDisplay.isOverGoal
                ? t('today.nutrition.kcalOver')
                : t('today.nutrition.kcalLeft')}
            </Text>
          </View>
          {protein && protein.value != null ? (
            <View className="items-end">
              <Text className="text-base font-semibold text-gray-900">
                {protein.goalValue != null
                  ? t('today.nutrition.proteinOf', {
                      eaten: Math.round(protein.value),
                      target: Math.round(protein.goalValue),
                    })
                  : t('today.nutrition.proteinOnly', { eaten: Math.round(protein.value) })}
              </Text>
              <Text className="text-sm text-gray-500">{t('today.nutrition.protein')}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  }

  if (calorieGoalDisplay) {
    const canOpenBreakdown =
      calorieGoalDisplay.mode === 'dynamic' &&
      sportEnergyDay != null &&
      sportEnergyDay.breakdown.some((item) => item.kcal > 0);

    const referenceText =
      calorieGoalDisplay.mode === 'dynamic'
        ? t('home.calorieGoal.dynamicDailyGoalReference', {
            total: formatKcal(
              calorieGoalDisplay.dailyGoal + (calorieGoalDisplay.activeEnergyBurned ?? 0),
            ),
            burned: formatKcal(calorieGoalDisplay.activeEnergyBurned ?? 0),
          })
        : t('home.calorieGoal.dailyGoalReference', {
            goal: formatKcal(calorieGoalDisplay.dailyGoalContextValue),
          });

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
          {canOpenBreakdown ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.calorieGoal.sportBreakdown.title')}
              onPress={() => setBreakdownOpen(true)}
              hitSlop={8}
              style={({ pressed }) => [
                { marginTop: calorieGoalDisplay.showOverLabel ? 4 : 8 },
                pressed && { opacity: 0.7 },
              ]}>
              <Text className="text-center text-sm text-gray-500">{referenceText}</Text>
            </Pressable>
          ) : (
            <Text
              className={`text-center text-sm text-gray-500 ${calorieGoalDisplay.showOverLabel ? 'mt-1' : 'mt-2'}`}>
              {referenceText}
            </Text>
          )}
          <View className="mt-5">
            <HomeProgressRows rows={calorieMacroRows} />
          </View>
        </View>
        {sportEnergyDay != null ? (
          <SportEnergyBreakdownSheet
            visible={breakdownOpen}
            onClose={() => setBreakdownOpen(false)}
            sportEnergyDay={sportEnergyDay}
          />
        ) : null}
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
  compactValue: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
});
