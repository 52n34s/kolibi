import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { formatTodayMealQuantityLabel, type TodayMeal } from '@/lib/meals';
import { useOnboardingStore } from '@/stores/onboarding-store';

type TodayMealsSectionProps = {
  meals: TodayMeal[] | undefined;
  isLoading: boolean;
  onMealPress?: (meal: TodayMeal) => void;
};

function buildIngredientSummary(meal: TodayMeal): string {
  const names = meal.items.map((item) => item.name.trim()).filter(Boolean);

  if (names.length === 0) {
    return '';
  }

  const preview = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${preview}…` : preview;
}

function formatMealTime(eatenAt: string, locale: string): string {
  return new Date(eatenAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
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

  return (
    <View className="mt-8">
      <Text className="mb-4 text-lg font-semibold text-gray-900">{t('home.meals.title')}</Text>

      {isLoading ? (
        <View
          style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
          className="items-center py-10">
          <ActivityIndicator size="small" color={ONBOARDING_ACCENT} />
        </View>
      ) : hasMeals ? (
        <View style={{ gap: 10 }}>
          {mealRows.map((meal) => {
            const summary = buildIngredientSummary(meal);
            const timeLabel = formatMealTime(meal.eaten_at, i18n.language);

            return (
              <Pressable
                key={meal.id}
                accessibilityRole="button"
                onPress={() => onMealPress?.(meal)}
                style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
                <View className="px-4 py-3">
                  <Text className="text-base font-semibold text-gray-900">
                    {summary || t('home.meals.unnamedMeal')}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-500">
                    {t('home.meals.rowMeta', {
                      quantity: formatTodayMealQuantityLabel(meal, t, unitSystem),
                      kcal: meal.total_kcal,
                      time: timeLabel,
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
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
      )}
    </View>
  );
}
