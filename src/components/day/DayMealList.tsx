import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useDayMeals, useHasLoggedAnyMeal } from '@/hooks/use-day-meals';
import {
  formatMacroTotalsLine,
  groupMeals,
  isMealGroupExpanded,
  mealGroupLabel,
  sumMealGroupTotals,
} from '@/lib/meal-groups';
import {
  buildMealListTitle,
  formatMealMacrosLine,
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
  const { data: hasLoggedBefore = false } = useHasLoggedAnyMeal(userId);
  const showAddMeal = editable && onAddMeal != null;

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  const mealRows = useMemo(() => meals ?? [], [meals]);
  /** Newest meal first, like the entry list before; entries inside stay chronological. */
  const mealGroups = useMemo(
    () =>
      groupMeals(mealRows, {
        eatenAt: (meal) => meal.eaten_at,
        kcal: (meal) => meal.total_kcal,
      }).reverse(),
    [mealRows],
  );
  // Keys the user tapped; see isMealGroupExpanded for the start state.
  const [toggledGroupKeys, setToggledGroupKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleGroup = useCallback((groupKey: string) => {
    setToggledGroupKeys((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const renderMealEntry = (meal: TodayMeal) => {
    const summary = buildMealListTitle(meal);
    const timeLabel = formatMealTime(meal.eaten_at, i18n.language);
    const macrosLine = formatMealMacrosLine(meal, t);
    const content = (
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
    );

    if (!editable || onMealPress == null) {
      return (
        <View key={meal.id} style={styles.groupEntry}>
          {content}
        </View>
      );
    }

    return (
      <Pressable
        key={meal.id}
        accessibilityRole="button"
        onPress={() => onMealPress(meal)}
        style={({ pressed }) => [
          styles.groupEntry,
          pressed ? { backgroundColor: GLASS_SURFACE_PRESSED.backgroundColor } : null,
        ]}>
        {content}
      </Pressable>
    );
  };

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
              {t('history.day.emptyMeals')}
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              {t(hasLoggedBefore ? 'home.meals.emptySubtitleReturning' : 'home.meals.emptySubtitle')}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {mealGroups.map((group) => {
            const groupKey = group.entries[0]!.id;
            const expanded = isMealGroupExpanded(group, groupKey, toggledGroupKeys);
            const totals = sumMealGroupTotals(
              group.entries.map((meal) => {
                const macros = getMealMacroDisplay(meal);
                return { kcal: meal.total_kcal, ...macros };
              }),
            );
            const time = formatMealTime(group.startAt.toISOString(), i18n.language);
            const meta = t('mealGroups.header', {
              count: group.entries.length,
              time,
              kcal: formatKcal(totals.kcal),
            });
            const macrosLine = formatMacroTotalsLine(totals, {
              protein: t('home.meals.macroAbbrevProtein'),
              carbs: t('home.meals.macroAbbrevCarbs'),
              fat: t('home.meals.macroAbbrevFat'),
              fiber: t('home.meals.macroAbbrevFiber'),
            });

            return (
              <View
                key={groupKey}
                style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityHint={t(
                    expanded ? 'mealGroups.hideEntries' : 'mealGroups.showEntries',
                  )}
                  onPress={() => toggleGroup(groupKey)}
                  className="flex-row items-center px-4 py-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {t(`mealGroups.slot.${mealGroupLabel(group)}`)}
                    </Text>
                    <Text className="mt-1 text-sm text-gray-500">{meta}</Text>
                    {macrosLine ? (
                      <Text style={styles.macrosLine} numberOfLines={1} ellipsizeMode="tail">
                        {macrosLine}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={TEXT_SECONDARY}
                  />
                </Pressable>
                {expanded ? (
                  <View style={styles.groupEntries}>
                    {group.entries.map((meal) => renderMealEntry(meal))}
                  </View>
                ) : null}
              </View>
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
  groupEntries: {
    paddingBottom: 4,
  },
  groupEntry: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17, 24, 39, 0.08)',
  },
});
