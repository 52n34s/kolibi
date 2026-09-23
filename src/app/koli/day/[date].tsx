import { Href, Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';

import { DayMealList } from '@/components/day/DayMealList';
import { DaySummaryBlock } from '@/components/day/DaySummaryBlock';
import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { ManualMealEntrySheet } from '@/components/scan/ManualMealEntrySheet';
import { MealEditSheet } from '@/components/scan/MealEditSheet';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { useGatePremiumAccess } from '@/hooks/use-gate-premium-access';
import {
  isDayEditable,
  isLocalDateKeyInFuture,
  localDateKey,
  parseDateOnly,
  resolveEatenAtForLocalDate,
  shiftLocalDateKey,
} from '@/lib/day-window';
import { MEAL_SOURCE } from '@/lib/meal-sources';
import {
  deleteMeal,
  saveScannedMeal,
  updateMealWithItems,
  type TodayMeal,
} from '@/lib/meals';
import type { EditableMealItem } from '@/services/mealVision/types';
import { useAuthStore } from '@/stores/auth-store';

/** Single Modal at a time — never present edit/add/paywall concurrently (iOS deadlock). */
type DaySheetMode =
  | { kind: 'none' }
  | { kind: 'edit'; mealId: string }
  | { kind: 'add' }
  | { kind: 'paywall' };

function formatDayScreenTitle(dateKey: string, locale: string): string {
  const date = parseDateOnly(dateKey);
  date.setHours(12, 0, 0, 0);
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function resolveDateParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return localDateKey();
  }
  if (isLocalDateKeyInFuture(value)) {
    return localDateKey();
  }
  return value;
}

export default function DayDetailScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = resolveDateParam(params.date);
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const { gatePremiumAccess } = useGatePremiumAccess();

  const [sheetMode, setSheetMode] = useState<DaySheetMode>({ kind: 'none' });
  const [pendingSheet, setPendingSheet] = useState<DaySheetMode | null>(null);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [isSavingManualMeal, setIsSavingManualMeal] = useState(false);

  const editable = isDayEditable(date);
  const title = useMemo(
    () => formatDayScreenTitle(date, i18n.language),
    [date, i18n.language],
  );

  const goToDate = useCallback((nextDateKey: string) => {
    if (isLocalDateKeyInFuture(nextDateKey) || nextDateKey === date) {
      return;
    }
    router.replace(`/koli/day/${nextDateKey}` as Href);
  }, [date]);

  const goToNeighbor = useCallback(
    (direction: 'prev' | 'next') => {
      const delta = direction === 'next' ? 1 : -1;
      goToDate(shiftLocalDateKey(date, delta));
    },
    [date, goToDate],
  );

  const daySwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((event) => {
          'worklet';
          const distance = 56;
          const flick = 450;
          const toNext =
            event.translationX < -distance || event.velocityX < -flick;
          const toPrev =
            event.translationX > distance || event.velocityX > flick;

          if (toNext) {
            runOnJS(goToNeighbor)('next');
          } else if (toPrev) {
            runOnJS(goToNeighbor)('prev');
          }
        }),
    [goToNeighbor],
  );

  const openSheet = useCallback((next: DaySheetMode) => {
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
      queryClient.invalidateQueries({ queryKey: ['day-meals', userId, date] }),
      queryClient.invalidateQueries({ queryKey: ['day-consumption', userId, date] }),
      queryClient.invalidateQueries({ queryKey: ['history', userId] }),
      queryClient.invalidateQueries({ queryKey: ['today-meals', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
      queryClient.invalidateQueries({
        queryKey: ['calorie-goal-for-date', userId, date],
      }),
    ]);
  }

  function handleMealPress(meal: TodayMeal) {
    if (!editable) {
      return;
    }

    openSheet({ kind: 'edit', mealId: meal.id });
  }

  async function handleAddMealPress() {
    if (!editable) {
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
    portionFactor: number;
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
        portionFactor: params.portionFactor,
      });
      await invalidateDayQueries();
      setSheetMode({ kind: 'none' });
    } catch (saveError) {
      console.error('[DayDetail] meal edit save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.mealEdit.saveError'));
    } finally {
      setIsSavingMealEdit(false);
    }
  }

  async function handleMealDelete(mealId: string) {
    if (!userId) {
      return;
    }

    if (!(await gatePremiumAccess())) {
      openSheet({ kind: 'paywall' });
      return;
    }

    setIsDeletingMeal(true);

    try {
      await deleteMeal({ mealId, userId });
      await invalidateDayQueries();
      setSheetMode({ kind: 'none' });
    } catch (deleteError) {
      console.error('[DayDetail] meal delete failed:', deleteError);
      Alert.alert(t('settings.errors.title'), t('home.mealEdit.saveError'));
    } finally {
      setIsDeletingMeal(false);
    }
  }

  async function handleManualMealSave(items: EditableMealItem[]) {
    if (!userId || !editable) {
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
        eatenAt: resolveEatenAtForLocalDate(date),
      });
      await invalidateDayQueries();
      setSheetMode({ kind: 'none' });
    } catch (saveError) {
      console.error('[DayDetail] manual meal save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.manualEntry.saveError'));
    } finally {
      setIsSavingManualMeal(false);
    }
  }

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 px-6" style={{ paddingTop: contentTopPadding }}>
        <View className="mb-4 flex-row items-center gap-2">
          <SettingsBackButton label={t('dayDetail.back')} />
          <Text
            className="flex-1 text-xl font-bold text-gray-900"
            numberOfLines={1}>
            {title}
          </Text>
        </View>

        <GestureDetector gesture={daySwipeGesture}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}>
            <DaySummaryBlock date={date} />
            <View className="mt-6">
              <DayMealList
                date={date}
                editable={editable}
                onMealPress={handleMealPress}
                onAddMeal={editable ? () => void handleAddMealPress() : undefined}
              />
            </View>
          </ScrollView>
        </GestureDetector>
      </View>

      <MealEditSheet
        visible={sheetMode.kind === 'edit'}
        mealId={sheetMode.kind === 'edit' ? sheetMode.mealId : null}
        userId={userId ?? null}
        isSaving={isSavingMealEdit}
        isDeleting={isDeletingMeal}
        onClose={() => setSheetMode({ kind: 'none' })}
        onDismissed={handleSheetDismissed}
        onSave={(saveParams) => void handleMealEditSave(saveParams)}
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
    </HomeLayout>
  );
}
