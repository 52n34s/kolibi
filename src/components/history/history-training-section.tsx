import { Href, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CalorieBarChart } from '@/components/history/calorie-bar-chart';
import { WeekDayDots } from '@/components/home/home-progress-rows';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import type { HistoryTrainingEmptyKind } from '@/lib/history-training';

function formatWeekStartLabel(weekStart: string): string {
  return String(Number(weekStart.slice(8, 10)));
}

type HistoryTrainingSectionProps = {
  chartWidth: number;
  rangeDays: 7 | 30;
  emptyKind: HistoryTrainingEmptyKind | null;
  weekDotFlags: boolean[];
  weekDayLabels: string[];
  sessionsThisWeek: number;
  sessionsGoal: number | null;
  weeklyCounts: Array<{ weekStart: string; count: number }>;
  runningKm: number;
  runningKmPeriod: 'day' | 'week';
  healthConnected: boolean;
};

export function HistoryTrainingSection({
  chartWidth,
  rangeDays,
  emptyKind,
  weekDotFlags,
  weekDayLabels,
  sessionsThisWeek,
  sessionsGoal,
  weeklyCounts,
  runningKm,
  runningKmPeriod,
  healthConnected,
}: HistoryTrainingSectionProps) {
  const { t, i18n } = useTranslation();
  const innerWidth = chartWidth - 32;

  function openHealthSettings() {
    router.push({
      pathname: '/koli',
      params: { segment: 'settings', settingsSubSegment: 'profile' },
    } as Href);
  }

  function openGoals() {
    router.push({ pathname: '/koli', params: { segment: 'goals' } } as Href);
  }

  function openTrainingLog() {
    router.push('/koli/training-log' as Href);
  }

  if (emptyKind != null) {
    const label =
      emptyKind === 'connect_health'
        ? t('history.training.connectHealth')
        : t('history.training.setMovementGoal');
    return (
      <View
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-8">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={emptyKind === 'connect_health' ? openHealthSettings : openGoals}
          className="items-center justify-center px-5 py-10">
          <Text className="text-center text-base font-medium text-[#4F46E5]">{label}</Text>
        </Pressable>
      </View>
    );
  }

  const sessionValue =
    sessionsGoal != null && sessionsGoal > 0
      ? t('history.training.sessionsValue', {
          actual: sessionsThisWeek,
          goal: sessionsGoal,
        })
      : String(sessionsThisWeek);

  const weekBarValues = weeklyCounts.map((week) => week.count);
  const weekGoals =
    sessionsGoal != null && sessionsGoal > 0
      ? weeklyCounts.map(() => sessionsGoal)
      : undefined;

  return (
    <>
      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('history.training.sessionsTitle')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('history.training.sessionsTitle')}
        onPress={openTrainingLog}
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-8">
        <View className="px-4 py-5">
          <Text className="text-sm text-gray-500">
            {rangeDays === 7
              ? t('history.training.sessionsHeadlineWeek')
              : t('history.training.sessionsHeadlineRange')}
          </Text>
          <Text className="mt-1 text-2xl font-bold text-[#4F46E5]">{sessionValue}</Text>
          {rangeDays === 7 ? (
            <View className="mt-5">
              <WeekDayDots flags={weekDotFlags} />
              <View className="mt-2 flex-row justify-between px-0.5">
                {weekDayLabels.map((label, index) => (
                  <Text key={`${label}-${index}`} className="w-7 text-center text-[10px] text-gray-500">
                    {label}
                  </Text>
                ))}
              </View>
            </View>
          ) : (
            <View className="mt-4">
              <CalorieBarChart
                values={weekBarValues}
                goals={weekGoals}
                width={innerWidth}
                height={140}
                compact
              />
              <View className="mt-2 flex-row justify-between px-1">
                {weeklyCounts.map((week) => (
                  <Text key={week.weekStart} className="text-[10px] text-gray-500">
                    {formatWeekStartLabel(week.weekStart)}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </Pressable>

      {healthConnected ? (
        <>
          <Text className="mb-3 text-lg font-semibold text-gray-900">
            {t('history.training.runningKmTitle')}
          </Text>
          <View
            style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
            className="mb-8">
            <View className="px-4 py-5">
              <Text className="text-sm text-gray-500">
                {runningKmPeriod === 'day'
                  ? t('history.training.runningKmPeriodDay')
                  : t('history.training.runningKmPeriodWeek')}
              </Text>
              <Text className="mt-1 text-2xl font-bold text-[#4F46E5]">
                {t('history.training.kmValue', {
                  km: runningKm.toLocaleString(i18n.language, {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 0,
                  }),
                })}
              </Text>
            </View>
          </View>
        </>
      ) : null}
    </>
  );
}
