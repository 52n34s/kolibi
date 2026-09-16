import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { CalorieBarChart } from '@/components/history/calorie-bar-chart';
import { WeightLineChart } from '@/components/history/weight-line-chart';
import { HomeProgressRows, type HomeProgressRowItem } from '@/components/home/home-progress-rows';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { SupplementHistorySection } from '@/components/supplements/SupplementHistorySection';
import { WeightGoalEtaMessage } from '@/components/weight-goal-eta-message';
import { useHistory } from '@/hooks/use-history';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import {
  buildHistorySummaryStats,
  countWeighDaysInLastMonth,
  filterWeightLogsInRange,
  getTrendWeightKg,
  weightChangeInRange,
  type HistoryRangeDays,
} from '@/lib/history';
import {
  calculateMaintenanceCalories,
  resolveCalorieSource,
} from '@/lib/onboarding';
import {
  resolveGoalDirectionFromCalories,
  type WeightGoalEtaInput,
} from '@/lib/weight-goal-eta';
import { formatWeightForDisplay } from '@/lib/weight-logs';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { formatKcal } from '@/utils/format';

function formatShortDayLabel(dateKey: string, locale: string): string {
  const date = parseDateOnly(dateKey);
  date.setHours(12, 0, 0, 0);
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

function formatDayNumber(dateKey: string): string {
  return String(parseDateOnly(dateKey).getDate());
}

export function HistoryPanel() {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const [rangeDays, setRangeDays] = useState<HistoryRangeDays>(7);
  const { data, isLoading, isError, error } = useHistory(userId, rangeDays);
  const { data: profileSettings } = useProfileSettings(userId);
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);

  const chartWidth = windowWidth - 48;
  const todayKey = localDateKey();

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  const summary = useMemo(
    () => (data ? buildHistorySummaryStats(data.days, todayKey) : null),
    [data, todayKey],
  );

  const summaryRows = useMemo((): HomeProgressRowItem[] => {
    if (!summary) {
      return [];
    }

    const rows: HomeProgressRowItem[] = [
      {
        key: 'calories',
        label: t('history.summary.calories'),
        actual: summary.calorieAvg,
        goal: summary.calorieGoalAvg,
        valueOverride:
          summary.calorieAvg != null
            ? String(Math.round(summary.calorieAvg))
            : '–',
        footerHint:
          summary.calorieGoalAvg != null
            ? t('history.summary.calorieGoalHint', {
                goal: formatKcal(Math.round(summary.calorieGoalAvg)),
              })
            : undefined,
      },
      {
        key: 'protein',
        label: t('history.summary.protein'),
        actual: null,
        goal: null,
        valueFullWidth: true,
        valueOverride:
          summary.proteinTrackedDays > 0
            ? t('history.summary.proteinHit', {
                hit: summary.proteinHitDays,
                total: summary.proteinTrackedDays,
              })
            : '–',
      },
      {
        key: 'carbs',
        label: t('history.summary.carbs'),
        actual: summary.carbsAvg,
        goal: summary.carbsGoalAvg,
      },
      {
        key: 'fat',
        label: t('history.summary.fat'),
        actual: summary.fatAvg,
        goal: summary.fatGoalAvg,
        goalPrefix: t('history.summary.minPrefix'),
      },
      {
        key: 'fiber',
        label: t('history.summary.fiber'),
        actual: summary.fiberAvg,
        goal: summary.fiberGoalAvg,
        goalPrefix: t('history.summary.minPrefix'),
      },
    ];

    return rows;
  }, [summary, t]);

  const weightLogsInRange = useMemo(() => {
    if (!data?.days.length) {
      return [];
    }
    return filterWeightLogsInRange(
      data.weightLogs,
      data.days[0]!.date,
      data.days[data.days.length - 1]!.date,
    );
  }, [data]);

  const trendWeightKg = useMemo(
    () => getTrendWeightKg(weightLogsInRange),
    [weightLogsInRange],
  );

  const trendWeightLabel = useMemo(() => {
    if (trendWeightKg == null) {
      return null;
    }
    return formatWeightForDisplay({
      weightKg: trendWeightKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
  }, [t, trendWeightKg, unitSystem]);

  const weightChange = useMemo(() => {
    if (!data?.days.length) {
      return null;
    }
    return weightChangeInRange(
      weightLogsInRange,
      data.days[0]!.date,
      data.days[data.days.length - 1]!.date,
    );
  }, [data, weightLogsInRange]);

  const weightChangeLabel = useMemo(() => {
    if (weightChange == null) {
      return null;
    }
    const abs = Math.abs(weightChange.deltaKg);
    const formatted = formatWeightForDisplay({
      weightKg: abs,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
    const signed = `${weightChange.deltaKg > 0 ? '+' : weightChange.deltaKg < 0 ? '−' : ''}${formatted}`;
    return t('history.weight.changeInRange', {
      delta: signed,
      days: weightChange.spanDays,
    });
  }, [t, unitSystem, weightChange]);

  const weightValues = useMemo(
    () => weightLogsInRange.map((entry) => entry.weight_kg),
    [weightLogsInRange],
  );

  const targetWeightKg = data?.targetWeightKg ?? null;

  const weighDaysLastMonth = useMemo(
    () => (data ? countWeighDaysInLastMonth(data.weightLogs) : 0),
    [data],
  );

  const historyWeightEtaInput = useMemo((): WeightGoalEtaInput | null => {
    if (weighDaysLastMonth < 8) {
      return null;
    }
    if (targetWeightKg == null || !(targetWeightKg > 0) || !data?.weightLogs?.length) {
      return null;
    }

    const profile = profileSettings?.profile;
    let maintenanceCalories: number | null = null;
    const dailyCalorieGoal = profileSettings?.profile?.daily_calorie_goal ?? null;

    if (
      profile?.birth_date &&
      profile.activity_level &&
      profile.height_cm &&
      trendWeightKg != null
    ) {
      try {
        maintenanceCalories = calculateMaintenanceCalories({
          biologicalSex: profile.biological_sex ?? 'prefer_not_to_say',
          birthDate: parseDateOnly(profile.birth_date),
          heightCm: profile.height_cm,
          weightKg: trendWeightKg,
          activityLevel: profile.activity_level,
          calorieSource: resolveCalorieSource(healthConnectedPreference === true),
        });
      } catch {
        maintenanceCalories = null;
      }
    }

    const direction =
      dailyCalorieGoal != null && maintenanceCalories != null
        ? resolveGoalDirectionFromCalories({
            goalType: profile?.goal_type,
            dailyCalorieGoal,
            maintenanceCalories,
          })
        : targetWeightKg < (trendWeightKg ?? targetWeightKg)
          ? 'loss'
          : targetWeightKg > (trendWeightKg ?? targetWeightKg)
            ? 'gain'
            : 'none';

    if (direction === 'none') {
      return null;
    }

    return {
      logs: data.weightLogs.map((entry) => ({
        weightKg: entry.weight_kg,
        loggedAt: entry.logged_at,
      })),
      targetWeightKg,
      currentWeightKg: trendWeightKg,
      dailyCalorieGoal,
      maintenanceCalories,
      goalDirection: direction,
    };
  }, [
    data?.weightLogs,
    healthConnectedPreference,
    profileSettings?.profile,
    targetWeightKg,
    trendWeightKg,
    weighDaysLastMonth,
  ]);

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
    () => data?.days.map((day) => day.totalCalories) ?? [],
    [data?.days],
  );

  const calorieGoals = useMemo(
    () =>
      data?.days.map(
        (day) => day.scaledGoal?.calorieGoal ?? day.goal?.dailyCalorieGoal ?? null,
      ) ?? [],
    [data?.days],
  );

  const hasWeightData = weightValues.length > 0;
  const hasCalorieData = calorieValues.some((value) => value > 0);

  function openDayDetail(index: number) {
    const day = data?.days[index];
    if (day?.date == null) {
      return;
    }
    router.push(`/koli/day/${day.date}` as Href);
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
    <ScrollView
      className="flex-1 px-6"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <View className="mb-5">
        <PillSegmentSwitcher
          compact
          value={String(rangeDays) as '7' | '30'}
          onChange={(value) => setRangeDays(Number(value) as HistoryRangeDays)}
          segments={[
            { id: '7', label: t('history.range.days7') },
            { id: '30', label: t('history.range.days30') },
          ]}
        />
      </View>

      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('history.summary.sectionTitle')}
      </Text>
      <View
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-8">
        <View className="px-5 py-5">
          {summary && summary.loggedDays > 0 ? (
            <>
              <HomeProgressRows rows={summaryRows} />
              <Text className="mt-4 text-sm text-gray-500">
                {t('history.summary.daysLogged', {
                  logged: summary.loggedDays,
                  total: summary.rangeDayCount,
                })}
              </Text>
            </>
          ) : (
            <Text className="text-sm text-gray-500">{t('history.summary.empty')}</Text>
          )}
        </View>
      </View>

      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('history.calories.sectionTitle')}
      </Text>
      <View
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className={hasCalorieData ? undefined : 'mb-8'}>
        <View className="px-4 py-5">
          {hasCalorieData ? (
            <>
              <CalorieBarChart
                values={calorieValues}
                goals={calorieGoals}
                width={chartWidth - 32}
                compact={rangeDays === 30}
                onBarPress={openDayDetail}
              />
              <View className="mt-3" style={{ position: 'relative', height: 16 }}>
                {data?.days.map((day, index) => {
                  const showLabel =
                    rangeDays === 7 || index % 5 === 0 || index === data.days.length - 1;
                  if (!showLabel) {
                    return null;
                  }
                  const count = data.days.length;
                  const leftPct = count <= 1 ? 50 : (index / (count - 1)) * 100;
                  return (
                    <Pressable
                      key={day.date}
                      onPress={() => router.push(`/koli/day/${day.date}` as Href)}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        transform: [{ translateX: -12 }],
                        width: 24,
                        alignItems: 'center',
                      }}>
                      <Text className="text-[10px] text-gray-500">
                        {rangeDays === 7
                          ? formatShortDayLabel(day.date, i18n.language)
                          : formatDayNumber(day.date)}
                      </Text>
                    </Pressable>
                  );
                })}
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
      {hasCalorieData ? (
        <Text className="mb-8 mt-2 text-sm text-gray-500">
          {t('history.calories.tapHint')}
        </Text>
      ) : null}

      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('history.weight.sectionTitle')}
      </Text>
      <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
        <View className="px-4 py-5">
          {hasWeightData && trendWeightLabel != null ? (
            <>
              <Text className="text-sm text-gray-500">{t('history.weight.trendLabel')}</Text>
              <Text className="mt-1 text-2xl font-bold text-[#4F46E5]">{trendWeightLabel}</Text>
              {weightChangeLabel ? (
                <Text className="mt-1 text-sm text-gray-500">{weightChangeLabel}</Text>
              ) : null}
              <View className="mt-4">
                <WeightLineChart
                  values={weightValues}
                  width={chartWidth - 32}
                  targetWeightKg={targetWeightKg}
                  targetLabel={targetLineLabel}
                  formatDeltaKg={(deltaKg) => {
                    const abs = Math.abs(deltaKg);
                    const formatted = formatWeightForDisplay({
                      weightKg: abs,
                      unitSystem,
                      kgLabel: t('onboarding.units.kg'),
                      lbsLabel: t('onboarding.units.lbs'),
                    });
                    return `${deltaKg > 0 ? '+' : deltaKg < 0 ? '−' : ''}${formatted}`;
                  }}
                />
                {historyWeightEtaInput ? (
                  <View className="mt-4 px-1">
                    <WeightGoalEtaMessage input={historyWeightEtaInput} />
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <View className="items-center py-6">
              <Ionicons name="analytics-outline" size={28} color="#9CA3AF" />
              <Text className="mt-3 text-center text-sm text-gray-500">
                {t('history.weight.empty')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {userId ? (
        <SupplementHistorySection userId={userId} rangeDays={rangeDays} />
      ) : null}
    </ScrollView>
  );
}
