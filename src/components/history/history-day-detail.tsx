import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE, GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { useDayCalorieGoal, useDayMeals } from '@/hooks/use-day-meals';
import {
  isDayEditable,
  listRecentLocalDateKeys,
  localDateKey,
  parseDateOnly,
} from '@/lib/day-window';
import { formatTodayMealQuantityLabel, type TodayMeal } from '@/lib/meals';
import { useOnboardingStore } from '@/stores/onboarding-store';

const HISTORY_DAY_COUNT = 7;

type HistoryDayDetailProps = {
  userId: string | undefined;
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  onMealPress: (meal: TodayMeal) => void;
  onAddMeal: () => void;
};

function formatDayPillLabel(dateKey: string, locale: string, t: (key: string) => string): string {
  const today = localDateKey();
  const yesterdayDate = new Date();
  yesterdayDate.setHours(0, 0, 0, 0);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate);

  if (dateKey === today) {
    return t('history.day.today');
  }

  if (dateKey === yesterday) {
    return t('history.day.yesterday');
  }

  const date = parseDateOnly(dateKey);
  date.setHours(12, 0, 0, 0);
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

function formatMealTime(eatenAt: string, locale: string): string {
  return new Date(eatenAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildIngredientSummary(meal: TodayMeal, unnamed: string): string {
  const names = meal.items.map((item) => item.name.trim()).filter(Boolean);
  if (names.length === 0) {
    return unnamed;
  }

  const preview = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${preview}…` : preview;
}

export function HistoryDayDetail({
  userId,
  selectedDateKey,
  onSelectDateKey,
  onMealPress,
  onAddMeal,
}: HistoryDayDetailProps) {
  const { t, i18n } = useTranslation();
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const todayKey = localDateKey();
  const dateKeys = useMemo(
    () => listRecentLocalDateKeys(HISTORY_DAY_COUNT),
    [todayKey],
  );
  const editable = isDayEditable(selectedDateKey);

  const { data: meals, isLoading: mealsLoading } = useDayMeals(userId, selectedDateKey);
  const { data: dayGoal, isLoading: goalLoading } = useDayCalorieGoal(userId, selectedDateKey);

  const dayTotalKcal = useMemo(
    () => (meals ?? []).reduce((sum, meal) => sum + meal.total_kcal, 0),
    [meals],
  );

  const goalSummary = useMemo(() => {
    if (goalLoading) {
      return null;
    }

    if (dayGoal == null) {
      return t('history.day.goalNotSet');
    }

    return t('history.day.goalProgress', {
      consumed: Math.round(dayTotalKcal),
      goal: Math.round(dayGoal),
    });
  }, [dayGoal, dayTotalKcal, goalLoading, t]);

  return (
    <View className="mt-8">
      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('history.day.sectionTitle')}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {dateKeys.map((dateKey) => {
          const active = dateKey === selectedDateKey;
          return (
            <Pressable
              key={dateKey}
              onPress={() => onSelectDateKey(dateKey)}
              style={[
                {
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: active
                    ? GLASS_SURFACE.backgroundColor
                    : 'rgba(255,255,255,0.35)',
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? '#C7D2FE' : GLASS_SURFACE.borderColor,
                },
              ]}>
              <Text
                className={`text-xs font-semibold ${active ? 'text-gray-900' : 'text-gray-500'}`}>
                {formatDayPillLabel(dateKey, i18n.language, t)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={[
          getOnboardingIdleCardStyle(),
          { borderRadius: ONBOARDING_CARD_RADIUS, marginTop: 12 },
        ]}>
        <View className="px-4 py-4">
          {goalSummary ? (
            <Text className="mb-3 text-sm font-medium text-gray-600">{goalSummary}</Text>
          ) : (
            <View className="mb-3 h-5 justify-center">
              <ActivityIndicator size="small" color={ONBOARDING_ACCENT} />
            </View>
          )}

          {!editable ? (
            <Text className="mb-3 text-sm text-gray-500">
              {t('history.day.readOnlyHint')}
            </Text>
          ) : null}

          {mealsLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color={ONBOARDING_ACCENT} />
            </View>
          ) : (meals?.length ?? 0) > 0 ? (
            <View style={{ gap: 10 }}>
              {(meals ?? []).map((meal) => {
                const summary = buildIngredientSummary(meal, t('home.meals.unnamedMeal'));
                const content = (
                  <View className="rounded-xl bg-white/55 px-4 py-3">
                    <Text className="text-base font-semibold text-gray-900">{summary}</Text>
                    <Text className="mt-1 text-sm text-gray-500">
                      {t('home.meals.rowMeta', {
                        quantity: formatTodayMealQuantityLabel(meal, t, unitSystem),
                        kcal: meal.total_kcal,
                        time: formatMealTime(meal.eaten_at, i18n.language),
                      })}
                    </Text>
                  </View>
                );

                if (!editable) {
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
          ) : (
            <Text className="py-4 text-center text-sm text-gray-500">
              {t('history.day.emptyMeals')}
            </Text>
          )}

          {editable ? (
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
      </View>
    </View>
  );
}
