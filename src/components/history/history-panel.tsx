import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Swipeable } from 'react-native-gesture-handler';

import { HistoryTrainingSection } from '@/components/history/history-training-section';
import { CalorieBarChart } from '@/components/history/calorie-bar-chart';
import { MacroTrendChart } from '@/components/history/macro-trend-chart';
import { WeightLineChart } from '@/components/history/weight-line-chart';
import { HomeProgressRows, type HomeProgressRowItem } from '@/components/home/home-progress-rows';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import { useMeshScreenInsets } from '@/components/home/home-layout';
import { scanButtonBarScrollPadding } from '@/components/home/scan-button-bar';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { SupplementHistorySection } from '@/components/supplements/SupplementHistorySection';
import { WeightGoalEtaMessage } from '@/components/weight-goal-eta-message';
import { useHistory } from '@/hooks/use-history';
import { useMovementGoalActual } from '@/hooks/use-movement-goal-actual';
import { useTrainingSessionsRange } from '@/hooks/use-training-sessions-range';
import {
  useBalanceSupplementHistory,
  useTopContributingFoods,
} from '@/hooks/use-history-balance';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useObservedEnergy } from '@/hooks/use-observed-energy';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { applyObservedMaintenanceToCalorieGoal } from '@/lib/observed-energy-data';
import {
  getObservedPromptDismissedUntil,
  setObservedPromptDismissedUntil,
} from '@/lib/observed-energy-prompt-storage';
import {
  observedPromptDismissedUntil,
  shouldOfferObservedGoalUpdate,
} from '@/lib/observed-energy';
import type { GoalType } from '@/lib/calorie-goal-math';
import {
  buildHistorySummaryStats,
  countWeighDaysInLastMonth,
  filterBodyFatLogsInRange,
  filterWaistLogsInRange,
  filterWeightLogsInRange,
  getLatestWeightKg,
  getLatestWaistCm,
  waistChangeInRange,
  weighSpanDaysInLastMonth,
  weightChangeInRange,
  type HistoryRangeDays,
} from '@/lib/history';
import { resolveDisplayWeight } from '@/lib/display-weight';
import {
  computeWeightWaistComparison,
  getLatestBodyFatPct,
  rangeWindowKeys,
  resolveActiveBodyMetric,
  resolveVisibleBodyMetrics,
  shouldShowBodyMetricSwitcher,
  shouldShowWaistRangeBadge,
  waistChartRangeDays,
  type HistoryBodyMetric,
} from '@/lib/history-body-metrics';
import {
  HISTORY_MACRO_NUTRIENTS,
  historyMacroActualSeries,
  historyMacroGoalSeries,
  type HistoryMacroNutrient,
} from '@/lib/history-macro-trend';
import {
  resolveActiveHistoryArea,
  resolveHistoryTrainingVisible,
  resolveVisibleHistoryAreas,
  shouldShowHistoryAreaSwitcher,
  type HistoryContentArea,
} from '@/lib/history-areas';
import {
  computeBodyFatChangeSummary,
  formatBodyFatDeltaPp,
  formatBodyFatPct,
} from '@/lib/body-fat-logs';
import {
  accuracyFromProteinDistributionDays,
  accuracyFromTrackedDays,
  accuracyFromWeighIns,
  computeBalanceStats,
  computeBalanceSummaryHeadline,
  computeProteinDistributionStats,
  detectRepeatedCalorieUndershoot,
  formatBalanceAccuracyValue,
  pickBalanceAccuracyHint,
  shouldShowWeightChangeDelta,
  TREND_RELIABLE_WEIGH_DAYS_LAST_MONTH,
} from '@/lib/history-balance';
import {
  MacroEmpfehlungsZiel,
  mapProfileGoalToEmpfehlungsZiel,
} from '@/lib/macro-recommendations';
import { resolveProteinRefKg } from '@/lib/macro-rules';
import {
  calculateTargetWeightForecast,
  type TargetWeightForecastInput,
} from '@/lib/target-weight-forecast';
import {
  calculateMaintenanceCalories,
  GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK,
  KCAL_PER_KG_BODY_WEIGHT,
  resolveCalorieSource,
} from '@/lib/onboarding';
import {
  computeWeeklyTrendWeightChangePercent,
  resolveGoalDirectionFromCalories,
  type WeightGoalEtaInput,
} from '@/lib/weight-goal-eta';
import { formatWeightForDisplay } from '@/lib/weight-logs';
import { formatWaistDeltaForDisplay, formatWaistForDisplay } from '@/lib/waist-logs';
import {
  countDistinctTrainingDays,
  localWeekDateKeys,
  weekDotFlags,
} from '@/lib/training-sessions';
import {
  loggedOnInRange,
  resolveHistoryTrainingEmptyKind,
  weeklyDistinctTrainingDayCounts,
} from '@/lib/history-training';
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

function formatPercent(value: number, locale: string): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDecimal(value: number, locale: string, minimumFractionDigits = 0): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits: 1,
  });
}

const CALORIE_DIRECTION_DEAD_ZONE = 0.03;

function deriveRateFromCalorieTarget(params: {
  dailyCalorieGoal: number | null;
  maintenanceCalories: number | null;
  currentWeightKg: number;
}): { direction: 'loss' | 'gain'; plannedPercent: number } | null {
  if (
    params.dailyCalorieGoal == null ||
    params.maintenanceCalories == null ||
    !(params.maintenanceCalories > 0)
  ) {
    return null;
  }

  const relativeDifference =
    (params.maintenanceCalories - params.dailyCalorieGoal) / params.maintenanceCalories;
  if (Math.abs(relativeDifference) <= CALORIE_DIRECTION_DEAD_ZONE) {
    return null;
  }

  return {
    direction: relativeDifference > 0 ? 'loss' : 'gain',
    plannedPercent:
      (Math.abs(params.maintenanceCalories - params.dailyCalorieGoal) * 7 * 100) /
      (KCAL_PER_KG_BODY_WEIGHT * params.currentWeightKg),
  };
}

type HistoryPanelProps = {
  onOpenWeightSheet: () => void;
};

export function HistoryPanel({ onOpenWeightSheet }: HistoryPanelProps) {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const { insets } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const [rangeDays, setRangeDays] = useState<HistoryRangeDays>(7);
  const [activeArea, setActiveArea] = useState<HistoryContentArea>('nutrition');
  const [activeBodyMetric, setActiveBodyMetric] = useState<HistoryBodyMetric>('weight');
  const [activeMacroNutrient, setActiveMacroNutrient] =
    useState<HistoryMacroNutrient>('protein');
  const scrollRef = useRef<ScrollView>(null);
  const [observedDismissedUntil, setObservedDismissedUntilState] = useState<string | null>(
    () => getObservedPromptDismissedUntil(),
  );
  const [isApplyingObserved, setIsApplyingObserved] = useState(false);
  const { data, isLoading, isError, error } = useHistory(userId, rangeDays);
  const { data: balanceData } = useHistory(userId, 7);
  /** 7 closed days + today — undershoot must not use in-progress today. */
  const { data: calorieUndershootData } = useHistory(userId, 8);
  const { data: profileSettings } = useProfileSettings(userId);
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
  const profile = profileSettings?.profile;
  const todayKey = localDateKey();
  const chartWidth = windowWidth - 48;
  const trainingLookback = rangeWindowKeys({ rangeDays: 35, todayKey });
  const historyRangeWindow = rangeWindowKeys({ rangeDays, todayKey });
  const { data: trainingSessions = [] } = useTrainingSessionsRange({
    userId,
    startKey: trainingLookback.startKey,
    endKey: trainingLookback.endKey,
  });
  /**
   * Live Home window only (`getMovementActual`), not a 7/30 series.
   * A range chart would need either 30 HealthKit queries or persisting
   * daily running km in `daily_health_stats`. Neither is in place.
   */
  const runningKmPeriod =
    profile?.movement_goal_period === 'day' || profile?.movement_goal_period === 'week'
      ? profile.movement_goal_period
      : 'week';
  const { data: runningKmActual } = useMovementGoalActual({
    enabled: healthConnectedPreference === true,
    type: 'running_km',
    period: runningKmPeriod,
  });
  const { data: observedEnergy } = useObservedEnergy({
    userId,
    biologicalSex: profile?.biological_sex,
    birthDate: profile?.birth_date,
    heightCm: profile?.height_cm,
    weightKg: profile?.latest_weight_kg,
    activityLevel: profile?.activity_level,
    healthConnected: healthConnectedPreference === true,
  });

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  const summary = useMemo(
    () => (data ? buildHistorySummaryStats(data.days, todayKey) : null),
    [data, todayKey],
  );
  const balanceSummary = useMemo(
    () => (balanceData ? buildHistorySummaryStats(balanceData.days, todayKey) : null),
    [balanceData, todayKey],
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

  const latestWeightLog = useMemo(() => {
    const logs = data?.weightLogs ?? [];
    if (logs.length === 0) {
      return null;
    }
    return logs[logs.length - 1]!;
  }, [data?.weightLogs]);

  const latestWeightInRange = useMemo(() => {
    if (latestWeightLog == null || !data?.days.length) {
      return false;
    }
    const key = localDateKey(new Date(latestWeightLog.logged_at));
    return key >= data.days[0]!.date && key <= data.days[data.days.length - 1]!.date;
  }, [data?.days, latestWeightLog]);

  const displayWeight = useMemo(() => {
    if (!data?.days.length) {
      return null;
    }
    return resolveDisplayWeight({
      logs: data.weightLogs,
      startOn: data.days[0]!.date,
      today: todayKey,
    });
  }, [data, todayKey]);

  const trendWeightKg = displayWeight?.trendKg ?? latestWeightLog?.weight_kg ?? null;

  const trendWeightLabel = useMemo(() => {
    if (trendWeightKg == null || latestWeightLog == null) {
      return null;
    }
    const weight = formatWeightForDisplay({
      weightKg: trendWeightKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
    if (latestWeightInRange && weightLogsInRange.length > 0) {
      return weight;
    }
    const loggedAt = new Date(latestWeightLog.logged_at);
    const date = loggedAt.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
    });
    return t('history.weight.latestDated', { weight, date });
  }, [
    i18n.language,
    latestWeightInRange,
    latestWeightLog,
    t,
    trendWeightKg,
    unitSystem,
    weightLogsInRange.length,
  ]);

  const dailyWeightLabel = useMemo(() => {
    const dailyKg = displayWeight?.dailyKg;
    const trendKg = displayWeight?.trendKg;
    if (dailyKg == null || trendKg == null) {
      return null;
    }
    const dailyFormatted = formatWeightForDisplay({
      weightKg: dailyKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
    const trendFormatted = formatWeightForDisplay({
      weightKg: trendKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
    if (dailyFormatted === trendFormatted) {
      return null;
    }
    return t('history.weight.dailyToday', { weight: dailyFormatted });
  }, [displayWeight?.dailyKg, displayWeight?.trendKg, t, unitSystem]);

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

  const uniqueWeighDaysInRange = useMemo(() => {
    const days = new Set<string>();
    for (const log of weightLogsInRange) {
      days.add(localDateKey(new Date(log.logged_at)));
    }
    return days.size;
  }, [weightLogsInRange]);

  const latestWaistCm = useMemo(
    () => getLatestWaistCm(data?.waistLogs ?? []),
    [data?.waistLogs],
  );
  const waistUnitLabels = useMemo(
    () => ({
      cmLabel: t('onboarding.units.cm'),
      inLabel: t('onboarding.units.in'),
    }),
    [t],
  );
  const waistLabel = useMemo(
    () =>
      latestWaistCm == null
        ? null
        : formatWaistForDisplay({
            waistCm: latestWaistCm,
            unitSystem,
            locale: i18n.language,
            ...waistUnitLabels,
          }),
    [i18n.language, latestWaistCm, unitSystem, waistUnitLabels],
  );
  const waistChartDays = waistChartRangeDays(rangeDays);
  const waistChartWindow = useMemo(
    () => rangeWindowKeys({ rangeDays: waistChartDays, todayKey }),
    [todayKey, waistChartDays],
  );
  const waistLogsInChart = useMemo(
    () =>
      filterWaistLogsInRange(
        data?.waistLogs ?? [],
        waistChartWindow.startKey,
        waistChartWindow.endKey,
      ),
    [data?.waistLogs, waistChartWindow.endKey, waistChartWindow.startKey],
  );
  const waistValues = useMemo(
    () => waistLogsInChart.map((entry) => entry.waist_cm),
    [waistLogsInChart],
  );
  const waistChangeLabel = useMemo(() => {
    const deltaCm = waistChangeInRange(
      waistLogsInChart,
      waistChartWindow.startKey,
      waistChartWindow.endKey,
    );
    const delta =
      deltaCm == null
        ? null
        : formatWaistDeltaForDisplay({
            deltaCm,
            unitSystem,
            locale: i18n.language,
            ...waistUnitLabels,
          });
    return delta == null
      ? null
      : t('history.weight.waistChangeInRange', { delta, days: waistChartDays });
  }, [
    i18n.language,
    t,
    unitSystem,
    waistChartDays,
    waistChartWindow.endKey,
    waistChartWindow.startKey,
    waistLogsInChart,
    waistUnitLabels,
  ]);

  const bodyFatLogsInRange = useMemo(() => {
    if (!data?.days.length) {
      return [];
    }
    return filterBodyFatLogsInRange(
      data.bodyFatLogs,
      data.days[0]!.date,
      data.days[data.days.length - 1]!.date,
    );
  }, [data]);
  const bodyFatValues = useMemo(
    () => bodyFatLogsInRange.map((entry) => entry.body_fat_pct),
    [bodyFatLogsInRange],
  );
  const latestBodyFatPct = useMemo(
    () => getLatestBodyFatPct(data?.bodyFatLogs ?? []),
    [data?.bodyFatLogs],
  );
  const bodyFatLabel = useMemo(
    () =>
      latestBodyFatPct == null
        ? null
        : formatBodyFatPct(latestBodyFatPct, i18n.language),
    [i18n.language, latestBodyFatPct],
  );
  const bodyFatChangeLabel = useMemo(() => {
    if (bodyFatLogsInRange.length < 2) {
      return null;
    }
    const first = bodyFatLogsInRange[0]!;
    const last = bodyFatLogsInRange[bodyFatLogsInRange.length - 1]!;
    const deltaPp = last.body_fat_pct - first.body_fat_pct;
    if (Math.abs(deltaPp) < 0.05) {
      return null;
    }
    return t('history.weight.changeInRange', {
      delta: formatBodyFatDeltaPp(deltaPp, i18n.language),
      days: rangeDays,
    });
  }, [bodyFatLogsInRange, i18n.language, rangeDays, t]);

  const weightWaistComparison = useMemo(
    () =>
      computeWeightWaistComparison({
        weightLogs: data?.weightLogs ?? [],
        waistLogs: data?.waistLogs ?? [],
        todayKey,
      }),
    [data?.waistLogs, data?.weightLogs, todayKey],
  );
  const weightWaistComparisonLabel = useMemo(() => {
    if (weightWaistComparison == null) {
      return null;
    }
    const waistDelta =
      formatWaistDeltaForDisplay({
        deltaCm: weightWaistComparison.waistDeltaCm,
        unitSystem,
        locale: i18n.language,
        ...waistUnitLabels,
      }) ?? t('history.weight.waistUnchanged');
    if (weightWaistComparison.weightUnchanged) {
      return t('history.weight.comparisonUnchanged', {
        count: weightWaistComparison.spanWeeks,
        waistDelta,
      });
    }
    const abs = Math.abs(weightWaistComparison.weightDeltaKg);
    const formatted = formatWeightForDisplay({
      weightKg: abs,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
    const weightDelta = `${weightWaistComparison.weightDeltaKg > 0 ? '+' : '−'}${formatted}`;
    return t('history.weight.comparisonBoth', {
      count: weightWaistComparison.spanWeeks,
      weightDelta,
      waistDelta,
    });
  }, [i18n.language, t, unitSystem, waistUnitLabels, weightWaistComparison]);

  const targetWeightKg = data?.targetWeightKg ?? null;

  const balanceTargetWeightKg = balanceData?.targetWeightKg ?? null;
  const balanceCurrentWeightKg = balanceData
    ? getLatestWeightKg(balanceData.weightLogs)
    : null;

  const referenceWeightKg = useMemo(() => {
    if (balanceCurrentWeightKg == null) {
      return null;
    }
    return resolveProteinRefKg({
      weightKg: balanceCurrentWeightKg,
      heightCm: profileSettings?.profile?.height_cm ?? null,
      targetWeightKg: balanceTargetWeightKg,
    });
  }, [balanceCurrentWeightKg, balanceTargetWeightKg, profileSettings?.profile?.height_cm]);

  const balanceStats = useMemo(
    () => (balanceSummary ? computeBalanceStats(balanceSummary, referenceWeightKg) : null),
    [balanceSummary, referenceWeightKg],
  );
  const proteinDistribution = useMemo(
    () =>
      balanceData &&
      (profile?.goal_type === 'lose_weight' ||
        profile?.goal_type === 'faster_weight_loss' ||
        profile?.goal_type === 'gain_weight' ||
        profile?.goal_type === 'build_muscle')
        ? computeProteinDistributionStats(balanceData.meals, referenceWeightKg)
        : null,
    [balanceData, profile?.goal_type, referenceWeightKg],
  );

  const { data: balanceSupplementHistory } = useBalanceSupplementHistory(userId, todayKey);

  const { data: topContributingFoods } = useTopContributingFoods(
    userId,
    balanceStats?.deviatingNutrient ?? null,
    i18n.language,
  );

  const weighDaysLastMonth = useMemo(
    () => (data ? countWeighDaysInLastMonth(data.weightLogs) : 0),
    [data],
  );
  const showWeightChangeDelta = shouldShowWeightChangeDelta({
    uniqueWeighDaysInRange,
    weighDaysLastMonth,
  });
  const weighSpanLastMonth = useMemo(
    () => (data ? weighSpanDaysInLastMonth(data.weightLogs) : 0),
    [data],
  );
  const weighAccuracy = useMemo(
    () =>
      accuracyFromWeighIns({
        weighDayCount: weighDaysLastMonth,
        spanDays: weighSpanLastMonth,
      }),
    [weighDaysLastMonth, weighSpanLastMonth],
  );
  const macroAccuracy = useMemo(
    () => accuracyFromTrackedDays(balanceSummary?.loggedDays ?? 0),
    [balanceSummary?.loggedDays],
  );

  const dailyCalorieGoal = profile?.daily_calorie_goal ?? null;
  const weeklyWeightTrend = useMemo(
    () =>
      data?.weightLogs.length
        ? computeWeeklyTrendWeightChangePercent(
            data.weightLogs.map((entry) => ({
              weightKg: entry.weight_kg,
              loggedAt: entry.logged_at,
            })),
          )
        : null,
    [data?.weightLogs],
  );
  const maintenanceCalories = useMemo(() => {
    const currentWeightKg = weeklyWeightTrend?.currentWeightKg ?? trendWeightKg;
    if (
      !profile?.birth_date ||
      !profile.activity_level ||
      !profile.height_cm ||
      currentWeightKg == null
    ) {
      return null;
    }

    try {
      const observedReady = observedEnergy?.status === 'ready';
      return calculateMaintenanceCalories({
        biologicalSex: profile.biological_sex ?? 'prefer_not_to_say',
        birthDate: parseDateOnly(profile.birth_date),
        heightCm: profile.height_cm,
        weightKg: currentWeightKg,
        activityLevel: profile.activity_level,
        calorieSource: resolveCalorieSource(healthConnectedPreference === true, {
          observedReady,
        }),
        observedMaintenanceKcal:
          observedReady && observedEnergy.status === 'ready'
            ? observedEnergy.observedKcal
            : undefined,
      });
    } catch {
      return null;
    }
  }, [
    healthConnectedPreference,
    observedEnergy,
    profile,
    trendWeightKg,
    weeklyWeightTrend?.currentWeightKg,
  ]);

  const estimatedMaintenanceKcal = useMemo(() => {
    const currentWeightKg = weeklyWeightTrend?.currentWeightKg ?? trendWeightKg;
    if (
      !profile?.birth_date ||
      !profile.activity_level ||
      !profile.height_cm ||
      currentWeightKg == null
    ) {
      return null;
    }
    try {
      // Compare against the BMR-based source still in force (not OBSERVED).
      return calculateMaintenanceCalories({
        biologicalSex: profile.biological_sex ?? 'prefer_not_to_say',
        birthDate: parseDateOnly(profile.birth_date),
        heightCm: profile.height_cm,
        weightKg: currentWeightKg,
        activityLevel: profile.activity_level,
        calorieSource: resolveCalorieSource(healthConnectedPreference === true),
      });
    } catch {
      return null;
    }
  }, [
    healthConnectedPreference,
    profile,
    trendWeightKg,
    weeklyWeightTrend?.currentWeightKg,
  ]);

  const showObservedUpdatePrompt = useMemo(() => {
    if (
      observedEnergy == null ||
      observedEnergy.status === 'insufficient' ||
      estimatedMaintenanceKcal == null
    ) {
      return false;
    }
    return shouldOfferObservedGoalUpdate({
      status: observedEnergy.status,
      observedKcal: observedEnergy.observedKcal,
      currentMaintenanceKcal: estimatedMaintenanceKcal,
      calorieGoalSource: profile?.calorie_goal_source,
      dismissedUntil: observedDismissedUntil,
    });
  }, [estimatedMaintenanceKcal, observedDismissedUntil, observedEnergy, profile?.calorie_goal_source]);

  const showObservedInfoLine = useMemo(() => {
    if (observedEnergy == null || observedEnergy.status === 'insufficient') {
      return false;
    }
    // Info without CTA: rough, or custom source, or dismissed / small delta.
    return !showObservedUpdatePrompt;
  }, [observedEnergy, showObservedUpdatePrompt]);

  function dismissObservedPrompt() {
    const until = observedPromptDismissedUntil();
    setObservedPromptDismissedUntil(until);
    setObservedDismissedUntilState(until);
  }

  async function acceptObservedPrompt() {
    if (
      !userId ||
      observedEnergy == null ||
      observedEnergy.status !== 'ready' ||
      profile?.latest_weight_kg == null ||
      !profile.goal_type ||
      profile.goal_type === 'custom'
    ) {
      return;
    }

    setIsApplyingObserved(true);
    try {
      await applyObservedMaintenanceToCalorieGoal({
        userId,
        observedKcal: observedEnergy.observedKcal,
        weightKg: profile.latest_weight_kg,
        goalType: profile.goal_type as Exclude<GoalType, 'custom'>,
      });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      await queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      await queryClient.invalidateQueries({ queryKey: ['observed-energy', userId] });
      dismissObservedPrompt();
    } catch (applyError) {
      console.error('[History] observed goal apply failed:', applyError);
      Alert.alert(t('settings.errors.title'), t('history.observed.applyFailed'));
    } finally {
      setIsApplyingObserved(false);
    }
  }

  const balanceTargetForecastInput = useMemo((): TargetWeightForecastInput => {
    return {
      currentWeightKg: balanceCurrentWeightKg,
      targetWeightKg: balanceTargetWeightKg,
      dailyCalorieGoal,
      biologicalSex: profile?.biological_sex ?? 'prefer_not_to_say',
      birthDate: profile?.birth_date ? parseDateOnly(profile.birth_date) : null,
      heightCm: profile?.height_cm ?? null,
      activityLevel: profile?.activity_level ?? null,
      calorieSource: resolveCalorieSource(healthConnectedPreference === true, {
        observedReady: observedEnergy?.status === 'ready',
      }),
      observedMaintenanceKcal:
        observedEnergy?.status === 'ready' ? observedEnergy.observedKcal : undefined,
      goalType: profile?.goal_type ?? null,
      macroGoalProfile:
        mapProfileGoalToEmpfehlungsZiel(profile?.goal_type) ===
        MacroEmpfehlungsZiel.MUSKELAUFBAU
          ? 'muscle'
          : null,
      weighDaysLast30: weighDaysLastMonth,
    };
  }, [
    balanceCurrentWeightKg,
    balanceTargetWeightKg,
    dailyCalorieGoal,
    healthConnectedPreference,
    observedEnergy,
    profile,
    weighDaysLastMonth,
  ]);
  const balanceTargetForecast = useMemo(
    () => calculateTargetWeightForecast(balanceTargetForecastInput),
    [balanceTargetForecastInput],
  );

  const balanceWeightRate = useMemo(() => {
    if (profile?.goal_type == null || profile.goal_type === 'maintain') {
      return null;
    }

    let direction: 'loss' | 'gain' | null = null;
    let plannedPercent: number | null = null;
    switch (profile.goal_type) {
      case 'lose_weight':
      case 'faster_weight_loss':
      case 'gain_weight':
        direction = profile.goal_type === 'gain_weight' ? 'gain' : 'loss';
        plannedPercent = GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK[profile.goal_type];
        break;
      case 'endurance': {
        if (!weeklyWeightTrend) {
          return null;
        }
        const derived = deriveRateFromCalorieTarget({
          dailyCalorieGoal,
          maintenanceCalories,
          currentWeightKg: weeklyWeightTrend.currentWeightKg,
        });
        if (derived == null) {
          return null;
        }
        direction = derived.direction;
        plannedPercent = derived.plannedPercent;
        break;
      }
      default:
        return null;
    }

    if (
      weighAccuracy === 'unavailable' ||
      !weeklyWeightTrend ||
      plannedPercent == null ||
      !(plannedPercent > 0) ||
      direction == null
    ) {
      return null;
    }

    const actualPercent =
      weeklyWeightTrend.weeklyChangePercent * (direction === 'loss' ? -1 : 1);
    return {
      direction,
      actualPercent,
      plannedPercent,
      onPlan:
        actualPercent >= plannedPercent * 0.7 && actualPercent <= plannedPercent * 1.3,
      accuracy: weighAccuracy,
    };
  }, [
    dailyCalorieGoal,
    maintenanceCalories,
    profile?.goal_type,
    weighAccuracy,
    weeklyWeightTrend,
  ]);

  const targetDateDeviation = useMemo(() => {
    if (
      balanceTargetForecast.status !== 'ok' ||
      !balanceSummary ||
      balanceSummary.loggedDays < 5 ||
      balanceSummary.calorieAvg == null ||
      balanceSummary.calorieGoalAvg == null ||
      !(balanceSummary.calorieGoalAvg > 0) ||
      Math.abs(balanceSummary.calorieAvg - balanceSummary.calorieGoalAvg) /
        balanceSummary.calorieGoalAvg <=
        0.1
    ) {
      return null;
    }

    const actualForecast = calculateTargetWeightForecast({
      ...balanceTargetForecastInput,
      dailyCalorieGoal: balanceSummary.calorieAvg,
    });
    if (actualForecast.status !== 'ok') {
      return null;
    }

    const differenceWeeks = actualForecast.weeks - balanceTargetForecast.weeks;
    if (differenceWeeks === 0) {
      return null;
    }

    return {
      direction: differenceWeeks > 0 ? 'later' : 'earlier',
      weeks: Math.max(1, Math.round(Math.abs(differenceWeeks))),
    };
  }, [balanceSummary, balanceTargetForecast, balanceTargetForecastInput]);

  const balanceRows = useMemo((): HomeProgressRowItem[] => {
    if (!balanceStats) {
      return [];
    }

    const withMacroAccuracy = (raw: string) => formatBalanceAccuracyValue(raw, macroAccuracy);

    const proteinRaw =
      macroAccuracy === 'unavailable' || !balanceStats.proteinHasData
        ? '—'
        : !balanceStats.proteinOk
          ? t('history.balance.protein.below', {
              amount: Math.round(Math.abs(balanceStats.proteinDeltaG ?? 0)),
            })
          : balanceStats.proteinAboveGoal
            ? t('history.balance.protein.above')
            : '✓';
    const proteinFormatted = withMacroAccuracy(proteinRaw);

    const fiberRaw =
      macroAccuracy === 'unavailable' || !balanceStats.fiberHasData
        ? '—'
        : balanceStats.fiberOk
          ? '✓'
          : t('history.balance.fiber.below', {
              amount: Math.round(Math.abs(balanceStats.fiberDeltaG ?? 0)),
            });
    const fiberFormatted = withMacroAccuracy(fiberRaw);

    const fatRaw =
      macroAccuracy === 'unavailable' || !balanceStats.fatHasData
        ? '—'
        : balanceStats.fatBelowFloor
          ? t('history.balance.fat.belowFloor')
          : balanceStats.fatOverGoal
            ? t('history.balance.fat.above', {
                amount: Math.round(balanceStats.fatDeltaG ?? 0),
              })
            : '✓';
    const fatFormatted = withMacroAccuracy(fatRaw);

    const carbsRaw =
      macroAccuracy === 'unavailable' || !balanceStats.carbsHasData
        ? '—'
        : balanceStats.carbsOk
          ? '✓'
          : t('history.balance.carbs.above', {
              amount: Math.round(balanceStats.carbsDeltaG ?? 0),
            });
    const carbsFormatted = withMacroAccuracy(carbsRaw);

    const supplementRows = (balanceSupplementHistory ?? [])
      .map((supplement, index) => {
        const dueDays = supplement.days.filter((day) => day.is_due);
        if (dueDays.length === 0) {
          return null;
        }
        const takenDays = dueDays.filter((day) => day.taken).length;
        const fullyTaken = takenDays === dueDays.length;
        return {
          key: `balance-supplement-${supplement.supplement_id}`,
          label: supplement.name,
          actual: null,
          goal: null,
          dividerAbove: index === 0,
          valueFullWidth: true,
          valueOverride: fullyTaken
            ? t('history.balance.supplements.complete')
            : t('history.balance.supplements.progress', {
                taken: takenDays,
                due: dueDays.length,
              }),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map((row, index) => (index === 0 ? { ...row, dividerAbove: true } : { ...row, dividerAbove: false }));

    const proteinDistAccuracy = accuracyFromProteinDistributionDays(
      proteinDistribution?.trackedDays ?? 0,
    );
    const proteinDistributionRow: HomeProgressRowItem[] = proteinDistribution
      ? [
          (() => {
            const raw =
              proteinDistAccuracy === 'unavailable'
                ? '—'
                : t(
                    proteinDistribution.averageMealsAtThreshold >= 3
                      ? 'history.balance.proteinDistribution.valueOnTarget'
                      : 'history.balance.proteinDistribution.value',
                    {
                      hits: formatDecimal(
                        Math.round(proteinDistribution.averageMealsAtThreshold),
                        i18n.language,
                      ),
                      meals: formatDecimal(
                        Math.round(proteinDistribution.averageMealCount),
                        i18n.language,
                      ),
                      threshold: proteinDistribution.thresholdG,
                    },
                  );
            const formatted = formatBalanceAccuracyValue(raw, proteinDistAccuracy);
            return {
              key: 'balance-protein-distribution',
              label: t('history.balance.proteinDistribution.label'),
              actual: null,
              goal: null,
              valueFullWidth: true,
              valueOverride: formatted.text,
              valueTone: formatted.tone,
            };
          })(),
        ]
      : [];

    const weightRateRow: HomeProgressRowItem[] = balanceWeightRate
      ? [
          (() => {
            const labelKey =
              balanceWeightRate.direction === 'gain'
                ? 'gain'
                : 'loss';
            const raw = t(
              balanceWeightRate.onPlan
                ? 'history.balance.weightRate.valueOnPlan'
                : 'history.balance.weightRate.value',
              {
                actual: formatPercent(balanceWeightRate.actualPercent, i18n.language),
                planned: formatPercent(balanceWeightRate.plannedPercent, i18n.language),
              },
            );
            const formatted = formatBalanceAccuracyValue(raw, balanceWeightRate.accuracy);
            return {
              key: 'balance-weight-rate',
              label: t(`history.balance.weightRate.${labelKey}`),
              actual: null,
              goal: null,
              valueFullWidth: true,
              valueOverride: formatted.text,
              valueTone: formatted.tone,
            };
          })(),
        ]
      : [];

    const targetDateDeviationRow: HomeProgressRowItem[] = targetDateDeviation
      ? [
          {
            key: 'balance-target-date-deviation',
            label: t('history.balance.targetDateDeviation.label'),
            actual: null,
            goal: null,
            valueFullWidth: true,
            valueOverride: t(
              `history.balance.targetDateDeviation.${targetDateDeviation.direction}`,
              { weeks: targetDateDeviation.weeks },
            ),
          },
        ]
      : [];

    const macroRows: HomeProgressRowItem[] = [
      {
        key: 'balance-protein',
        label: t('history.summary.protein'),
        actual: null,
        goal: null,
        valueFullWidth: true,
        valueOverride: proteinFormatted.text,
        valueTone: proteinFormatted.tone,
      },
      {
        key: 'balance-fiber',
        label: t('history.summary.fiber'),
        actual: null,
        goal: null,
        valueFullWidth: true,
        valueOverride: fiberFormatted.text,
        valueTone: fiberFormatted.tone,
      },
      {
        key: 'balance-fat',
        label: t('history.summary.fat'),
        actual: null,
        goal: null,
        valueFullWidth: true,
        valueOverride: fatFormatted.text,
        valueTone: fatFormatted.tone,
      },
      {
        key: 'balance-carbs',
        label: t('history.summary.carbs'),
        actual: null,
        goal: null,
        valueFullWidth: true,
        valueOverride: carbsFormatted.text,
        valueTone: carbsFormatted.tone,
      },
    ].filter((row) => row.valueOverride !== '—' && row.valueOverride !== '–');

    return [
      ...macroRows,
      ...supplementRows,
      ...proteinDistributionRow,
      ...weightRateRow,
      ...targetDateDeviationRow,
    ];
  }, [
    balanceStats,
    balanceSupplementHistory,
    balanceWeightRate,
    i18n.language,
    macroAccuracy,
    proteinDistribution,
    t,
    targetDateDeviation,
  ]);

  // Show when a calorie goal exists and at least two rows have content — goal_type
  // is not required (rate / protein-distribution already omit themselves without it).
  const showBalanceCard =
    profile?.daily_calorie_goal != null &&
    balanceSummary != null &&
    balanceSummary.loggedDays >= 2 &&
    balanceRows.length >= 2;

  const balanceAccuracyHint = useMemo(() => {
    const hint = pickBalanceAccuracyHint({
      weighIns: balanceWeightRate
        ? { accuracy: balanceWeightRate.accuracy, count: weighDaysLastMonth }
        : null,
      trackedDays: {
        accuracy: macroAccuracy,
        count: balanceSummary?.loggedDays ?? 0,
      },
      proteinDistribution: proteinDistribution
        ? {
            accuracy: accuracyFromProteinDistributionDays(proteinDistribution.trackedDays),
            count: proteinDistribution.trackedDays,
          }
        : null,
    });
    if (!hint) {
      return null;
    }
    if (hint.kind === 'weigh_ins') {
      return t('history.balance.accuracyHint.weighIns', { count: hint.count });
    }
    return t('history.balance.accuracyHint.trackedDays', { count: hint.count });
  }, [
    balanceSummary?.loggedDays,
    balanceWeightRate,
    macroAccuracy,
    proteinDistribution,
    t,
    weighDaysLastMonth,
  ]);

  const topFoodsLine = useMemo(() => {
    if (!balanceStats?.deviatingNutrient || !topContributingFoods?.length) {
      return null;
    }
    return t('history.balance.topFoods', {
      foods: topContributingFoods.map((food) => food.name).join(' · '),
    });
  }, [balanceStats?.deviatingNutrient, t, topContributingFoods]);

  const balanceTipLine = balanceAccuracyHint
    ? balanceAccuracyHint
    : balanceStats?.allOk
      ? t('history.balance.allOk')
      : topFoodsLine;

  const showsCalorieUndershoot = useMemo(() => {
    const days = calorieUndershootData?.days;
    if (!days?.length) {
      return false;
    }
    return detectRepeatedCalorieUndershoot({
      todayKey,
      days: days.map((day) => ({
        date: day.date,
        hasMeals: day.hasMeals,
        totalCalories: day.totalCalories,
        calorieGoal: day.scaledGoal?.calorieGoal ?? day.goal?.dailyCalorieGoal ?? null,
      })),
    });
  }, [calorieUndershootData?.days, todayKey]);

  const balanceSummaryHeadline = useMemo(() => {
    if (!showBalanceCard) {
      return null;
    }
    if (showsCalorieUndershoot) {
      return t('history.balance.summary.calorieUndershoot');
    }
    if (!balanceSummary) {
      return null;
    }
    const headline = computeBalanceSummaryHeadline({
      summary: balanceSummary,
      referenceWeightKg,
      macroAccuracy,
    });
    if (headline == null) {
      return null;
    }
    if (headline.kind === 'on_track') {
      return t('history.balance.summary.onTrack');
    }
    const nutrient = t(`history.balance.summary.nutrient.${headline.nutrient}`);
    if (headline.kind === 'small') {
      return t(
        headline.direction === 'under'
          ? 'history.balance.summary.smallUnder'
          : 'history.balance.summary.smallOver',
        { amount: headline.amountG, nutrient },
      );
    }
    return t(
      headline.direction === 'under'
        ? `history.balance.summary.largeUnder.${headline.nutrient}`
        : `history.balance.summary.largeOver.${headline.nutrient}`,
      { amount: headline.amountG },
    );
  }, [
    balanceSummary,
    macroAccuracy,
    referenceWeightKg,
    showBalanceCard,
    showsCalorieUndershoot,
    t,
  ]);

  const bodyFatChangeLines = useMemo(() => {
    if (!data?.bodyFatLogs?.length) {
      return null;
    }
    const summary = computeBodyFatChangeSummary({
      bodyFatLogs: data.bodyFatLogs,
      weightLogs: data.weightLogs,
    });
    if (summary == null) {
      return null;
    }

    const changeLine = formatBalanceAccuracyValue(
      t('history.balance.bodyFat.change', {
        delta: formatBodyFatDeltaPp(summary.deltaPp, i18n.language),
        days: summary.spanDays,
        current: formatBodyFatPct(summary.currentPct, i18n.language),
      }),
      'rough',
    );

    let compositionLine: { text: string; tone: 'default' | 'secondary' } | null = null;
    if (summary.weightDeltaKg != null && summary.fatMassDeltaKg != null) {
      const weightAbs = Math.abs(summary.weightDeltaKg);
      const weightFormatted = formatWeightForDisplay({
        weightKg: weightAbs,
        unitSystem,
        kgLabel: t('onboarding.units.kg'),
        lbsLabel: t('onboarding.units.lbs'),
      });
      const signedWeight = `${summary.weightDeltaKg > 0 ? '+' : summary.weightDeltaKg < 0 ? '−' : ''}${weightFormatted}`;
      const fatFormatted = formatWeightForDisplay({
        weightKg: Math.abs(summary.fatMassDeltaKg),
        unitSystem,
        kgLabel: t('onboarding.units.kg'),
        lbsLabel: t('onboarding.units.lbs'),
      });
      compositionLine = formatBalanceAccuracyValue(
        t('history.balance.bodyFat.composition', {
          weightDelta: signedWeight,
          fatMass: fatFormatted,
        }),
        'rough',
      );
    }

    return { changeLine, compositionLine };
  }, [data?.bodyFatLogs, data?.weightLogs, i18n.language, t, unitSystem]);

  const historyWeightEtaInput = useMemo((): WeightGoalEtaInput | null => {
    if (weighDaysLastMonth < TREND_RELIABLE_WEIGH_DAYS_LAST_MONTH) {
      return null;
    }
    if (targetWeightKg == null || !(targetWeightKg > 0) || !data?.weightLogs?.length) {
      return null;
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
    dailyCalorieGoal,
    maintenanceCalories,
    profile?.goal_type,
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

  const macroActualValues = useMemo(
    () => (data?.days ? historyMacroActualSeries(data.days, activeMacroNutrient) : []),
    [activeMacroNutrient, data?.days],
  );
  const macroGoalValues = useMemo(
    () => (data?.days ? historyMacroGoalSeries(data.days, activeMacroNutrient) : []),
    [activeMacroNutrient, data?.days],
  );
  const hasMacroActualData = macroActualValues.some((value) => value != null);

  const hasWeightData = latestWeightLog != null;
  const hasWeightChartData = weightValues.length > 0;
  const hasWaistData = (data?.waistLogs.length ?? 0) > 0;
  const hasBodyFatData = (data?.bodyFatLogs.length ?? 0) > 0;
  const hasCalorieData = calorieValues.some((value) => value > 0);
  const hasNutritionContent =
    showBalanceCard || (summary?.loggedDays ?? 0) > 0 || hasCalorieData;
  const hasBodyContent = hasWeightData || hasWaistData || hasBodyFatData;
  const hasMovementGoal =
    profile?.movement_goal_type != null &&
    profile.movement_goal_value != null &&
    profile.movement_goal_value > 0 &&
    profile.movement_goal_period != null;
  const hasSessionInRange = trainingSessions.some((session) =>
    loggedOnInRange(session.loggedOn, historyRangeWindow.startKey, todayKey),
  );
  const hasRunningKm = runningKmActual != null && runningKmActual > 0;
  const visibleBodyMetrics = resolveVisibleBodyMetrics({
    weight: hasBodyContent,
    waist: hasWaistData,
    bodyFat: hasBodyFatData,
  });
  const showBodyMetricSwitcher = shouldShowBodyMetricSwitcher(visibleBodyMetrics);
  const resolvedBodyMetric = resolveActiveBodyMetric({
    selected: activeBodyMetric,
    visible: visibleBodyMetrics,
  });
  const visibleAreas = resolveVisibleHistoryAreas({
    nutrition: hasNutritionContent,
    body: hasBodyContent,
    training: resolveHistoryTrainingVisible({
      nutrition: hasNutritionContent,
      body: hasBodyContent,
      hasSessionInRange,
      hasMovementGoal,
      healthConnected: healthConnectedPreference === true,
    }),
  });
  const showAreaSwitcher = shouldShowHistoryAreaSwitcher(visibleAreas);
  const resolvedArea = resolveActiveHistoryArea({
    selected: activeArea,
    visible: visibleAreas,
  });
  const showNutrition = !showAreaSwitcher
    ? visibleAreas.includes('nutrition')
    : resolvedArea === 'nutrition';
  const showBody = !showAreaSwitcher
    ? visibleAreas.includes('body')
    : resolvedArea === 'body';
  const showTraining = !showAreaSwitcher
    ? visibleAreas.includes('training')
    : resolvedArea === 'training';

  const trainingWeekKeys = useMemo(() => localWeekDateKeys(), [todayKey]);
  const trainingWeekDots = useMemo(
    () => weekDotFlags(trainingSessions),
    [trainingSessions],
  );
  const trainingWeekDayLabels = useMemo(
    () => trainingWeekKeys.map((key) => formatShortDayLabel(key, i18n.language)),
    [i18n.language, trainingWeekKeys],
  );
  const sessionsThisWeek = useMemo(
    () =>
      countDistinctTrainingDays(
        trainingSessions.filter((session) => trainingWeekKeys.includes(session.loggedOn)),
      ),
    [trainingSessions, trainingWeekKeys],
  );
  const weeklyTrainingCounts = useMemo(
    () =>
      weeklyDistinctTrainingDayCounts({
        loggedOnKeys: trainingSessions.map((session) => session.loggedOn),
        startKey: historyRangeWindow.startKey,
        endKey: todayKey,
      }),
    [historyRangeWindow.startKey, todayKey, trainingSessions],
  );
  const trainingEmptyKind = resolveHistoryTrainingEmptyKind({
    healthConnected: healthConnectedPreference === true,
    hasMovementGoal,
    hasSessionInRange,
    hasRunningKm,
  });
  const sessionsGoal =
    profile?.training_sessions_per_week != null &&
    profile.training_sessions_per_week >= 1
      ? profile.training_sessions_per_week
      : null;

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
      ref={scrollRef}
      className="flex-1 px-6"
      contentContainerStyle={{
        paddingBottom: scanButtonBarScrollPadding(insets.bottom),
      }}
      showsVerticalScrollIndicator={false}>
      {showObservedUpdatePrompt &&
      observedEnergy &&
      observedEnergy.status === 'ready' &&
      estimatedMaintenanceKcal != null ? (
        <ObservedExpenditurePrompt
          observedKcal={observedEnergy.observedKcal}
          estimatedKcal={estimatedMaintenanceKcal}
          isApplying={isApplyingObserved}
          onAccept={() => void acceptObservedPrompt()}
          onDismiss={dismissObservedPrompt}
        />
      ) : showObservedInfoLine &&
        observedEnergy &&
        observedEnergy.status !== 'insufficient' ? (
        <Text className="mb-6 text-sm leading-5 text-gray-500">
          {t('history.observed.info', {
            observed: formatKcal(observedEnergy.observedKcal),
          })}
        </Text>
      ) : null}

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

      {showAreaSwitcher ? (
        <View className="mb-5">
          <PillSegmentSwitcher
            compact
            value={resolvedArea}
            onChange={(value) => {
              setActiveArea(value);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
            segments={visibleAreas.map((id) => ({
              id,
              label: t(`history.areas.${id}`),
            }))}
          />
        </View>
      ) : null}

      {showNutrition ? (
        <>
      {showBalanceCard ? (
        <>
          {balanceSummaryHeadline ? (
            <View
              style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
              className="mb-8">
              <View className="px-5 py-5">
                <Text className="text-base font-medium leading-6 text-gray-900">
                  {balanceSummaryHeadline}
                </Text>
              </View>
            </View>
          ) : null}
          <Text className="mb-3 text-lg font-semibold text-gray-900">
            {t('history.balance.title')}
          </Text>
          <View
            style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
            className="mb-8">
            <View className="px-5 py-5">
              <HomeProgressRows rows={balanceRows} />
              {bodyFatChangeLines ? (
                <View className="mt-4 gap-1">
                  <Text
                    className={`text-sm ${
                      bodyFatChangeLines.changeLine.tone === 'secondary'
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}>
                    {bodyFatChangeLines.changeLine.text}
                  </Text>
                  {bodyFatChangeLines.compositionLine ? (
                    <Text
                      className={`text-sm ${
                        bodyFatChangeLines.compositionLine.tone === 'secondary'
                          ? 'text-gray-400'
                          : 'text-gray-600'
                      }`}>
                      {bodyFatChangeLines.compositionLine.text}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {balanceTipLine ? (
                <Text className="mt-4 text-sm text-gray-500">{balanceTipLine}</Text>
              ) : null}
              <Text className="mt-4 text-xs text-gray-400">
                {t('history.balance.disclaimer')}
              </Text>
            </View>
          </View>
        </>
      ) : null}

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
        {t('history.macro.sectionTitle')}
      </Text>
      <View className="mb-3">
        <PillSegmentSwitcher
          compact
          value={activeMacroNutrient}
          onChange={setActiveMacroNutrient}
          segments={HISTORY_MACRO_NUTRIENTS.map((id) => ({
            id,
            label: t(`macro.short.${id}`),
          }))}
        />
      </View>
      <View
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-8">
        <View
          className="px-4 py-5"
          style={{ overflow: 'hidden', borderRadius: ONBOARDING_CARD_RADIUS }}>
          {hasMacroActualData || macroGoalValues.some((value) => value != null) ? (
            <>
              <MacroTrendChart
                actual={macroActualValues}
                goal={macroGoalValues}
                width={chartWidth - 32}
              />
              <View className="mt-3" style={{ position: 'relative', height: 16 }}>
                {data?.days.map((day, index) => {
                  const count = data.days.length;
                  const leftPct = count <= 1 ? 50 : (index / (count - 1)) * 100;
                  return (
                    <Pressable
                      key={`macro-day-${day.date}`}
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
              <Text className="text-center text-sm text-gray-500">
                {t('history.macro.empty')}
              </Text>
            </View>
          )}
        </View>
      </View>
        </>
      ) : null}

      {showBody ? (
        <>
      {showBodyMetricSwitcher ? (
        <View className="mb-3">
          <PillSegmentSwitcher
            compact
            value={resolvedBodyMetric}
            onChange={setActiveBodyMetric}
            segments={visibleBodyMetrics.map((id) => ({
              id,
              label: t(`history.weight.tabs.${id}`),
            }))}
          />
        </View>
      ) : (
        <Text className="mb-3 text-lg font-semibold text-gray-900">
          {resolvedBodyMetric === 'waist'
            ? t('history.weight.tabs.waist')
            : resolvedBodyMetric === 'bodyFat'
              ? t('history.weight.tabs.bodyFat')
              : t('history.weight.sectionTitle')}
        </Text>
      )}
      <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
        <View
          className="px-4 py-5"
          style={{ overflow: 'hidden', borderRadius: ONBOARDING_CARD_RADIUS }}>
          {resolvedBodyMetric === 'waist' ? (
            hasWaistData && waistLabel != null ? (
              <>
                <Text className="text-sm text-gray-500">
                  {t('history.weight.currentWaistLabel')}
                </Text>
                <Text className="mt-1 text-2xl font-bold text-[#4F46E5]">{waistLabel}</Text>
                {waistChangeLabel ? (
                  <Text className="mt-1 text-sm text-gray-500">{waistChangeLabel}</Text>
                ) : null}
                {waistValues.length > 0 ? (
                  <View className="mt-4">
                    <WeightLineChart
                      values={waistValues}
                      width={chartWidth - 32}
                      rangeBadge={
                        shouldShowWaistRangeBadge(rangeDays)
                          ? t('history.range.days30')
                          : null
                      }
                    />
                  </View>
                ) : null}
                {weightWaistComparisonLabel ? (
                  <Text className="mt-4 px-1 text-sm text-gray-500">
                    {weightWaistComparisonLabel}
                  </Text>
                ) : null}
              </>
            ) : (
              <BodyMetricEmptyState
                label={t('history.weight.notTracked')}
                onPress={onOpenWeightSheet}
              />
            )
          ) : resolvedBodyMetric === 'bodyFat' ? (
            hasBodyFatData && bodyFatLabel != null ? (
              <>
                <Text className="text-sm text-gray-500">
                  {t('history.weight.currentBodyFatLabel')}
                </Text>
                <Text className="mt-1 text-2xl font-bold text-[#4F46E5]">{bodyFatLabel}</Text>
                {bodyFatChangeLabel ? (
                  <Text className="mt-1 text-sm text-gray-500">{bodyFatChangeLabel}</Text>
                ) : null}
                {bodyFatValues.length > 0 ? (
                  <View className="mt-4">
                    <WeightLineChart
                      values={bodyFatValues}
                      width={chartWidth - 32}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <BodyMetricEmptyState
                label={t('history.weight.notTracked')}
                onPress={onOpenWeightSheet}
              />
            )
          ) : hasWeightData && trendWeightLabel != null ? (
            <>
              <Text className="text-sm text-gray-500">
                {hasWeightChartData
                  ? t('history.weight.trendLabel')
                  : t('history.weight.currentLabel')}
              </Text>
              <Text className="mt-1 text-2xl font-bold text-[#4F46E5]">{trendWeightLabel}</Text>
              {dailyWeightLabel ? (
                <Text className="mt-1 text-sm text-gray-500">{dailyWeightLabel}</Text>
              ) : null}
              {showWeightChangeDelta && weightChangeLabel ? (
                <Text className="mt-1 text-sm text-gray-500">{weightChangeLabel}</Text>
              ) : null}
              {hasWeightChartData ? (
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
                {weighDaysLastMonth < TREND_RELIABLE_WEIGH_DAYS_LAST_MONTH ? (
                  <Text className="mt-4 px-1 text-sm text-gray-500">
                    {t('history.weight.trendNeedsMeasurements')}
                  </Text>
                ) : historyWeightEtaInput ? (
                  <View className="mt-4 px-1">
                    <WeightGoalEtaMessage input={historyWeightEtaInput} />
                  </View>
                ) : null}
              </View>
              ) : null}
              {weightWaistComparisonLabel ? (
                <Text className="mt-4 px-1 text-sm text-gray-500">
                  {weightWaistComparisonLabel}
                </Text>
              ) : null}
            </>
          ) : (
            <BodyMetricEmptyState
              label={t('history.weight.notTracked')}
              onPress={onOpenWeightSheet}
            />
          )}
        </View>
      </View>
        </>
      ) : null}

      {showTraining ? (
        <HistoryTrainingSection
          chartWidth={chartWidth}
          rangeDays={rangeDays}
          emptyKind={trainingEmptyKind}
          weekDotFlags={trainingWeekDots}
          weekDayLabels={trainingWeekDayLabels}
          sessionsThisWeek={sessionsThisWeek}
          sessionsGoal={sessionsGoal}
          weeklyCounts={weeklyTrainingCounts}
          runningKm={runningKmActual ?? 0}
          runningKmPeriod={runningKmPeriod}
          healthConnected={healthConnectedPreference === true}
        />
      ) : null}

      {showNutrition && userId ? (
        <SupplementHistorySection userId={userId} rangeDays={rangeDays} />
      ) : null}
    </ScrollView>
  );
}

function BodyMetricEmptyState(props: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      className="items-center justify-center py-6"
      style={{ minHeight: 180 }}>
      <Ionicons name="analytics-outline" size={28} color="#9CA3AF" />
      <View className="mt-3 flex-row items-center justify-center">
        <Text className="text-center text-sm text-gray-500">{props.label}</Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginLeft: 4 }} />
      </View>
    </Pressable>
  );
}

function ObservedExpenditurePrompt(props: {
  observedKcal: number;
  estimatedKcal: number;
  isApplying: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { t, i18n } = useTranslation();
  const observed = Math.round(props.observedKcal).toLocaleString(i18n.language);
  const estimated = Math.round(props.estimatedKcal).toLocaleString(i18n.language);

  return (
    <Swipeable
      overshootFriction={8}
      onSwipeableOpen={props.onDismiss}
      renderRightActions={() => <View className="w-4" />}
      renderLeftActions={() => <View className="w-4" />}>
      <Pressable
        accessibilityRole="button"
        disabled={props.isApplying}
        onPress={props.onAccept}
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-6">
        <View className="flex-row items-start gap-3 px-4 py-4">
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-medium leading-5 text-gray-900">
              {t('history.observed.prompt', { observed, estimated })}
            </Text>
          </View>
          {props.isApplying ? (
            <ActivityIndicator color={ONBOARDING_ACCENT} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.common.cancel')}
              hitSlop={12}
              onPress={props.onDismiss}
              className="pt-0.5">
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </Pressable>
    </Swipeable>
  );
}
