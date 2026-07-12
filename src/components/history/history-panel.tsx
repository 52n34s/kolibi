import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
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
import {
  getOnboardingIdleCardStyle,
  getOnboardingSecondarySurfaceStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { useHistory } from '@/hooks/use-history';
import { getLatestWeightKg } from '@/lib/history';
import { formatWeightForDisplay } from '@/lib/weight-logs';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

function formatShortDayLabel(dateKey: string, locale: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

export function HistoryPanel() {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const { data, isLoading, isError, error } = useHistory(userId);

  const chartWidth = windowWidth - 48;

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

  const calorieValues = useMemo(
    () => data?.dailyCalories.map((day) => day.totalCalories) ?? [],
    [data?.dailyCalories],
  );

  const hasWeightData = (data?.weightLogs.length ?? 0) > 0;
  const hasCalorieData = calorieValues.some((value) => value > 0);

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
          <WeightLineChart values={weightValues} width={chartWidth - 32} />
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

      <Pressable
        className="mt-6"
        onPress={() => router.replace('/home' as Href)}
        style={({ pressed }) => [
          getOnboardingSecondarySurfaceStyle(),
          { opacity: pressed ? 0.75 : 1 },
        ]}>
        <View className="flex-row items-center justify-center px-4 py-3">
          <Text className="text-sm font-medium text-[#4F46E5]">
            {t('history.weight.updateOnHome')}
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}
