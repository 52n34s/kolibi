import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { useExercises } from '@/hooks/use-exercises';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { rangeWindowKeys } from '@/lib/history-body-metrics';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import {
  planUnitAdoption,
  recommendForMuscles,
  type MuscleRecommendation,
} from '@/lib/workouts/muscle-recommendation';
import {
  countMuscleSets,
  muscleStatus,
  visibleMuscleGroups,
  weeklySetTarget,
  type MuscleSetInput,
  type MuscleStatus,
  type MuscleWindowDays,
} from '@/lib/workouts/muscle-volume';
import { unitMuscleProfile } from '@/lib/workouts/muscles';
import { saveTemplate } from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';

type HistoryMusclesViewProps = {
  todayKey: string;
  initialDays: MuscleWindowDays;
  goalType: string | null | undefined;
};

const BAR_HEIGHT = 8;
const MARK_COLOR = '#374151';

function formatSets(value: number, lang: string): string {
  return value.toLocaleString(lang, { maximumFractionDigits: 1 });
}

/** "Muskeln" segment of Fortschritt → Training: weekly sets per muscle group. */
export function HistoryMusclesView({ todayKey, initialDays, goalType }: HistoryMusclesViewProps) {
  const { t, i18n } = useTranslation();
  const requirePlan = useRequirePlan();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const [days, setDays] = useState<MuscleWindowDays>(initialDays);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [adoptedGroups, setAdoptedGroups] = useState<ReadonlySet<string>>(new Set());

  const window30 = rangeWindowKeys({ rangeDays: 30, todayKey });
  const { data: sessions = [], isLoading } = useWorkoutSessionsRange({
    startKey: window30.startKey,
    endKey: todayKey,
  });
  const { data: exercises = [] } = useExercises();
  const { data: units = [] } = useWorkoutTemplates();

  const exercisesById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const lookup = useMemo(
    () => (exerciseId: string) => exercisesById.get(exerciseId),
    [exercisesById],
  );

  const setInputs: MuscleSetInput[] = useMemo(
    () =>
      sessions.flatMap((session) =>
        session.sets.map((set) => ({
          exerciseId: set.exerciseId,
          loggedOn: session.loggedOn,
          reps: set.reps,
          seconds: set.seconds,
          rir: (set as { rir?: number | null }).rir ?? null,
        })),
      ),
    [sessions],
  );

  const target = weeklySetTarget(goalType);

  const { rows, recommendations } = useMemo(() => {
    const counts7 = countMuscleSets({ sets: setInputs, resolve: lookup, todayKey, days: 7 });
    const counts30 = countMuscleSets({ sets: setInputs, resolve: lookup, todayKey, days: 30 });
    const groups = visibleMuscleGroups([
      counts30,
      ...units.map((unit) => unitMuscleProfile(unit, lookup)),
    ]);
    const statusRows = muscleStatus(days === 7 ? counts7 : counts30, target, groups);
    const recentSets = sessions.flatMap((session) =>
      session.sets.map((set) => ({ exerciseId: set.exerciseId, completedAt: set.completedAt })),
    );
    return {
      rows: statusRows,
      recommendations: recommendForMuscles(statusRows, { units, recentSets, exercises }),
    };
  }, [setInputs, lookup, todayKey, units, days, target, sessions, exercises]);

  const maxValue = Math.max(target * 1.5, ...rows.map((row) => row.sets));

  function groupLabel(group: string): string {
    return t(`muscles.groups.${group}`);
  }

  function adopt(rec: MuscleRecommendation) {
    const plan = planUnitAdoption({ recommendation: rec, units, lookup });
    if (!plan) {
      return;
    }
    const exerciseName = resolveExerciseName(plan.exercise, i18n.language);
    const preview =
      plan.fromSets != null
        ? t('muscles.adoptRaise', {
            unit: plan.unit.name,
            exercise: exerciseName,
            from: plan.fromSets,
            to: plan.toSets,
          })
        : t('muscles.adoptAdd', {
            unit: plan.unit.name,
            exercise: exerciseName,
            count: plan.toSets,
          });
    Alert.alert(t('muscles.adoptTitle'), preview, [
      { text: t('muscles.adoptCancel'), style: 'cancel' },
      {
        text: t('muscles.adoptConfirm'),
        onPress: () => void save(rec, plan.save, plan.unit.name),
      },
    ]);
  }

  async function save(
    rec: MuscleRecommendation,
    input: Parameters<typeof saveTemplate>[0],
    unitName: string,
  ) {
    // Editing the plan needs an active plan (AGB Ziffer 10 Abs. 5).
    if (!(await requirePlan('editPlan'))) {
      return;
    }
    setSavingGroup(rec.group);
    setSavedMessage(null);
    try {
      await saveTemplate(input);
      if (userId) {
        await invalidateTrainingQueries(queryClient, userId);
      }
      setAdoptedGroups((prev) => new Set(prev).add(rec.group));
      setSavedMessage(t('muscles.adoptSaved', { unit: unitName }));
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('muscles.adoptTitle'), t('muscles.adoptFailed'));
    } finally {
      setSavingGroup(null);
    }
  }

  const hasSets = rows.some((row) => row.sets > 0);

  return (
    <>
      <View
        testID="history.training.muscles"
        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
        className="mb-8">
        <View className="px-4 py-4">
          <Text className="mb-3 text-sm font-semibold text-gray-900">{t('muscles.title')}</Text>
          <View className="mb-3">
            <PillSegmentSwitcher
              value={String(days) as '7' | '30'}
              onChange={(value) => setDays(value === '30' ? 30 : 7)}
              compact
              segments={[
                { id: '7', label: t('muscles.window7'), testID: 'history.training.muscles.7' },
                { id: '30', label: t('muscles.window30'), testID: 'history.training.muscles.30' },
              ]}
            />
          </View>
          <Text className="mb-4 text-xs" style={{ color: TEXT_SECONDARY }}>
            {t(days === 7 ? 'muscles.hint7' : 'muscles.hint30', { target })}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={BRAND_INDIGO} />
          ) : !hasSets ? (
            <Text className="text-sm" style={{ color: TEXT_SECONDARY }}>
              {t('muscles.empty')}
            </Text>
          ) : (
            <View className="gap-3">
              {rows.map((row) => (
                <MuscleBar
                  key={row.group}
                  row={row}
                  label={groupLabel(row.group)}
                  value={
                    row.reached
                      ? `${t('muscles.value', {
                          sets: formatSets(row.sets, i18n.language),
                          target: row.target,
                        })} · ${t('muscles.reached')}`
                      : t('muscles.value', {
                          sets: formatSets(row.sets, i18n.language),
                          target: row.target,
                        })
                  }
                  maxValue={maxValue}
                />
              ))}
            </View>
          )}
        </View>
      </View>

      {hasSets && recommendations.length > 0 ? (
        <>
          <Text className="mb-3 text-lg font-semibold text-gray-900">
            {t('muscles.recommendationsTitle')}
          </Text>
          <View
            testID="history.training.muscles.recommendations"
            style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
            className="mb-8">
            <View className="px-4 py-2">
              {recommendations.map((rec) => {
                const canAdopt =
                  !adoptedGroups.has(rec.group) &&
                  planUnitAdoption({ recommendation: rec, units, lookup }) != null;
                return (
                  <View key={rec.group} className="py-3">
                    <Text className="text-sm text-gray-900">
                      {t('muscles.recommendation', {
                        group: groupLabel(rec.group),
                        sets: formatSets(rec.sets, i18n.language),
                        target: rec.target,
                        count: rec.setsToAdd,
                        exercise: resolveExerciseName(rec.exercise, i18n.language),
                      })}
                    </Text>
                    {canAdopt ? (
                      <Pressable
                        testID={`history.training.muscles.adopt.${rec.group}`}
                        accessibilityRole="button"
                        accessibilityLabel={t('muscles.adopt')}
                        disabled={savingGroup != null}
                        onPress={() => adopt(rec)}
                        className="mt-2 self-start py-1">
                        {savingGroup === rec.group ? (
                          <ActivityIndicator size="small" color={BRAND_INDIGO} />
                        ) : (
                          <Text className="text-sm font-medium text-[#4F46E5]">
                            {t('muscles.adopt')}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {savedMessage ? (
                <Text className="pb-3 text-xs" style={{ color: TEXT_SECONDARY }}>
                  {savedMessage}
                </Text>
              ) : null}
            </View>
          </View>
        </>
      ) : null}
    </>
  );
}

function MuscleBar({
  row,
  label,
  value,
  maxValue,
}: {
  row: MuscleStatus;
  label: string;
  value: string;
  maxValue: number;
}) {
  const fill = maxValue > 0 ? Math.min(1, row.sets / maxValue) : 0;
  const mark = maxValue > 0 ? Math.min(1, row.target / maxValue) : 0;
  return (
    <View testID={`history.training.muscles.row.${row.group}`}>
      <View className="mb-1 flex-row items-baseline justify-between">
        <Text className="text-sm text-gray-900">{label}</Text>
        <Text className="text-xs tabular-nums" style={{ color: TEXT_SECONDARY }}>
          {value}
        </Text>
      </View>
      <View
        style={{
          height: BAR_HEIGHT,
          borderRadius: BAR_HEIGHT / 2,
          backgroundColor: 'rgba(79,70,229,0.1)',
        }}>
        <View
          style={{
            width: `${fill * 100}%`,
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            backgroundColor: BRAND_INDIGO,
            opacity: row.reached ? 1 : 0.6,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: `${mark * 100}%`,
            top: -3,
            width: 2,
            height: BAR_HEIGHT + 6,
            marginLeft: -1,
            borderRadius: 1,
            backgroundColor: MARK_COLOR,
          }}
        />
      </View>
    </View>
  );
}
