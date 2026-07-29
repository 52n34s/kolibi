import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CalorieBarChart } from '@/components/history/calorie-bar-chart';
import { HistoryDayDetail } from '@/components/history/history-day-detail';
import { WeightLineChart } from '@/components/history/weight-line-chart';
import {
  getOnboardingIdleCardStyle,
  getOnboardingSecondarySurfaceStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { ManualMealEntrySheet } from '@/components/scan/ManualMealEntrySheet';
import { MealEditSheet } from '@/components/scan/MealEditSheet';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { useHistory } from '@/hooks/use-history';
import { useRevenueCatPremiumEntitlement } from '@/hooks/use-revenuecat-premium-entitlement';
import {
  isDayEditable,
  localDateKey,
  parseDateOnly,
  resolveEatenAtForLocalDate,
} from '@/lib/day-window';
import { getLatestWeightKg } from '@/lib/history';
import { MEAL_SOURCE } from '@/lib/meal-sources';
import {
  deleteMeal,
  saveScannedMeal,
  updateMealWithItems,
  type TodayMeal,
} from '@/lib/meals';
import { fetchHasPremiumAccess } from '@/lib/subscription';
import { formatWeightForDisplay } from '@/lib/weight-logs';
import type { EditableMealItem } from '@/services/mealVision/types';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

/** Single Modal at a time — never present edit/add/paywall concurrently (iOS deadlock). */
type HistorySheetMode =
  | { kind: 'none' }
  | { kind: 'edit'; mealId: string }
  | { kind: 'add' }
  | { kind: 'paywall' };

function formatShortDayLabel(dateKey: string, locale: string): string {
  const date = parseDateOnly(dateKey);
  date.setHours(12, 0, 0, 0);
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

export function HistoryPanel() {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const { isPremiumEntitlementActive } = useRevenueCatPremiumEntitlement();
  const { data, isLoading, isError, error } = useHistory(userId);

  const [selectedDateKey, setSelectedDateKey] = useState(() => localDateKey());
  const [sheetMode, setSheetMode] = useState<HistorySheetMode>({ kind: 'none' });
  const [pendingSheet, setPendingSheet] = useState<HistorySheetMode | null>(null);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [isSavingManualMeal, setIsSavingManualMeal] = useState(false);

  const chartWidth = windowWidth - 48;
  const dayEditable = isDayEditable(selectedDateKey);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  const latestWeightKg = useMemo(
    () => (data ? getLatestWeightKg(data.weightLogs) : null),
    [data],
  );

  const weightLabel = useMemo(() => {
    if (latestWeightKg == null) {
      return t('history.weight.notLogged');
    }

    return formatWeightForDisplay({
      weightKg: latestWeightKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
  }, [latestWeightKg, t, unitSystem]);

  const weightValues = useMemo(
    () => data?.weightLogs.map((entry) => entry.weight_kg) ?? [],
    [data?.weightLogs],
  );

  const targetWeightKg = data?.targetWeightKg ?? null;

  const targetLineLabel = useMemo(() => {
    if (targetWeightKg == null) {
      return null;
    }

    const formatted = formatWeightForDisplay({
      weightKg: targetWeightKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });

    return `${t('history.weight.targetLabel')} ${formatted}`;
  }, [targetWeightKg, t, unitSystem]);

  const calorieValues = useMemo(
    () => data?.dailyCalories.map((day) => day.totalCalories) ?? [],
    [data?.dailyCalories],
  );

  const hasWeightData = (data?.weightLogs.length ?? 0) > 0;
  const hasCalorieData = calorieValues.some((value) => value > 0);

  const gatePremiumAccess = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    if (isPremiumEntitlementActive) {
      return true;
    }

    try {
      return (await fetchHasPremiumAccess(userId)) === true;
    } catch (gateError) {
      console.error('[History] premium access check failed:', gateError);
      return false;
    }
  }, [isPremiumEntitlementActive, userId]);

  const openSheet = useCallback((next: HistorySheetMode) => {
    setSheetMode((current) => {
      if (current.kind === 'none') {
        return next;
      }

      setPendingSheet(next);
      return { kind: 'none' };
    });
  }, []);

  const handleSheetDismissed = useCallback(() => {
    if (pendingSheet) {
      const next = pendingSheet;
      setPendingSheet(null);
      setSheetMode(next);
    }
  }, [pendingSheet]);

  async function invalidateDayQueries() {
    if (!userId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['day-meals', userId, selectedDateKey] }),
      queryClient.invalidateQueries({ queryKey: ['history', userId] }),
      queryClient.invalidateQueries({ queryKey: ['today-meals', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
      queryClient.invalidateQueries({
        queryKey: ['calorie-goal-for-date', userId, selectedDateKey],
      }),
    ]);
  }

  function handleMealPress(meal: TodayMeal) {
    if (!dayEditable) {
      return;
    }

    openSheet({ kind: 'edit', mealId: meal.id });
  }

  async function handleAddMealPress() {
    if (!dayEditable) {
      return;
    }

    if (!(await gatePremiumAccess())) {
      openSheet({ kind: 'paywall' });
      return;
    }

    openSheet({ kind: 'add' });
  }

  async function handleMealEditSave(params: {
    mealId: string;
    items: Parameters<typeof updateMealWithItems>[0]['items'];
    removedMealItemIds: string[];
  }) {
    if (!userId) {
      return;
    }

    setIsSavingMealEdit(true);

    try {
      if (!(await gatePremiumAccess())) {
        openSheet({ kind: 'paywall' });
        return;
      }

      await updateMealWithItems({
        mealId: params.mealId,
        userId,
        items: params.items,
        removedMealItemIds: params.removedMealItemIds,
      });
      await invalidateDayQueries();
      setSheetMode({ kind: 'none' });
    } catch (saveError) {
      console.error('[History] meal edit save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.mealEdit.saveError'));
    } finally {
      setIsSavingMealEdit(false);
    }
  }

  async function handleMealDelete(mealId: string) {
    if (!userId) {
      return;
    }

    setIsDeletingMeal(true);

    try {
      await deleteMeal({ mealId, userId });
      await invalidateDayQueries();
      setSheetMode({ kind: 'none' });
    } catch (deleteError) {
      console.error('[History] meal delete failed:', deleteError);
      Alert.alert(t('settings.errors.title'), t('home.mealEdit.saveError'));
    } finally {
      setIsDeletingMeal(false);
    }
  }

  async function handleManualMealSave(items: EditableMealItem[]) {
    if (!userId || !dayEditable) {
      return;
    }

    setIsSavingManualMeal(true);

    try {
      if (!(await gatePremiumAccess())) {
        openSheet({ kind: 'paywall' });
        return;
      }

      await saveScannedMeal({
        userId,
        items,
        source: MEAL_SOURCE.MANUAL,
        eatenAt: resolveEatenAtForLocalDate(selectedDateKey),
      });
      await invalidateDayQueries();
      setSheetMode({ kind: 'none' });
    } catch (saveError) {
      console.error('[History] manual meal save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.manualEntry.saveError'));
    } finally {
      setIsSavingManualMeal(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={ONBOARDING_ACCENT} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-base text-gray-600">
          {error instanceof Error ? error.message : t('history.errors.loadFailed')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        <Text className="mb-3 text-lg font-semibold text-gray-900">
          {t('history.weight.sectionTitle')}
        </Text>

        <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
          <View className="px-5 py-6">
            <Text className="mb-2 text-sm font-medium text-gray-500">
              {t('history.weight.currentLabel')}
            </Text>
            <Text className="text-4xl font-bold text-[#4F46E5]">{weightLabel}</Text>
          </View>
        </View>

        <View
          style={[
            getOnboardingIdleCardStyle(),
            { borderRadius: ONBOARDING_CARD_RADIUS, marginTop: 16 },
          ]}>
          <View className="px-4 py-5">
            {hasWeightData ? (
              <WeightLineChart
                values={weightValues}
                width={chartWidth - 32}
                targetWeightKg={targetWeightKg}
                targetLabel={targetLineLabel}
              />
            ) : (
              <View className="items-center py-8">
                <Ionicons name="analytics-outline" size={28} color="#9CA3AF" />
                <Text className="mt-3 text-center text-sm text-gray-500">
                  {t('history.weight.empty')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text className="mb-3 mt-8 text-lg font-semibold text-gray-900">
          {t('history.calories.sectionTitle')}
        </Text>

        <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
          <View className="px-4 py-5">
            {hasCalorieData ? (
              <>
                <CalorieBarChart values={calorieValues} width={chartWidth - 32} />
                <View className="mt-3 flex-row justify-between px-1">
                  {data?.dailyCalories.map((day) => (
                    <Text key={day.date} className="text-[10px] text-gray-500">
                      {formatShortDayLabel(day.date, i18n.language)}
                    </Text>
                  ))}
                </View>
              </>
            ) : (
              <View className="items-center py-8">
                <Ionicons name="bar-chart-outline" size={28} color="#9CA3AF" />
                <Text className="mt-3 text-center text-sm text-gray-500">
                  {t('history.calories.empty')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <HistoryDayDetail
          userId={userId}
          selectedDateKey={selectedDateKey}
          onSelectDateKey={setSelectedDateKey}
          onMealPress={handleMealPress}
          onAddMeal={() => void handleAddMealPress()}
        />

        <Pressable
          className="mt-6"
          onPress={() => router.replace('/home' as Href)}
          style={({ pressed }) => [
            getOnboardingSecondarySurfaceStyle(),
            pressed && { backgroundColor: GLASS_SURFACE_PRESSED.backgroundColor },
          ]}>
          <View className="flex-row items-center justify-center px-4 py-3">
            <Text className="text-sm font-medium text-[#4F46E5]">
              {t('history.weight.updateOnHome')}
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      <MealEditSheet
        visible={sheetMode.kind === 'edit'}
        mealId={sheetMode.kind === 'edit' ? sheetMode.mealId : null}
        userId={userId ?? null}
        isSaving={isSavingMealEdit}
        isDeleting={isDeletingMeal}
        onClose={() => setSheetMode({ kind: 'none' })}
        onDismissed={handleSheetDismissed}
        onSave={(params) => void handleMealEditSave(params)}
        onDeleteMeal={(mealId) => void handleMealDelete(mealId)}
      />

      <ManualMealEntrySheet
        visible={sheetMode.kind === 'add'}
        isSaving={isSavingManualMeal}
        onClose={() => setSheetMode({ kind: 'none' })}
        onDismissed={handleSheetDismissed}
        onSave={(items) => void handleManualMealSave(items)}
      />

      <PaywallSheet
        visible={sheetMode.kind === 'paywall'}
        userId={userId}
        onClose={() => setSheetMode({ kind: 'none' })}
        onDismissed={handleSheetDismissed}
      />
    </>
  );
}
