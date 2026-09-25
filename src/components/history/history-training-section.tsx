import { Image } from 'expo-image';
import { Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MiniSparkline } from '@/components/history/mini-sparkline';
import {
  WorkoutVolumeBarChart,
  type VolumeBar,
} from '@/components/history/workout-volume-bar-chart';
import { WeekDayDots } from '@/components/home/home-progress-rows';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { exerciseStubFromSessionSet } from '@/components/training/exercise-stub';
import { TEXT_SECONDARY } from '@/constants/brand';
import { useProgressionEvents } from '@/hooks/use-progression-events';
import { useExercises } from '@/hooks/use-exercises';
import { parseDateOnly } from '@/lib/day-window';
import { formatDistanceKm, useUnitSystem } from '@/lib/measure-units';
import { displayExerciseName, resolveExerciseName } from '@/lib/workouts/exercise-name';
import {
  bestSetByExercise,
  exerciseBestSeries,
  personalBests,
  targetVsActual,
  volumeBySession,
  volumeByWeek,
  type PersonalBest,
} from '@/lib/workouts/progress';
import type { WorkoutSession } from '@/lib/workouts/types';
import {
  buildWeekDayMarkers,
  buildWeekDayMarkersForKeys,
  countDistinctTrainingDaysMerged,
  weekDateKeysFromMonday,
  type WeekDayMarker,
} from '@/lib/workouts/week-day-markers';

type ManualSessionLike = { loggedOn: string };

type HistoryTrainingSectionProps = {
  chartWidth: number;
  rangeDays: 7 | 30;
  rangeStartKey: string;
  todayKey: string;
  workoutSessions: WorkoutSession[];
  manualSessions: ManualSessionLike[];
  beforeBests: Record<string, number>;
  weekDayLabels: string[];
  sessionsGoal: number | null;
  runningKm: number | null;
  runningKmPeriod: 'day' | 'week';
  healthConnected: boolean;
  /** Switch Home to Training tab when available; otherwise open workout plan. */
  onOpenTrainingTab?: () => void;
  canOpenTrainingTab?: boolean;
};

function mondayOnOrBefore(dateKey: string): string {
  const date = parseDateOnly(dateKey);
  const weekday = date.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekStartsNewestFirst(startKey: string, endKey: string): string[] {
  const firstMonday = mondayOnOrBefore(startKey);
  const lastMonday = mondayOnOrBefore(endKey);
  const starts: string[] = [];
  const cursor = parseDateOnly(firstMonday);
  const last = parseDateOnly(lastMonday);
  while (cursor.getTime() <= last.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    starts.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 7);
  }
  return starts.reverse();
}

function sessionDurationMinutes(session: WorkoutSession): number {
  const end = Date.parse(session.finishedAt ?? new Date().toISOString());
  const start = Date.parse(session.startedAt);
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start) {
    return 1;
  }
  return Math.min(300, Math.max(1, Math.round((end - start) / 60_000)));
}

function formatShortDate(dateKey: string, locale: string): string {
  const date = parseDateOnly(dateKey);
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function formatBestValue(
  value: number,
  kind: 'reps' | 'weighted' | 'time',
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (kind === 'time') {
    return t('history.training.bestSeconds', { value });
  }
  return t('history.training.bestReps', { value });
}

function formatBestImprovement(
  best: PersonalBest,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (best.kind === 'time') {
    return t('history.training.bestImprovementSeconds', {
      value: best.value,
      previous: best.previousValue,
    });
  }
  return t('history.training.bestImprovementReps', {
    value: best.value,
    previous: best.previousValue,
  });
}

function formatTargetActual(
  session: WorkoutSession,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  const tv = targetVsActual(session);
  if (tv.actualReps > 0) {
    return t('history.training.targetActualReps', {
      actual: tv.actualReps,
    });
  }
  if (tv.actualSeconds > 0) {
    return t('history.training.targetActualSeconds', {
      actual: tv.actualSeconds,
    });
  }
  return null;
}

export function HistoryTrainingSection({
  chartWidth,
  rangeDays,
  rangeStartKey,
  todayKey,
  workoutSessions,
  manualSessions,
  beforeBests,
  weekDayLabels,
  sessionsGoal,
  runningKm,
  runningKmPeriod,
  healthConnected,
  onOpenTrainingTab,
  canOpenTrainingTab = false,
}: HistoryTrainingSectionProps) {
  const { t, i18n } = useTranslation();
  const innerWidth = chartWidth - 32;
  const [showAllBests, setShowAllBests] = useState(false);
  const [volumeMetric, setVolumeMetric] = useState<'reps' | 'seconds'>('reps');
  const { data: progressionEvents = [] } = useProgressionEvents({
    since: `${rangeStartKey}T00:00:00.000Z`,
  });
  const { data: allExercises = [] } = useExercises();

  const levelUps = useMemo(() => {
    return progressionEvents
      .filter((ev) => ev.status === 'accepted' && ev.kind === 'variant_up')
      .map((ev) => {
        const ex =
          allExercises.find((row) => row.id === ev.toExerciseId) ??
          allExercises.find((row) => row.id === ev.fromExerciseId);
        return {
          id: ev.id,
          name: ex ? resolveExerciseName(ex, i18n.language) : (ev.toExerciseId ?? ''),
          createdAt: ev.createdAt,
        };
      })
      .filter((row) => row.name.length > 0);
  }, [progressionEvents, allExercises, i18n.language]);

  const sessionsInRange = useMemo(
    () =>
      workoutSessions
        .filter((session) => session.loggedOn >= rangeStartKey && session.loggedOn <= todayKey)
        .slice()
        .sort((a, b) => {
          const aAt = a.finishedAt ?? a.startedAt;
          const bAt = b.finishedAt ?? b.startedAt;
          return bAt.localeCompare(aAt);
        }),
    [workoutSessions, rangeStartKey, todayKey],
  );

  const currentWeekKeys = useMemo(() => {
    const monday = mondayOnOrBefore(todayKey);
    return weekDateKeysFromMonday(monday);
  }, [todayKey]);

  const sessionsThisWeek = useMemo(() => {
    const weekSet = new Set(currentWeekKeys);
    return countDistinctTrainingDaysMerged(
      manualSessions.filter((s) => weekSet.has(s.loggedOn)),
      workoutSessions.filter((s) => weekSet.has(s.loggedOn)),
    );
  }, [manualSessions, workoutSessions, currentWeekKeys]);

  const weekMarkers = useMemo(
    () => buildWeekDayMarkers(manualSessions, workoutSessions, parseDateOnly(todayKey)),
    [manualSessions, workoutSessions, todayKey],
  );

  const weekRows30 = useMemo(() => {
    if (rangeDays !== 30) {
      return [] as Array<{ weekStart: string; markers: WeekDayMarker[] }>;
    }
    return weekStartsNewestFirst(rangeStartKey, todayKey).map((weekStart) => ({
      weekStart,
      markers: buildWeekDayMarkersForKeys(
        weekDateKeysFromMonday(weekStart),
        manualSessions,
        workoutSessions,
      ),
    }));
  }, [rangeDays, rangeStartKey, todayKey, manualSessions, workoutSessions]);

  const rangeSets = useMemo(
    () => sessionsInRange.flatMap((session) => session.sets),
    [sessionsInRange],
  );

  const exercisesById = useMemo(() => {
    const map = new Map(allExercises.map((ex) => [ex.id, ex]));
    return map;
  }, [allExercises]);

  const bests = useMemo(() => {
    return personalBests(rangeSets, beforeBests).map((best) => ({
      ...best,
      exerciseName: displayExerciseName({
        exerciseId: best.exerciseId,
        storedName: best.exerciseName,
        exercise: best.exerciseId != null ? exercisesById.get(best.exerciseId) : undefined,
        lang: i18n.language,
      }),
    }));
  }, [rangeSets, beforeBests, exercisesById, i18n.language]);

  const visibleBests = showAllBests ? bests : bests.slice(0, 3);

  const sessionVolumes = useMemo(() => volumeBySession(sessionsInRange), [sessionsInRange]);
  const weekVolumes = useMemo(() => volumeByWeek(sessionsInRange), [sessionsInRange]);

  const hasRepsVolume = sessionVolumes.some((v) => v.reps > 0);
  const hasSecondsVolume = sessionVolumes.some((v) => v.seconds > 0);
  const showVolumePill = hasRepsVolume && hasSecondsVolume;
  const activeVolumeMetric =
    showVolumePill ? volumeMetric : hasSecondsVolume && !hasRepsVolume ? 'seconds' : 'reps';

  const volumeBars: VolumeBar[] = useMemo(() => {
    if (rangeDays === 7) {
      const oldestFirst = [...sessionVolumes].sort((a, b) =>
        a.loggedOn.localeCompare(b.loggedOn),
      );
      return oldestFirst.map((vol) => ({
        segments: [
          {
            value: activeVolumeMetric === 'reps' ? vol.reps : vol.seconds,
            colorKey: vol.colorKey,
          },
        ],
      }));
    }
    // Newest week first to match week rows; chart left→right oldest→newest feels better
    const oldestFirst = [...weekVolumes].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    );
    return oldestFirst.map((week) => ({
      segments: week.segments.map((segment) => ({
        value: activeVolumeMetric === 'reps' ? segment.reps : segment.seconds,
        colorKey: segment.colorKey,
      })),
    }));
  }, [rangeDays, sessionVolumes, weekVolumes, activeVolumeMetric]);

  const volumeXLabels = useMemo(() => {
    if (rangeDays === 7) {
      const oldestFirst = [...sessionVolumes].sort((a, b) =>
        a.loggedOn.localeCompare(b.loggedOn),
      );
      return oldestFirst.map((vol) => formatShortDayLabel(vol.loggedOn, i18n.language));
    }
    const oldestFirst = [...weekVolumes].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    );
    return oldestFirst.map((week) => String(Number(week.weekStart.slice(8, 10))));
  }, [rangeDays, sessionVolumes, weekVolumes, i18n.language]);

  const exerciseRows = useMemo(() => {
    const bestsInRange = bestSetByExercise(rangeSets);
    return bestsInRange.map((best) => {
      const catalog =
        best.exerciseId != null ? exercisesById.get(best.exerciseId) : undefined;
      const displayName = displayExerciseName({
        exerciseId: best.exerciseId,
        storedName: best.exerciseName,
        exercise: catalog,
        lang: i18n.language,
      });
      return {
        best: { ...best, exerciseName: displayName },
        series: exerciseBestSeries(rangeSets, best.exerciseId, best.exerciseName),
        stub: exerciseStubFromSessionSet(
          rangeSets.find((set) =>
            best.exerciseId != null
              ? set.exerciseId === best.exerciseId
              : set.exerciseId == null && set.exerciseName === best.exerciseName,
          ) ?? rangeSets[0]!,
          catalog?.names,
        ),
      };
    });
  }, [rangeSets, exercisesById, i18n.language]);

  const sessionValue =
    sessionsGoal != null && sessionsGoal > 0
      ? t('history.training.sessionsValue', {
          actual: sessionsThisWeek,
          goal: sessionsGoal,
        })
      : String(sessionsThisWeek);

  const unitSystem = useUnitSystem();
  const runningKmLabel =
    runningKmPeriod === 'day'
      ? t('history.training.runningKmPeriodDay')
      : t('history.training.runningKmPeriodWeek');
  const runningKmValue =
    runningKm == null
      ? '—'
      : formatDistanceKm({
          distanceKm: runningKm,
          unitSystem,
          kmLabel: t('onboarding.units.km'),
          miLabel: t('onboarding.units.mi'),
        });

  function openFirstSession() {
    if (canOpenTrainingTab && onOpenTrainingTab) {
      onOpenTrainingTab();
      return;
    }
    router.push('/koli/workout-plan' as Href);
  }

  if (sessionsInRange.length === 0) {
    return (
      <View
        testID="history.training.empty"
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-8">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('history.training.emptyCta')}
          onPress={openFirstSession}
          className="items-center justify-center px-5 py-10">
          <Image
            source={require('@/assets/images/koli-curious.png')}
            style={{ width: 72, height: 72, marginBottom: 12 }}
            contentFit="contain"
          />
          <Text className="text-center text-base font-medium text-[#4F46E5]">
            {t('history.training.emptyCta')}
          </Text>
        </Pressable>
        <Pressable
          testID="training.backfill.open"
          accessibilityRole="button"
          onPress={() => router.push('/koli/workout-backfill' as Href)}
          className="items-center border-t border-black/5 px-5 py-4">
          <Text className="text-sm font-medium text-[#4F46E5]">
            {t('training.backfill.open')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Text className="mb-3 text-lg font-semibold text-gray-900">
        {t('history.training.sessionsTitle')}
      </Text>

      <View
        testID="history.training.week"
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-8">
        <View className="px-4 py-5">
          {rangeDays === 7 ? (
            <>
              <Text className="text-sm text-gray-500">
                {t('history.training.sessionsHeadlineWeek')}
              </Text>
              <Text className="mt-1 text-2xl font-bold text-[#4F46E5]">{sessionValue}</Text>
              <View className="mt-5">
                <WeekDayDots markers={weekMarkers} />
                <View className="mt-2 flex-row justify-between px-0.5">
                  {weekDayLabels.map((label, index) => (
                    <Text
                      key={`${label}-${index}`}
                      className="w-7 text-center text-[10px] text-gray-500">
                      {label}
                    </Text>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View className="gap-4">
              {weekRows30.map((row) => (
                <View key={row.weekStart} className="flex-row items-center gap-3">
                  <Text className="w-6 text-xs tabular-nums text-gray-500">
                    {String(Number(row.weekStart.slice(8, 10)))}
                  </Text>
                  <View className="min-w-0 flex-1">
                    <WeekDayDots markers={row.markers} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {bests.length > 0 || levelUps.length > 0 ? (
        <View
          testID="history.training.bests"
          style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
          className="mb-8">
          <View className="px-4 py-4">
            <Text className="mb-3 text-sm font-semibold text-gray-900">
              {t('history.training.bestsTitle')}
            </Text>
            {levelUps.map((row) => (
              <Text
                key={row.id}
                className="py-2 text-sm font-semibold"
                style={{ color: '#4F46E5' }}>
                {t('history.training.newLevel', { name: row.name })}
              </Text>
            ))}
            {visibleBests.map((best) => (
              <BestRow
                key={best.exerciseId ?? `name:${best.exerciseName}`}
                best={best}
                t={t}
              />
            ))}
            {bests.length > 3 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showAllBests
                    ? t('history.training.bestsShowLess')
                    : t('history.training.bestsShowAll')
                }
                onPress={() => setShowAllBests((prev) => !prev)}
                className="mt-2 py-2">
                <Text className="text-sm font-medium text-[#4F46E5]">
                  {showAllBests
                    ? t('history.training.bestsShowLess')
                    : t('history.training.bestsShowAll')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {volumeBars.length > 0 && (hasRepsVolume || hasSecondsVolume) ? (
        <View
          testID="history.training.volume"
          style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
          className="mb-8">
          <View className="px-4 py-4">
            <Text className="mb-3 text-sm font-semibold text-gray-900">
              {t('history.training.volumeTitle')}
            </Text>
            {showVolumePill ? (
              <View className="mb-3">
                <PillSegmentSwitcher
                  value={volumeMetric}
                  onChange={setVolumeMetric}
                  compact
                  segments={[
                    { id: 'reps', label: t('history.training.volumeReps') },
                    { id: 'seconds', label: t('history.training.volumeSeconds') },
                  ]}
                />
              </View>
            ) : null}
            <WorkoutVolumeBarChart
              bars={volumeBars}
              width={innerWidth}
              height={140}
              compact={rangeDays === 30}
            />
            <View className="mt-2 flex-row justify-between px-1">
              {volumeXLabels.map((label, index) => (
                <Text key={`${label}-${index}`} className="text-[10px] text-gray-500">
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {sessionsInRange.length > 0 ? (
        <>
          <Text className="mb-3 text-lg font-semibold text-gray-900">
            {t('history.training.recentTitle')}
          </Text>
          <View
            style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
            className="mb-8">
            <View className="px-2 py-1">
              {sessionsInRange.map((session) => {
                const targetLabel = formatTargetActual(session, t);
                return (
                  <Pressable
                    key={session.id}
                    testID={`history.training.session.${session.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={session.templateName}
                    onPress={() =>
                      router.push(`/koli/workout-session/${session.id}` as Href)
                    }
                    className="flex-row items-center px-3 py-3">
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm text-gray-900" numberOfLines={1}>
                        {formatShortDate(session.loggedOn, i18n.language)}
                        {' · '}
                        <Text style={{ fontWeight: '700' }}>{session.shortLabel}</Text>
                        {' '}
                        {session.templateName}
                      </Text>
                      <Text className="mt-0.5 text-xs" style={{ color: TEXT_SECONDARY }}>
                        {t('history.training.durationMinutes', {
                          minutes: sessionDurationMinutes(session),
                        })}
                        {targetLabel ? ` · ${targetLabel}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable
                testID="training.backfill.open"
                accessibilityRole="button"
                accessibilityLabel={t('training.backfill.open')}
                onPress={() => router.push('/koli/workout-backfill' as Href)}
                className="px-3 py-3">
                <Text className="text-sm font-medium text-[#4F46E5]">
                  {t('training.backfill.open')}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}

      {exerciseRows.length > 0 ? (
        <>
          <Text className="mb-3 text-lg font-semibold text-gray-900">
            {t('history.training.exercisesTitle')}
          </Text>
          <View
            style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
            className="mb-8">
            <View className="px-2 py-1">
              {exerciseRows.map((row) => {
                const rowKey =
                  row.best.exerciseId ?? `name:${row.best.exerciseName}`;
                const body = (
                  <>
                    <ExerciseThumb exercise={row.stub} size="sm" onPressEnabled={false} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                        {row.best.exerciseName}
                      </Text>
                      <Text className="mt-0.5 text-xs" style={{ color: TEXT_SECONDARY }}>
                        {formatBestValue(row.best.value, row.best.kind, t)}
                      </Text>
                    </View>
                    <MiniSparkline values={row.series} />
                  </>
                );
                if (row.best.exerciseId == null) {
                  return (
                    <View
                      key={rowKey}
                      testID={`history.training.exercise.name.${row.best.exerciseName}`}
                      className="flex-row items-center gap-3 px-3 py-3">
                      {body}
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={rowKey}
                    testID={`history.training.exercise.${row.best.exerciseId}`}
                    accessibilityRole="button"
                    accessibilityLabel={row.best.exerciseName}
                    onPress={() =>
                      router.push(
                        `/koli/exercise-progress/${row.best.exerciseId}` as Href,
                      )
                    }
                    className="flex-row items-center gap-3 px-3 py-3">
                    {body}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {healthConnected ? (
        <View
          style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
          className="mb-8">
          <View className="flex-row items-baseline justify-between px-4 py-4">
            <Text className="mr-3 min-w-0 flex-1 text-sm text-gray-500">
              {t('history.training.runningKmSide', { period: runningKmLabel })}
            </Text>
            <Text className="text-sm tabular-nums text-gray-500">{runningKmValue}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

function BestRow({
  best,
  t,
}: {
  best: PersonalBest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const stub = exerciseStubFromSessionSet({
    id: best.exerciseId ?? best.exerciseName,
    sessionId: '',
    userId: '',
    exerciseId: best.exerciseId,
    exerciseName: best.exerciseName,
    exercisePosition: 0,
    setIndex: 0,
    kind: best.kind,
    perSide: false,
    targetReps: null,
    targetRepsMax: null,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    reps: null,
    seconds: null,
    secondsOtherSide: null,
    weightKg: null,
    completedAt: best.completedAt,
  });

  return (
    <View className="mb-3 flex-row items-center gap-3">
      <ExerciseThumb exercise={stub} size="sm" onPressEnabled={false} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {best.exerciseName}
        </Text>
        <Text className="mt-0.5 text-xs" style={{ color: TEXT_SECONDARY }}>
          {formatBestImprovement(best, t)}
        </Text>
      </View>
    </View>
  );
}

function formatShortDayLabel(dateKey: string, locale: string): string {
  const date = parseDateOnly(dateKey);
  return date.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '');
}
