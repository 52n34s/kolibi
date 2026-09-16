import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { TEXT_SECONDARY } from '@/constants/brand';
import { useDayMeals } from '@/hooks/use-day-meals';
import {
  buildMealListTitle,
  formatTodayMealQuantityLabel,
  getMealMacroDisplay,
  type TodayMeal,
} from '@/lib/meals';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { formatKcal } from '@/utils/format';

type DayMealListProps = {
  date: string;
  editable: boolean;
  /** Required for edit when editable — parent owns the sheet state machine. */
  onMealPress?: (meal: TodayMeal) => void;
  /** When set with editable, shows “add meal”. Omit on Home (FABs cover capture). */
  onAddMeal?: () => void;
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

export function DayMealList({
  date,
  editable,
  onMealPress,
  onAddMeal,
}: DayMealListProps) {
  const { t, i18n } = useTranslation();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const { data: meals, isLoading } = useDayMeals(userId, date);
  const hasMeals = (meals?.length ?? 0) > 0;
  const showAddMeal = editable && onAddMeal != null;

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

  return (
    <View>
      {!hasMeals ? (
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
      ) : (
        <View style={{ gap: 10 }}>
          {mealRows.map((meal) => {
            const summary = buildMealListTitle(meal);
            const timeLabel = formatMealTime(meal.eaten_at, i18n.language);
            const macrosLine = formatMealMacrosLine(meal, t);
            const content = (
              <View
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
              </View>
            );

            if (!editable || onMealPress == null) {
              return <View key={meal.id}>{content}</View>;
            }

            return (
              <Pressable
                key={meal.id}
                accessibilityRole="button"
                onPress={() => onMealPress(meal)}>
                {content}
              </Pressable>
            );
          })}
        </View>
      )}

      {showAddMeal ? (
        <Pressable
          className="mt-4"
          onPress={onAddMeal}
          style={({ pressed }) => [
            {
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(79, 70, 229, 0.25)',
              backgroundColor: pressed
                ? GLASS_SURFACE_PRESSED.backgroundColor
                : 'rgba(79, 70, 229, 0.08)',
              paddingVertical: 12,
              alignItems: 'center',
            },
          ]}>
          <Text className="text-sm font-semibold text-[#4F46E5]">
            {t('history.day.addMeal')}
          </Text>
        </Pressable>
      ) : null}
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
