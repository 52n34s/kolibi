import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Href, Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import {
  BirthDatePickerModal,
  openBirthDatePickerAndroid,
} from '@/components/onboarding/birth-date-picker';
import {
  OnboardingField,
  OnboardingFieldPressable,
} from '@/components/onboarding/onboarding-field';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { exerciseStubFromSessionSet } from '@/components/training/exercise-stub';
import { GlassCard } from '@/components/ui/glass-card';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import {
  BRAND_INDIGO,
  TEXT_SECONDARY,
  TRAINING_UNIT_COLORS,
} from '@/constants/brand';
import { useExercises } from '@/hooks/use-exercises';
import { useWorkoutSession } from '@/hooks/use-workout-session';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { newId } from '@/lib/id';
import { formatAppDate } from '@/lib/onboarding';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import { updateTrainingSession } from '@/lib/training-sessions';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { formatTargetRange } from '@/lib/workouts/format-target';
import {
  finishedAtFromDuration,
  formatActualSetValue,
  groupSessionSets,
  sessionDurationFromTimestamps,
  type SessionExerciseGroup,
} from '@/lib/workouts/session-detail-utils';
import type { GymIntensity, SessionSet } from '@/lib/workouts/types';
import {
  deleteSessionSet,
  deleteWorkoutSession,
  upsertSessionSets,
  upsertWorkoutSession,
} from '@/lib/workouts/workouts-api';
import { fetchWeightKgForTraining } from '@/lib/workouts/finish-session-runtime';
import { useAuthStore } from '@/stores/auth-store';
import { useExercisePickStore } from '@/stores/exercise-pick-store';

const INTENSITIES: GymIntensity[] = ['easy', 'normal', 'hard'];
const DURATION_ACCESSORY = 'session-detail-duration';

function setValueFields(
  set: SessionSet,
  value: number,
  otherSide?: number | null,
): Pick<SessionSet, 'reps' | 'seconds' | 'secondsOtherSide'> {
  if (set.kind === 'time') {
    return {
      reps: null,
      seconds: value,
      secondsOtherSide: set.perSide ? (otherSide ?? value) : null,
    };
  }
  return { reps: value, seconds: null, secondsOtherSide: null };
}

export default function WorkoutSessionDetailScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const sessionQuery = useWorkoutSession(id);
  const exercisesQuery = useExercises();
  const consumeSelection = useExercisePickStore((s) => s.consumeSelection);

  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const session = sessionQuery.data ?? null;
  const todayKey = localDateKey();
  const groups = useMemo(
    () => (session ? groupSessionSets(session) : []),
    [session],
  );

  const durationMinutes = session
    ? durationDraft != null
      ? Number(durationDraft)
      : sessionDurationFromTimestamps(session)
    : 0;

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        return;
      }
      const ids = consumeSelection();
      if (ids.length === 0) {
        return;
      }
      void addExercisesByIds(ids);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only on focus after pick
    }, [session?.id]),
  );

  async function refresh() {
    await sessionQuery.refetch();
    if (userId) {
      await invalidateTrainingQueries(queryClient, userId);
    }
  }

  async function persistMeta(next: {
    loggedOn?: string;
    durationMinutes?: number;
    intensity?: GymIntensity;
  }) {
    if (!session || !userId) {
      return;
    }
    const loggedOn = next.loggedOn ?? session.loggedOn;
    if (loggedOn > todayKey) {
      return;
    }
    const duration =
      next.durationMinutes ?? sessionDurationFromTimestamps(session);
    const intensity = next.intensity ?? session.intensity ?? 'normal';
    const finishedAt = finishedAtFromDuration(session.startedAt, duration);

    setSaving(true);
    try {
      await upsertWorkoutSession({
        id: session.id,
        userId: session.userId,
        templateId: session.templateId,
        templateName: session.templateName,
        shortLabel: session.shortLabel,
        colorKey: session.colorKey,
        loggedOn,
        startedAt: session.startedAt,
        finishedAt,
        intensity,
        trainingSessionId: session.trainingSessionId,
      });

      if (session.trainingSessionId) {
        const weightKg = await fetchWeightKgForTraining(userId);
        await updateTrainingSession({
          id: session.trainingSessionId,
          userId,
          loggedOn,
          durationMinutes: duration,
          intensity,
          weightKg,
        });
      }

      setDurationDraft(null);
      await refresh();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('training.sessionDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function persistSet(updated: SessionSet) {
    if (!userId) {
      return;
    }
    setSaving(true);
    try {
      await upsertSessionSets([
        {
          id: updated.id,
          sessionId: updated.sessionId,
          userId: updated.userId,
          exerciseId: updated.exerciseId,
          exerciseName: updated.exerciseName,
          exercisePosition: updated.exercisePosition,
          setIndex: updated.setIndex,
          kind: updated.kind,
          perSide: updated.perSide,
          targetReps: updated.targetReps,
          targetRepsMax: updated.targetRepsMax,
          targetSeconds: updated.targetSeconds,
          targetSecondsMax: updated.targetSecondsMax,
          targetWeightKg: updated.targetWeightKg,
          reps: updated.reps,
          seconds: updated.seconds,
          secondsOtherSide: updated.secondsOtherSide,
          weightKg: updated.weightKg,
          completedAt: updated.completedAt,
        },
      ]);
      await refresh();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('training.sessionDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function addSet(group: SessionExerciseGroup) {
    if (!session) {
      return;
    }
    const nextIndex = group.sets.length;
    const template = group.sets[0];
    if (!template) {
      return;
    }
    const value =
      template.kind === 'time'
        ? (template.targetSeconds ?? 0)
        : (template.targetReps ?? 0);
    const newSet: SessionSet = {
      ...template,
      id: newId(),
      setIndex: nextIndex,
      completedAt: new Date().toISOString(),
      ...setValueFields(template, value, template.perSide ? value : null),
    };
    await persistSet(newSet);
  }

  async function removeSet(group: SessionExerciseGroup, set: SessionSet) {
    if (group.sets.length <= 1) {
      Alert.alert(t('training.sessionDetail.needOneSet'));
      return;
    }
    setSaving(true);
    try {
      await deleteSessionSet(set.id);
      const remaining = group.sets
        .filter((row) => row.id !== set.id)
        .map((row, index) => ({ ...row, setIndex: index }));
      await upsertSessionSets(
        remaining.map((row) => ({
          id: row.id,
          sessionId: row.sessionId,
          userId: row.userId,
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          exercisePosition: row.exercisePosition,
          setIndex: row.setIndex,
          kind: row.kind,
          perSide: row.perSide,
          targetReps: row.targetReps,
          targetRepsMax: row.targetRepsMax,
          targetSeconds: row.targetSeconds,
          targetSecondsMax: row.targetSecondsMax,
          targetWeightKg: row.targetWeightKg,
          reps: row.reps,
          seconds: row.seconds,
          secondsOtherSide: row.secondsOtherSide,
          weightKg: row.weightKg,
          completedAt: row.completedAt,
        })),
      );
      await refresh();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('training.sessionDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function removeExercise(group: SessionExerciseGroup) {
    if (groups.length <= 1) {
      Alert.alert(t('training.sessionDetail.needOneExercise'));
      return;
    }
    setSaving(true);
    try {
      for (const set of group.sets) {
        await deleteSessionSet(set.id);
      }
      const others = groups.filter((row) => row.key !== group.key);
      const reindexed = others.flatMap((row, position) =>
        row.sets.map((set) => ({ ...set, exercisePosition: position })),
      );
      await upsertSessionSets(
        reindexed.map((row) => ({
          id: row.id,
          sessionId: row.sessionId,
          userId: row.userId,
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          exercisePosition: row.exercisePosition,
          setIndex: row.setIndex,
          kind: row.kind,
          perSide: row.perSide,
          targetReps: row.targetReps,
          targetRepsMax: row.targetRepsMax,
          targetSeconds: row.targetSeconds,
          targetSecondsMax: row.targetSecondsMax,
          targetWeightKg: row.targetWeightKg,
          reps: row.reps,
          seconds: row.seconds,
          secondsOtherSide: row.secondsOtherSide,
          weightKg: row.weightKg,
          completedAt: row.completedAt,
        })),
      );
      await refresh();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('training.sessionDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function moveExercise(group: SessionExerciseGroup, direction: -1 | 1) {
    const index = groups.findIndex((row) => row.key === group.key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= groups.length || !session) {
      return;
    }
    const next = [...groups];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    const payload = next.flatMap((item, position) =>
      item.sets.map((set) => ({
        id: set.id,
        sessionId: set.sessionId,
        userId: set.userId,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        exercisePosition: position,
        setIndex: set.setIndex,
        kind: set.kind,
        perSide: set.perSide,
        targetReps: set.targetReps,
        targetRepsMax: set.targetRepsMax,
        targetSeconds: set.targetSeconds,
        targetSecondsMax: set.targetSecondsMax,
        targetWeightKg: set.targetWeightKg,
        reps: set.reps,
        seconds: set.seconds,
        secondsOtherSide: set.secondsOtherSide,
        weightKg: set.weightKg,
        completedAt: set.completedAt,
      })),
    );
    setSaving(true);
    try {
      await upsertSessionSets(payload);
      await refresh();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('training.sessionDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function addExercisesByIds(ids: string[]) {
    if (!session) {
      return;
    }
    const catalog = exercisesQuery.data ?? [];
    const positionBase = groups.length;
    const now = new Date().toISOString();
    const newSets: SessionSet[] = [];
    ids.forEach((exerciseId, offset) => {
      const exercise = catalog.find((row) => row.id === exerciseId);
      if (!exercise) {
        return;
      }
      const count = Math.max(1, exercise.defaultSets);
      for (let i = 0; i < count; i += 1) {
        const value =
          exercise.kind === 'time'
            ? (exercise.defaultSeconds ?? 0)
            : (exercise.defaultReps ?? 0);
        const fields = setValueFields(
          {
            id: '',
            sessionId: session.id,
            userId: session.userId,
            exerciseId: exercise.id,
            exerciseName: '',
            exercisePosition: 0,
            setIndex: 0,
            kind: exercise.kind,
            perSide: exercise.perSide,
            targetReps: exercise.defaultReps,
            targetRepsMax: null,
            targetSeconds: exercise.defaultSeconds,
            targetSecondsMax: null,
            targetWeightKg: null,
            reps: null,
            seconds: null,
            secondsOtherSide: null,
            weightKg: null,
            completedAt: now,
          },
          value,
          exercise.perSide ? value : null,
        );
        const stub: SessionSet = {
          id: newId(),
          sessionId: session.id,
          userId: session.userId,
          exerciseId: exercise.id,
          exerciseName: resolveExerciseName(exercise, i18n.language),
          exercisePosition: positionBase + offset,
          setIndex: i,
          kind: exercise.kind,
          perSide: exercise.perSide,
          targetReps: exercise.defaultReps,
          targetRepsMax: null,
          targetSeconds: exercise.defaultSeconds,
          targetSecondsMax: null,
          targetWeightKg: null,
          weightKg: null,
          completedAt: now,
          ...fields,
        };
        newSets.push(stub);
      }
    });
    if (newSets.length === 0) {
      return;
    }
    setSaving(true);
    try {
      await upsertSessionSets(
        newSets.map((row) => ({
          id: row.id,
          sessionId: row.sessionId,
          userId: row.userId,
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          exercisePosition: row.exercisePosition,
          setIndex: row.setIndex,
          kind: row.kind,
          perSide: row.perSide,
          targetReps: row.targetReps,
          targetRepsMax: row.targetRepsMax,
          targetSeconds: row.targetSeconds,
          targetSecondsMax: row.targetSecondsMax,
          targetWeightKg: row.targetWeightKg,
          reps: row.reps,
          seconds: row.seconds,
          secondsOtherSide: row.secondsOtherSide,
          weightKg: row.weightKg,
          completedAt: row.completedAt,
        })),
      );
      await refresh();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('training.sessionDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function openDatePicker() {
    if (!session) {
      return;
    }
    const minDate = parseDateOnly('2020-01-01');
    const maxDate = parseDateOnly(todayKey);
    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: parseDateOnly(session.loggedOn),
        minimumDate: minDate,
        maximumDate: maxDate,
        onChange: (next) => {
          void persistMeta({ loggedOn: localDateKey(next) });
        },
      });
      return;
    }
    setShowDatePicker(true);
  }

  function confirmDelete() {
    Alert.alert(
      t('training.sessionDetail.deleteTitle'),
      t('training.sessionDetail.deleteConfirm'),
      [
        { text: t('settings.common.cancel'), style: 'cancel' },
        {
          text: t('training.sessionDetail.delete'),
          style: 'destructive',
          onPress: () => {
            void handleDelete();
          },
        },
      ],
    );
  }

  async function handleDelete() {
    if (!session || !userId) {
      return;
    }
    setSaving(true);
    try {
      await deleteWorkoutSession(session.id);
      await invalidateTrainingQueries(queryClient, userId);
      router.back();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('training.sessionDetail.saveFailed'));
      setSaving(false);
    }
  }

  function startEditSet(set: SessionSet) {
    setEditingSetId(set.id);
    setEditDraft(formatActualSetValue(set));
  }

  function commitEditSet(set: SessionSet) {
    const raw = editDraft.trim();
    setEditingSetId(null);
    if (set.perSide && set.kind === 'time' && raw.includes('/')) {
      const [a, b] = raw.split('/').map((part) => Number(part.trim().replace(',', '.')));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        void persistSet({
          ...set,
          ...setValueFields(set, Math.round(a!), Math.round(b!)),
        });
      }
      return;
    }
    const value = Number(raw.replace(',', '.'));
    if (Number.isFinite(value) && value >= 0) {
      void persistSet({
        ...set,
        ...setValueFields(set, Math.round(value)),
      });
    }
  }

  function promptSetValue(group: SessionExerciseGroup, set: SessionSet) {
    startEditSet(set);
  }

  if (sessionQuery.isLoading) {
    return (
      <HomeLayout>
        <Stack.Screen
          options={{
            title: '',
            headerLeft: () => (
              <SettingsBackButton label={t('history.training.sessionDetailTitle')} />
            ),
          }}
        />
        <View style={styles.centered}>
          <ActivityIndicator color={BRAND_INDIGO} />
        </View>
      </HomeLayout>
    );
  }

  if (!session) {
    return (
      <HomeLayout>
        <Stack.Screen
          options={{
            title: '',
            headerLeft: () => (
              <SettingsBackButton label={t('history.training.sessionDetailTitle')} />
            ),
          }}
        />
        <View style={styles.centered}>
          <Text style={styles.muted}>{t('training.sessionDetail.notFound')}</Text>
        </View>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <SettingsBackButton label={t('history.training.sessionDetailTitle')} />
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingHorizontal: 24,
          paddingBottom: 48,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled">
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    TRAINING_UNIT_COLORS[session.colorKey] ?? BRAND_INDIGO,
                },
              ]}
            />
            <Text style={styles.title} numberOfLines={2}>
              {session.shortLabel} · {session.templateName}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>{t('home.training.dateLabel')}</Text>
          <OnboardingFieldPressable
            testID="training.sessionDetail.date"
            onPress={openDatePicker}>
            <Text style={styles.dateValue}>
              {formatAppDate(parseDateOnly(session.loggedOn), i18n.language)}
            </Text>
          </OnboardingFieldPressable>

          <Text style={styles.fieldLabel}>{t('home.training.durationLabel')}</Text>
          <OnboardingField
            testID="training.sessionDetail.duration"
            value={
              durationDraft ??
              String(sessionDurationFromTimestamps(session))
            }
            onChangeText={setDurationDraft}
            keyboardType="number-pad"
            inputAccessoryViewID={DURATION_ACCESSORY}
            onBlur={() => {
              if (
                Number.isFinite(durationMinutes) &&
                durationMinutes >= 1 &&
                durationMinutes <= 600
              ) {
                void persistMeta({ durationMinutes: Math.round(durationMinutes) });
              } else {
                setDurationDraft(null);
              }
            }}
          />
          <NumberInputAccessory nativeID={DURATION_ACCESSORY} />

          <Text style={styles.fieldLabel}>{t('home.training.intensityLabel')}</Text>
          <View style={styles.intensityRow}>
            {INTENSITIES.map((key) => {
              const selected = (session.intensity ?? 'normal') === key;
              return (
                <Pressable
                  key={key}
                  testID={`training.sessionDetail.intensity.${key}`}
                  accessibilityRole="button"
                  onPress={() => void persistMeta({ intensity: key })}
                  style={[styles.intensityChip, selected && styles.intensityChipOn]}>
                  <Text
                    style={[
                      styles.intensityLabel,
                      selected && styles.intensityLabelOn,
                    ]}>
                    {t(`home.training.intensity.${key}.label`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {groups.map((group) => {
          const target = formatTargetRange({
            kind: group.kind,
            reps: group.targetReps,
            repsMax: group.targetRepsMax,
            seconds: group.targetSeconds,
            secondsMax: group.targetSecondsMax,
          });
          const actuals = group.sets.map(formatActualSetValue).join(', ');
          const stub = exerciseStubFromSessionSet(group.sets[0]!);
          const exKey = group.exerciseId ?? group.key;

          return (
            <GlassCard key={group.key} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <ExerciseThumb exercise={stub} size="sm" onPressEnabled={false} />
                <View style={styles.exerciseText}>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {group.exerciseName}
                  </Text>
                  <Text style={styles.muted}>
                    {t('training.sessionDetail.targetToActual', {
                      target,
                      actuals,
                    })}
                  </Text>
                </View>
                <View style={styles.moveCol}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void moveExercise(group, -1)}
                    hitSlop={8}>
                    <Ionicons name="chevron-up" size={18} color={BRAND_INDIGO} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void moveExercise(group, 1)}
                    hitSlop={8}>
                    <Ionicons name="chevron-down" size={18} color={BRAND_INDIGO} />
                  </Pressable>
                </View>
              </View>

              {group.sets.map((set) => (
                <View key={set.id} style={styles.setRow}>
                  {editingSetId === set.id ? (
                    <TextInput
                      testID={`training.sessionDetail.set.${exKey}.${set.setIndex}`}
                      value={editDraft}
                      onChangeText={setEditDraft}
                      onBlur={() => commitEditSet(set)}
                      onSubmitEditing={() => commitEditSet(set)}
                      keyboardType="numbers-and-punctuation"
                      autoFocus
                      style={styles.setInput}
                    />
                  ) : (
                    <Pressable
                      testID={`training.sessionDetail.set.${exKey}.${set.setIndex}`}
                      accessibilityRole="button"
                      onPress={() => promptSetValue(group, set)}
                      style={styles.setValuePress}>
                      <Text style={styles.setValue}>
                        {t('training.sessionDetail.setLabel', {
                          index: set.setIndex + 1,
                          value: formatActualSetValue(set),
                        })}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    testID={`training.sessionDetail.removeSet.${exKey}.${set.setIndex}`}
                    accessibilityRole="button"
                    onPress={() => void removeSet(group, set)}
                    hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={TEXT_SECONDARY} />
                  </Pressable>
                </View>
              ))}

              <View style={styles.exerciseActions}>
                <Pressable
                  testID={`training.sessionDetail.addSet.${exKey}`}
                  accessibilityRole="button"
                  onPress={() => void addSet(group)}>
                  <Text style={styles.link}>{t('training.panel.addSet')}</Text>
                </Pressable>
                <Pressable
                  testID={`training.sessionDetail.removeExercise.${exKey}`}
                  accessibilityRole="button"
                  onPress={() => void removeExercise(group)}>
                  <Text style={styles.dangerLink}>
                    {t('training.sessionDetail.removeExercise')}
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          );
        })}

        <Pressable
          testID="training.sessionDetail.addExercise"
          accessibilityRole="button"
          onPress={() => router.push('/koli/exercises?select=1' as Href)}
          style={styles.addExercise}>
          <Text style={styles.link}>{t('training.panel.addExercise')}</Text>
        </Pressable>

        <Pressable
          testID="training.sessionDetail.delete"
          accessibilityRole="button"
          onPress={confirmDelete}
          style={styles.deleteBtn}
          disabled={saving}>
          <Text style={styles.deleteText}>{t('training.sessionDetail.delete')}</Text>
        </Pressable>

        {saving ? (
          <ActivityIndicator color={BRAND_INDIGO} style={{ marginTop: 8 }} />
        ) : null}
      </ScrollView>

      {Platform.OS === 'ios' ? (
        <BirthDatePickerModal
          visible={showDatePicker}
          value={parseDateOnly(session.loggedOn)}
          minimumDate={parseDateOnly('2020-01-01')}
          maximumDate={parseDateOnly(todayKey)}
          onClose={() => setShowDatePicker(false)}
          onChange={(next) => {
            setShowDatePicker(false);
            void persistMeta({ loggedOn: localDateKey(next) });
          }}
        />
      ) : null}
    </HomeLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  headerCard: {
    padding: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  fieldLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intensityChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(79,70,229,0.08)',
    alignItems: 'center',
  },
  intensityChipOn: {
    backgroundColor: 'rgba(79,70,229,0.22)',
  },
  intensityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  intensityLabelOn: {
    color: BRAND_INDIGO,
  },
  exerciseCard: {
    padding: 14,
    gap: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  moveCol: {
    gap: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(79,70,229,0.12)',
  },
  setValuePress: {
    flex: 1,
  },
  setValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  setInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
    paddingVertical: 4,
  },
  dateValue: {
    fontSize: 16,
    color: '#111827',
  },
  exerciseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  addExercise: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  link: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 15,
  },
  dangerLink: {
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(185,28,28,0.08)',
  },
  deleteText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 15,
  },
  muted: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
});
