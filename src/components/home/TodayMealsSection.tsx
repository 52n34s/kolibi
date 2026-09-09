import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { TEXT_SECONDARY } from '@/constants/brand';
import {
  buildMealListTitle,
  formatTodayMealQuantityLabel,
  getMealMacroDisplay,
  type TodayMeal,
} from '@/lib/meals';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { formatKcal } from '@/utils/format';

type TodayMealsSectionProps = {
  meals: TodayMeal[] | undefined;
  isLoading: boolean;
  onMealPress?: (meal: TodayMeal) => void;
};

function formatMealTime(eatenAt: string, locale: string): string {
  return new Date(eatenAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMealMacrosLine(
  meal: TodayMeal,
  t: (key: string) => string,
): string | null {
  const macros = getMealMacroDisplay(meal);
  const parts: string[] = [];

  if (macros.proteinG != null) {
    parts.push(
      `${Math.round(macros.proteinG)} g ${t('home.meals.macroAbbrevProtein')}`,
    );
  }
  if (macros.carbsG != null) {
    parts.push(`${Math.round(macros.carbsG)} g ${t('home.meals.macroAbbrevCarbs')}`);
  }
  if (macros.fatG != null) {
    parts.push(`${Math.round(macros.fatG)} g ${t('home.meals.macroAbbrevFat')}`);
  }
  if (macros.fiberG != null) {
    parts.push(`${Math.round(macros.fiberG)} g ${t('home.meals.macroAbbrevFiber')}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function TodayMealsSection({ meals, isLoading, onMealPress }: TodayMealsSectionProps) {
  const { t, i18n } = useTranslation();
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const hasMeals = (meals?.length ?? 0) > 0;

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  const mealRows = useMemo(() => meals ?? [], [meals]);

  if (isLoading) {
    return (
      <View
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="items-center py-10">
        <ActivityIndicator size="small" color={ONBOARDING_ACCENT} />
      </View>
    );
  }

  if (!hasMeals) {
    return (
      <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
        <View className="items-center px-8 py-12">
          <Image
            source={require('@/assets/images/koli-thinking.png')}
            style={{ width: 96, height: 77, marginBottom: 16 }}
            contentFit="contain"
          />
          <Text className="text-center text-base font-semibold text-gray-900">
            {t('home.meals.emptyTitle')}
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-500">
            {t('home.meals.emptySubtitle')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {mealRows.map((meal) => {
        const summary = buildMealListTitle(meal);
        const timeLabel = formatMealTime(meal.eaten_at, i18n.language);
        const macrosLine = formatMealMacrosLine(meal, t);

        return (
          <Pressable
            key={meal.id}
            accessibilityRole="button"
            onPress={() => onMealPress?.(meal)}
            style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
            <View className="px-4 py-3">
              <Text
                className="text-base font-semibold text-gray-900"
                numberOfLines={1}
                ellipsizeMode="tail">
                {summary || t('home.meals.unnamedMeal')}
              </Text>
              <Text className="mt-1 text-sm text-gray-500">
                {t('home.meals.rowMeta', {
                  quantity: formatTodayMealQuantityLabel(meal, t, unitSystem),
                  kcal: formatKcal(meal.total_kcal),
                  time: timeLabel,
                })}
              </Text>
              {macrosLine ? (
                <Text style={styles.macrosLine} numberOfLines={1} ellipsizeMode="tail">
                  {macrosLine}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  macrosLine: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
});
