import { Href, Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Polyline } from 'react-native-svg';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { localDateKey, parseDateOnly, shiftLocalDateKey } from '@/lib/day-window';
import { formatAppDate } from '@/lib/onboarding';
import {
  pointsToPolyline,
  resolveLineChartYDomain,
  valueToChartY,
} from '@/lib/chart-utils';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { setPerformanceValue } from '@/lib/workouts/progress';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { formatActualSetValue } from '@/lib/workouts/session-detail-utils';
import type { WorkoutSession } from '@/lib/workouts/types';
import {
  fetchExerciseById,
  fetchSessionsContainingExercise,
} from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';

type RangeKey = '30' | '90' | 'all';

const CHART_PADDING = 16;

function sessionBestAndSum(session: WorkoutSession): { best: number; sum: number } | null {
  let best: number | null = null;
  let sum = 0;
  for (const set of session.sets) {
    const value = setPerformanceValue(set);
    if (value == null) {
      continue;
    }
    sum += value;
    if (best == null || value > best) {
      best = value;
    }
  }
  if (best == null) {
    return null;
  }
  return { best, sum };
}

function ExerciseProgressChart({
  bests,
  sums,
  width,
  height = 180,
}: {
  bests: number[];
  sums: number[];
  width: number;
  height?: number;
}) {
  if (bests.length === 0) {
    return null;
  }
  const yDomain = resolveLineChartYDomain({ values: [...bests, ...sums] });
  const padding = CHART_PADDING;
  const innerWidth = width - padding * 2;

  function toPoints(values: number[]) {
    return values.map((value, index) => {
      const x =
        values.length === 1
          ? width / 2
          : padding + (index / (values.length - 1)) * innerWidth;
      const y = valueToChartY({
        value,
        min: yDomain.min,
        range: yDomain.range,
        height,
        padding,
      });
      return { x, y };
    });
  }

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pointsToPolyline(toPoints(sums))}
        fill="none"
        stroke="rgba(79,70,229,0.25)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Polyline
        points={pointsToPolyline(toPoints(bests))}
        fill="none"
        stroke={BRAND_INDIGO}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function ExerciseProgressScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [range, setRange] = useState<RangeKey>('30');

  const todayKey = localDateKey();
  const startKey =
    range === 'all'
      ? null
      : shiftLocalDateKey(todayKey, range === '30' ? -29 : -89);

  const exerciseQuery = useQuery({
    queryKey: ['workout-exercise', userId, exerciseId],
    enabled: Boolean(userId) && Boolean(exerciseId),
    queryFn: () => fetchExerciseById(exerciseId!),
  });

  const sessionsQuery = useQuery({
    queryKey:
      userId && exerciseId
        ? [...workoutQueryKeys.exerciseHistory(userId, exerciseId), 'sessions', range]
        : ['workout-exercise-sessions'],
    enabled: Boolean(userId) && Boolean(exerciseId),
    queryFn: () => fetchSessionsContainingExercise(exerciseId!, startKey),
  });

  const exercise = exerciseQuery.data ?? null;
  const sessions = sessionsQuery.data ?? [];

  const chart = useMemo(() => {
    const chronological = [...sessions].reverse();
    const bests: number[] = [];
    const sums: number[] = [];
    for (const session of chronological) {
      const stats = sessionBestAndSum(session);
      if (!stats) {
        continue;
      }
      bests.push(stats.best);
      sums.push(stats.sum);
    }
    return { bests, sums };
  }, [sessions]);

  const chartWidth = windowWidth - 48;

  return (
    <HomeLayout>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <SettingsBackButton label={t('history.training.exerciseProgressTitle')} />
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingHorizontal: 24,
          paddingBottom: 48,
          gap: 16,
        }}>
        {exerciseQuery.isLoading || sessionsQuery.isLoading ? (
          <ActivityIndicator color={BRAND_INDIGO} />
        ) : null}

        {exercise ? (
          <GlassCard style={styles.header}>
            <ExerciseThumb exercise={exercise} size="lg" />
            <Text style={styles.name}>
              {resolveExerciseName(exercise, i18n.language)}
            </Text>
            {exercise.note ? (
              <Text style={styles.note}>{exercise.note}</Text>
            ) : null}
          </GlassCard>
        ) : null}

        <PillSegmentSwitcher
          value={range}
          onChange={setRange}
          compact
          segments={[
            { id: '30', label: t('training.progress.range30') },
            { id: '90', label: t('training.progress.range90') },
            { id: 'all', label: t('training.progress.rangeAll') },
          ]}
        />

        {chart.bests.length > 0 ? (
          <GlassCard style={styles.chartCard}>
            <Text style={styles.sectionTitle}>{t('training.progress.chartTitle')}</Text>
            <ExerciseProgressChart
              bests={chart.bests}
              sums={chart.sums}
              width={chartWidth - 32}
            />
            <Text style={styles.legend}>{t('training.progress.chartLegend')}</Text>
          </GlassCard>
        ) : (
          <Text style={styles.empty}>{t('training.progress.empty')}</Text>
        )}

        <Text style={styles.sectionTitle}>{t('training.progress.sessionsTitle')}</Text>
        {sessions.map((session) => {
          const stats = sessionBestAndSum(session);
          const setValues = session.sets.map(formatActualSetValue).join(', ');
          return (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              onPress={() =>
                router.push(`/koli/workout-session/${session.id}` as Href)
              }>
              <GlassCard style={styles.sessionCard}>
                <Text style={styles.sessionTitle}>
                  {formatAppDate(parseDateOnly(session.loggedOn), i18n.language)}
                  {' · '}
                  {session.shortLabel} {session.templateName}
                </Text>
                <Text style={styles.muted}>
                  {t('training.progress.sessionSets', {
                    values: setValues,
                    best: stats?.best ?? '–',
                  })}
                </Text>
              </GlassCard>
            </Pressable>
          );
        })}
      </ScrollView>
    </HomeLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  chartCard: {
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  legend: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  empty: {
    color: TEXT_SECONDARY,
    textAlign: 'center',
    paddingVertical: 16,
  },
  sessionCard: {
    padding: 14,
    gap: 4,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  muted: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
});
