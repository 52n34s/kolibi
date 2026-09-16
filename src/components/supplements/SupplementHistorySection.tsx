import { Href, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import type { HistoryRangeDays } from '@/lib/history';
import { fetchSupplementHistory } from '@/lib/supplements';

type Props = {
  userId: string;
  rangeDays: HistoryRangeDays;
};

function rangeKeys(toKey: string, days: number): { from: string; to: string } {
  const to = new Date(`${toKey}T12:00:00`);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: localDateKey(from), to: toKey };
}

function weekdayShort(dateKey: string, locale: string): string {
  const date = parseDateOnly(dateKey);
  date.setHours(12, 0, 0, 0);
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

export function SupplementHistorySection({ userId, rangeDays }: Props) {
  const { t, i18n } = useTranslation();
  const today = localDateKey();
  const { from, to } = useMemo(() => rangeKeys(today, rangeDays), [rangeDays, today]);
  const compact = rangeDays === 30;
  const dotSize = compact ? 6 : 10;

  const queryKey = useMemo(
    () => ['supplements', 'history', userId, from, to] as const,
    [from, to, userId],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: () => fetchSupplementHistory(from, to),
  });

  useEffect(() => {
    if (isError && error) {
      console.error('[History] supplement history load failed:', error);
    }
  }, [error, isError]);

  // No reserved space while loading. On error, fall through to empty CTA.
  if (isLoading) {
    return null;
  }

  if (!data?.length) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('history.supplements.emptyCta')}
        onPress={() => router.push('/koli/supplements' as Href)}
        className="mt-8"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Text className="text-sm text-gray-500">{t('history.supplements.emptyCta')}</Text>
      </Pressable>
    );
  }

  const dayKeys = data[0]?.days ?? [];

  return (
    <View className="mt-8">
      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('history.supplements.sectionTitle')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('history.supplements.openA11y')}
        onPress={() => router.push('/koli/supplements' as Href)}
        style={({ pressed }) => [
          getOnboardingIdleCardStyle(),
          { borderRadius: ONBOARDING_CARD_RADIUS },
          pressed ? { backgroundColor: GLASS_SURFACE_PRESSED.backgroundColor } : null,
        ]}>
        <View className="px-4 py-3" style={{ gap: 14 }}>
          {!compact && dayKeys.length > 0 ? (
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View style={{ maxWidth: '28%', flexShrink: 1, width: '28%' }} />
              <View className="min-w-0 flex-1 flex-row items-center justify-between">
                {dayKeys.map((day) => (
                  <Text
                    key={`${day.day}-label`}
                    style={{
                      width: dotSize + 8,
                      fontSize: 10,
                      color: '#9CA3AF',
                      textAlign: 'center',
                    }}
                    numberOfLines={1}>
                    {weekdayShort(day.day, i18n.language)}
                  </Text>
                ))}
              </View>
              <View style={{ minWidth: 36 }} />
            </View>
          ) : null}

          {data.map((row) => {
            const dueDays = row.days.filter((day) => day.is_due);
            const takenDue = dueDays.filter((day) => day.taken).length;
            const dueCount = dueDays.length;
            return (
              <View key={row.supplement_id} className="flex-row items-center" style={{ gap: 10 }}>
                <Text
                  className="text-sm font-medium text-gray-900"
                  numberOfLines={1}
                  style={{ flexShrink: 1, maxWidth: '28%' }}>
                  {row.name}
                </Text>
                <View className="min-w-0 flex-1 flex-row items-center justify-between">
                  {row.days.map((day) => {
                    if (!day.is_due) {
                      return (
                        <View
                          key={day.day}
                          style={{
                            width: compact ? dotSize : dotSize + 8,
                            height: dotSize,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                      );
                    }
                    return (
                      <View
                        key={day.day}
                        style={{
                          width: compact ? dotSize : dotSize + 8,
                          height: dotSize,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <View
                          style={{
                            width: dotSize,
                            height: dotSize,
                            borderRadius: dotSize / 2,
                            backgroundColor: day.taken ? '#4B5563' : 'transparent',
                            borderWidth: day.taken ? 0 : 1,
                            borderColor: '#9CA3AF',
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
                <Text className="text-xs tabular-nums text-gray-500">
                  {t('history.supplements.quote', {
                    taken: takenDue,
                    due: dueCount,
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>
    </View>
  );
}
