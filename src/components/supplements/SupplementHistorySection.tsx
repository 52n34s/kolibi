import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import type { HistoryRangeDays } from '@/lib/history';
import { fetchSupplementHistory } from '@/lib/supplements';

/** Shared by the weekday header and every supplement row so dots line up. */
const NAME_COL_WIDTH = 96;
const COUNT_COL_WIDTH = 40;
const ROW_GAP = 10;

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

function SupplementGridRow({
  name,
  track,
  count,
}: {
  name: ReactNode;
  track: ReactNode;
  count: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.nameCol}>{name}</View>
      <View style={styles.dayTrack}>{track}</View>
      <View style={styles.countCol}>{count}</View>
    </View>
  );
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
        <View className="flex-row items-center">
          <Text className="flex-1 text-sm text-gray-500">{t('history.supplements.emptyCta')}</Text>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </View>
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
        <View className="flex-row items-start px-4 py-3">
          <View className="min-w-0 flex-1" style={{ gap: 14 }}>
          {!compact && dayKeys.length > 0 ? (
            <SupplementGridRow
              name={null}
              track={dayKeys.map((day) => (
                <View key={`${day.day}-label`} style={styles.dayCell}>
                  <Text style={styles.weekdayLabel} numberOfLines={1}>
                    {weekdayShort(day.day, i18n.language)}
                  </Text>
                </View>
              ))}
              count={null}
            />
          ) : null}

          {data.map((row) => {
            const dueDays = row.days.filter((day) => day.is_due);
            const takenDue = dueDays.filter((day) => day.taken).length;
            const dueCount = dueDays.length;
            return (
              <SupplementGridRow
                key={row.supplement_id}
                name={
                  <Text
                    className="text-sm font-medium text-gray-900"
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {row.name}
                  </Text>
                }
                track={row.days.map((day) => (
                  <View key={day.day} style={styles.dayCell}>
                    {day.is_due ? (
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
                    ) : null}
                  </View>
                ))}
                count={
                  <Text className="text-xs tabular-nums text-gray-500" numberOfLines={1}>
                    {t('history.supplements.quote', {
                      taken: takenDue,
                      due: dueCount,
                    })}
                  </Text>
                }
              />
            );
          })}
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginTop: 2 }} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  nameCol: {
    width: NAME_COL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
  },
  dayTrack: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countCol: {
    width: COUNT_COL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  weekdayLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
