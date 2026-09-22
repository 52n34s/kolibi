import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Href, Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import {
  BRAND_INDIGO,
  CHIP_BORDER,
  CHIP_SURFACE_SELECTED,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  TRAINING_UNIT_COLORS,
} from '@/constants/brand';
import { useExercises } from '@/hooks/use-exercises';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { newId } from '@/lib/id';
import { updateTrainingSessionsPerWeek } from '@/lib/profile';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { suggestShortLabel } from '@/lib/workouts/short-label';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import {
  UNIT_COLOR_KEYS,
  type Exercise,
  type UnitColorKey,
  type WorkoutTemplate,
} from '@/lib/workouts/types';
import {
  archiveTemplate,
  saveTemplate,
  type SaveTemplateExerciseInput,
} from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';
import { useExercisePickStore } from '@/stores/exercise-pick-store';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

const NAME_MAX = 20;
const SHORT_MAX = 2;
const PLAN_HREF = '/koli/workout-plan' as Href;

type DraftExercise = {
  key: string;
  exerciseId: string;
  exercise: Exercise;
  targetSets: number;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
  restSeconds: number | null;
  rangeEnabled: boolean;
};

function draftFromTemplate(template: WorkoutTemplate): {
  name: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  weekdays: number[];
  exercises: DraftExercise[];
} {
  return {
    name: template.name,
    shortLabel: template.shortLabel,
    colorKey: template.colorKey,
    weekdays: [...template.weekdays],
    exercises: template.exercises
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((te) => ({
        key: te.id,
        exerciseId: te.exerciseId,
        exercise: te.exercise,
        targetSets: te.targetSets,
        targetReps: te.targetReps,
        targetRepsMax: te.targetRepsMax,
        targetSeconds: te.targetSeconds,
        targetSecondsMax: te.targetSecondsMax,
        restSeconds: te.restSeconds,
        rangeEnabled:
          te.exercise.kind === 'time'
            ? te.targetSecondsMax != null &&
              te.targetSeconds != null &&
              te.targetSecondsMax > te.targetSeconds
            : te.targetRepsMax != null &&
              te.targetReps != null &&
              te.targetRepsMax > te.targetReps,
      })),
  };
}

function exerciseToDraft(exercise: Exercise): DraftExercise {
  const kindTime = exercise.kind === 'time';
  const hasRepsRange =
    !kindTime &&
    exercise.defaultReps != null &&
    exercise.defaultRepsMax != null &&
    exercise.defaultRepsMax > exercise.defaultReps;
  const hasTimeRange =
    kindTime &&
    exercise.defaultSeconds != null &&
    exercise.defaultSecondsMax != null &&
    exercise.defaultSecondsMax > exercise.defaultSeconds;
  return {
    key: newId(),
    exerciseId: exercise.id,
    exercise,
    targetSets: Math.max(1, exercise.defaultSets || 3),
    targetReps: kindTime ? null : (exercise.defaultReps ?? 10),
    targetRepsMax: hasRepsRange ? exercise.defaultRepsMax : null,
    targetSeconds: kindTime ? (exercise.defaultSeconds ?? 30) : null,
    targetSecondsMax: hasTimeRange ? exercise.defaultSecondsMax : null,
    // New rows start on "Standard-Pause" so the plan's shared value applies.
    restSeconds: null,
    rangeEnabled: hasRepsRange || hasTimeRange,
  };
}

function countDistinctWeekdays(templates: WorkoutTemplate[], editingWeekdays: number[]): number {
  const days = new Set<number>();
  for (const template of templates) {
    for (const day of template.weekdays) {
      days.add(day);
    }
  }
  for (const day of editingWeekdays) {
    days.add(day);
  }
  return days.size;
}

function Stepper({
  testID,
  value,
  onChange,
  min = 1,
  step = 1,
  suffix,
}: {
  testID: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange(Math.max(min, value - step))}
        style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text testID={testID} style={styles.stepValue}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange(value + step)}
        style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function WorkoutTemplateEditScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const params = useLocalSearchParams<{ id?: string }>();
  const paramId = typeof params.id === 'string' ? params.id : undefined;

  const templatesQuery = useWorkoutTemplates();
  const exercisesQuery = useExercises();
  const { data: profileData } = useProfileSettings(userId);
  const activeSession = useWorkoutSessionStore((s) => s.active);

  const existing = useMemo(
    () => templatesQuery.data?.find((row) => row.id === paramId),
    [templatesQuery.data, paramId],
  );

  const [name, setName] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [shortTouched, setShortTouched] = useState(false);
  const [colorKey, setColorKey] = useState<UnitColorKey>('indigo');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [initialized, setInitialized] = useState(!paramId);
  const [saving, setSaving] = useState(false);
  const [goalHint, setGoalHint] = useState<string | null>(null);

  const otherLabels = useMemo(() => {
    return (templatesQuery.data ?? [])
      .filter((row) => row.id !== paramId)
      .map((row) => row.shortLabel);
  }, [templatesQuery.data, paramId]);

  useEffect(() => {
    if (!paramId) {
      setInitialized(true);
      return;
    }
    if (!existing || initialized) {
      return;
    }
    const draft = draftFromTemplate(existing);
    setName(draft.name);
    setShortLabel(draft.shortLabel);
    setShortTouched(true);
    setColorKey(draft.colorKey);
    setWeekdays(draft.weekdays);
    setExercises(draft.exercises);
    setInitialized(true);
  }, [existing, initialized, paramId]);

  useEffect(() => {
    if (shortTouched) {
      return;
    }
    setShortLabel(suggestShortLabel(name, otherLabels));
  }, [name, otherLabels, shortTouched]);

  useFocusEffect(
    useCallback(() => {
      const ids = useExercisePickStore.getState().consumeSelection();
      if (ids.length === 0) {
        return;
      }
      const catalog = exercisesQuery.data ?? [];
      setExercises((current) => {
        const have = new Set(current.map((row) => row.exerciseId));
        const next = [...current];
        for (const id of ids) {
          if (have.has(id)) {
            continue;
          }
          const exercise = catalog.find((row) => row.id === id);
          if (exercise) {
            next.push(exerciseToDraft(exercise));
            have.add(id);
          }
        }
        return next;
      });
    }, [exercisesQuery.data]),
  );

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
  }

  function updateExercise(index: number, patch: Partial<DraftExercise>) {
    setExercises((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function shiftLadder(index: number, direction: -1 | 1) {
    const row = exercises[index];
    if (!row?.exercise.ladderKey || row.exercise.ladderStep == null) {
      return;
    }
    const catalog = (exercisesQuery.data ?? []).filter(
      (ex) => ex.userId == null && ex.ladderKey === row.exercise.ladderKey,
    );
    const next = catalog.find(
      (ex) => ex.ladderStep === (row.exercise.ladderStep ?? 0) + direction,
    );
    if (!next) {
      return;
    }
    const draft = exerciseToDraft(next);
    updateExercise(index, {
      ...draft,
      key: row.key,
      targetSets: row.targetSets,
    });
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= exercises.length) {
      return;
    }
    setExercises((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row!);
      return next;
    });
  }

  function removeExercise(index: number) {
    setExercises((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (saving) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedShort = shortLabel.trim();
    if (trimmedName.length < 1 || trimmedName.length > NAME_MAX) {
      Alert.alert(t('settings.errors.title'), t('training.templateEdit.nameInvalid'));
      return;
    }
    if (trimmedShort.length < 1 || trimmedShort.length > SHORT_MAX) {
      Alert.alert(t('settings.errors.title'), t('training.templateEdit.shortInvalid'));
      return;
    }
    if (exercises.length === 0) {
      Alert.alert(t('settings.errors.title'), t('training.templateEdit.exercisesRequired'));
      return;
    }

    const payloadExercises: SaveTemplateExerciseInput[] = exercises.map((row) => {
      const kindTime = row.exercise.kind === 'time';
      return {
        exerciseId: row.exerciseId,
        targetSets: row.targetSets,
        targetReps: kindTime ? null : row.targetReps,
        targetRepsMax: kindTime || !row.rangeEnabled ? null : row.targetRepsMax,
        targetSeconds: kindTime ? row.targetSeconds : null,
        targetSecondsMax: kindTime && row.rangeEnabled ? row.targetSecondsMax : null,
        targetWeightKg: null,
        restSeconds: row.restSeconds,
      };
    });

    setSaving(true);
    setGoalHint(null);
    try {
      await saveTemplate({
        id: paramId ?? null,
        name: trimmedName,
        shortLabel: trimmedShort,
        colorKey,
        weekdays,
        position: existing?.position ?? (templatesQuery.data?.length ?? 0),
        exercises: payloadExercises,
      });

      const currentGoal = profileData?.profile?.training_sessions_per_week ?? null;
      let suggestedGoal: number | null = null;
      if (userId && (currentGoal == null || !(currentGoal >= 1))) {
        const templates = templatesQuery.data ?? [];
        const distinct = countDistinctWeekdays(
          templates.filter((row) => row.id !== paramId),
          weekdays,
        );
        suggestedGoal = distinct > 0 ? Math.max(1, distinct) : 3;
        await updateTrainingSessionsPerWeek({
          userId,
          sessionsPerWeek: suggestedGoal,
        });
        setGoalHint(t('training.templateEdit.goalHint', { count: suggestedGoal }));
        await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      }

      if (userId) {
        await invalidateTrainingQueries(queryClient, userId);
      }

      if (suggestedGoal != null) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      router.back();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.templateEdit.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!paramId) {
      return;
    }
    Alert.alert(
      t('training.templateEdit.deleteTitle'),
      t('training.templateEdit.deleteMessage'),
      [
        { text: t('settings.common.cancel'), style: 'cancel' },
        {
          text: t('training.templateEdit.delete'),
          style: 'destructive',
          onPress: () => void doDelete(),
        },
      ],
    );
  }

  async function doDelete() {
    if (!paramId) {
      return;
    }
    setSaving(true);
    try {
      await archiveTemplate(paramId);
      if (userId) {
        await invalidateTrainingQueries(queryClient, userId);
      }
      router.replace(PLAN_HREF);
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.templateEdit.deleteFailed'));
    } finally {
      setSaving(false);
    }
  }

  const loading = Boolean(paramId) && (templatesQuery.isLoading || !initialized);

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <SettingsBackButton label={t('training.plan.title')} href={PLAN_HREF} />
      </View>

      {templatesQuery.isError && paramId ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-gray-600">
            {t('training.plan.loadFailed')}
          </Text>
        </View>
      ) : loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND_INDIGO} />
        </View>
      ) : (
        <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-6 text-2xl font-bold text-gray-900">
              {paramId
                ? t('training.templateEdit.editTitle')
                : t('training.templateEdit.createTitle')}
            </Text>

            {activeSession ? (
              <Text style={styles.sessionHint}>{t('training.templateEdit.activeSessionHint')}</Text>
            ) : null}

            {goalHint ? <Text style={styles.goalHint}>{goalHint}</Text> : null}

            <Text style={styles.label}>{t('training.templateEdit.nameLabel')}</Text>
            <OnboardingField
              testID="training.templateEdit.name"
              value={name}
              onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
              maxLength={NAME_MAX}
              placeholder={t('training.templateEdit.namePlaceholder')}
            />
            {name.length >= 15 ? (
              <Text style={styles.counter}>
                {name.length}/{NAME_MAX}
              </Text>
            ) : null}

            <Text style={styles.label}>{t('training.templateEdit.shortLabel')}</Text>
            <OnboardingField
              testID="training.templateEdit.shortLabel"
              value={shortLabel}
              onChangeText={(value) => {
                setShortTouched(true);
                setShortLabel(value.slice(0, SHORT_MAX));
              }}
              maxLength={SHORT_MAX}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>{t('training.templateEdit.colorLabel')}</Text>
            <View style={styles.colorRow}>
              {UNIT_COLOR_KEYS.map((key) => {
                const selected = colorKey === key;
                return (
                  <Pressable
                    key={key}
                    testID={`training.templateEdit.color.${key}`}
                    accessibilityRole="button"
                    onPress={() => setColorKey(key)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: TRAINING_UNIT_COLORS[key] },
                      selected && styles.colorDotSelected,
                    ]}
                  />
                );
              })}
            </View>

            <Text style={styles.label}>{t('training.templateEdit.weekdaysLabel')}</Text>
            <View style={styles.weekdayRow}>
              {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
                const active = weekdays.includes(day);
                return (
                  <Pressable
                    key={day}
                    testID={`training.templateEdit.weekday.${day}`}
                    accessibilityRole="button"
                    onPress={() => toggleWeekday(day)}
                    style={[styles.weekday, active && styles.weekdayActive]}>
                    <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>
                      {t(`supplements.schedule.weekdayDot.${day}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {weekdays.length === 0 ? (
              <Text style={styles.hint}>{t('training.templateEdit.rotatingHint')}</Text>
            ) : null}

            <Text style={styles.sectionTitle}>{t('training.templateEdit.exercisesTitle')}</Text>

            {exercises.map((row, index) => {
              const kindTime = row.exercise.kind === 'time';
              const useCustomRest = row.restSeconds != null;
              return (
                <View key={row.key} style={styles.exerciseCard}>
                  <View style={styles.exerciseTop}>
                    <ExerciseThumb exercise={row.exercise} size="sm" onPressEnabled={false} />
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {resolveExerciseName(row.exercise, i18n.language)}
                    </Text>
                    <View style={styles.exerciseArrows}>
                      <Pressable
                        testID={`training.templateEdit.exercise.${index}.up`}
                        accessibilityRole="button"
                        disabled={index === 0}
                        onPress={() => moveExercise(index, -1)}>
                        <Ionicons
                          name="chevron-up"
                          size={18}
                          color={index === 0 ? '#D1D5DB' : BRAND_INDIGO}
                        />
                      </Pressable>
                      <Pressable
                        testID={`training.templateEdit.exercise.${index}.down`}
                        accessibilityRole="button"
                        disabled={index >= exercises.length - 1}
                        onPress={() => moveExercise(index, 1)}>
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={index >= exercises.length - 1 ? '#D1D5DB' : BRAND_INDIGO}
                        />
                      </Pressable>
                    </View>
                  </View>

                  {row.exercise.ladderKey && row.exercise.ladderStep != null ? (
                    <View style={styles.ladderActions}>
                      <Pressable
                        testID={`training.templateEdit.exercise.${index}.easier`}
                        accessibilityRole="button"
                        onPress={() => shiftLadder(index, -1)}
                        style={styles.ladderBtn}>
                        <Text style={styles.ladderBtnText}>{t('training.progression.easier')}</Text>
                      </Pressable>
                      <Pressable
                        testID={`training.templateEdit.exercise.${index}.harder`}
                        accessibilityRole="button"
                        onPress={() => shiftLadder(index, 1)}
                        style={styles.ladderBtn}>
                        <Text style={styles.ladderBtnText}>{t('training.progression.harder')}</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Text style={styles.miniLabel}>{t('training.templateEdit.sets')}</Text>
                  <Stepper
                    testID={`training.templateEdit.exercise.${index}.sets`}
                    value={row.targetSets}
                    onChange={(targetSets) => updateExercise(index, { targetSets })}
                  />

                  <Text style={styles.miniLabel}>
                    {kindTime
                      ? t('training.templateEdit.seconds')
                      : t('training.templateEdit.reps')}
                  </Text>
                  <Stepper
                    testID={`training.templateEdit.exercise.${index}.min`}
                    value={kindTime ? (row.targetSeconds ?? 30) : (row.targetReps ?? 10)}
                    onChange={(value) =>
                      updateExercise(
                        index,
                        kindTime ? { targetSeconds: value } : { targetReps: value },
                      )
                    }
                    suffix={kindTime ? 's' : undefined}
                  />

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{t('training.templateEdit.range')}</Text>
                    <Switch
                      testID={`training.templateEdit.exercise.${index}.range`}
                      value={row.rangeEnabled}
                      onValueChange={(rangeEnabled) => {
                        if (rangeEnabled) {
                          if (kindTime) {
                            const min = row.targetSeconds ?? 30;
                            updateExercise(index, {
                              rangeEnabled: true,
                              targetSecondsMax: Math.max(min + 5, row.targetSecondsMax ?? min + 10),
                            });
                          } else {
                            const min = row.targetReps ?? 10;
                            updateExercise(index, {
                              rangeEnabled: true,
                              targetRepsMax: Math.max(min + 1, row.targetRepsMax ?? min + 2),
                            });
                          }
                        } else {
                          updateExercise(index, {
                            rangeEnabled: false,
                            targetRepsMax: null,
                            targetSecondsMax: null,
                          });
                        }
                      }}
                      trackColor={{ false: '#D1D5DB', true: BRAND_INDIGO }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {row.rangeEnabled ? (
                    <>
                      <Text style={styles.miniLabel}>{t('training.templateEdit.rangeMax')}</Text>
                      <Stepper
                        testID={`training.templateEdit.exercise.${index}.max`}
                        value={
                          kindTime
                            ? (row.targetSecondsMax ?? (row.targetSeconds ?? 30) + 10)
                            : (row.targetRepsMax ?? (row.targetReps ?? 10) + 2)
                        }
                        min={
                          (kindTime ? (row.targetSeconds ?? 30) : (row.targetReps ?? 10)) + 1
                        }
                        onChange={(value) =>
                          updateExercise(
                            index,
                            kindTime ? { targetSecondsMax: value } : { targetRepsMax: value },
                          )
                        }
                        suffix={kindTime ? 's' : undefined}
                      />
                    </>
                  ) : null}

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{t('training.templateEdit.restStandard')}</Text>
                    <Switch
                      value={!useCustomRest}
                      onValueChange={(useStandard) =>
                        updateExercise(index, {
                          restSeconds: useStandard
                            ? null
                            : (row.exercise.defaultRestSeconds ?? 90),
                        })
                      }
                      trackColor={{ false: '#D1D5DB', true: BRAND_INDIGO }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {useCustomRest ? (
                    <Stepper
                      testID={`training.templateEdit.exercise.${index}.rest`}
                      value={row.restSeconds ?? 90}
                      min={15}
                      step={15}
                      suffix="s"
                      onChange={(restSeconds) => updateExercise(index, { restSeconds })}
                    />
                  ) : (
                    <Text
                      testID={`training.templateEdit.exercise.${index}.rest`}
                      style={styles.restStandardLabel}>
                      {t('training.templateEdit.restStandard')}
                    </Text>
                  )}

                  <Pressable
                    testID={`training.templateEdit.exercise.${index}.remove`}
                    accessibilityRole="button"
                    onPress={() => removeExercise(index)}
                    style={styles.removeBtn}>
                    <Text style={styles.removeText}>{t('training.templateEdit.remove')}</Text>
                  </Pressable>
                </View>
              );
            })}

            <Pressable
              testID="training.templateEdit.addExercises"
              accessibilityRole="button"
              onPress={() => router.push('/koli/exercises?select=1' as Href)}
              style={styles.secondary}>
              <Text style={styles.secondaryText}>{t('training.templateEdit.addExercises')}</Text>
            </Pressable>
          </ScrollView>

          <View className="px-6 pb-8 gap-3">
            <Pressable
              testID="training.templateEdit.save"
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void handleSave()}
              style={[styles.primary, saving && styles.disabled]}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>{t('training.templateEdit.save')}</Text>
              )}
            </Pressable>
            {paramId ? (
              <Pressable
                testID="training.templateEdit.delete"
                accessibilityRole="button"
                disabled={saving}
                onPress={handleDelete}>
                <Text style={styles.deleteText}>{t('training.templateEdit.delete')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      <NumberInputAccessory />
    </HomeLayout>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  miniLabel: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  counter: {
    marginTop: 4,
    fontSize: 12,
    color: TEXT_TERTIARY,
    textAlign: 'right',
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  sessionHint: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    color: BRAND_INDIGO,
    fontSize: 13,
    fontWeight: '600',
  },
  goalHint: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 231, 199, 0.25)',
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#111827',
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekday: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: CHIP_BORDER,
  },
  weekdayActive: {
    backgroundColor: BRAND_INDIGO,
    borderColor: BRAND_INDIGO,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  weekdayTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  exerciseCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.12)',
  },
  exerciseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  exerciseArrows: {
    gap: 2,
  },
  ladderActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ladderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  ladderBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_INDIGO,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_INDIGO,
  },
  stepValue: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    fontVariant: ['tabular-nums'],
  },
  switchRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  restStandardLabel: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  removeBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  removeText: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  secondary: {
    marginTop: 8,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHIP_SURFACE_SELECTED,
  },
  secondaryText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
    fontSize: 15,
  },
  primary: {
    height: 48,
    borderRadius: 12,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  deleteText: {
    textAlign: 'center',
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 15,
    paddingVertical: 8,
  },
});
