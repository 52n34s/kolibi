import * as Sentry from '@sentry/react-native';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { GlassCard } from '@/components/ui/glass-card';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import {
  BRAND_INDIGO,
  TEXT_SECONDARY,
  TRAINING_UNIT_COLORS,
} from '@/constants/brand';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { formatAppDate } from '@/lib/onboarding';
import { buildBackfillSession } from '@/lib/workouts/backfill';
import { runFinishActiveSession } from '@/lib/workouts/finish-session-runtime';
import type {
  ActiveExercise,
  ActiveSession,
  GymIntensity,
  WorkoutTemplate,
} from '@/lib/workouts/types';
import { useAuthStore } from '@/stores/auth-store';

type Step = 'template' | 'meta' | 'sets';

const INTENSITIES: GymIntensity[] = ['easy', 'normal', 'hard'];
// One accessory bar for every number field on this screen — the set inputs used
// to open a bare number pad with no way to close it.
const NUMBER_ACCESSORY = 'backfill-number';

export default function WorkoutBackfillScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets({ hasStackHeader: true });
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const templatesQuery = useWorkoutTemplates();

  const todayKey = localDateKey();
  const [step, setStep] = useState<Step>('template');
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [loggedOn, setLoggedOn] = useState(todayKey);
  const [durationDraft, setDurationDraft] = useState('45');
  const [intensity, setIntensity] = useState<GymIntensity>('normal');
  const [draft, setDraft] = useState<ActiveSession | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const templates = useMemo(
    () =>
      (templatesQuery.data ?? []).slice().sort((a, b) => a.position - b.position),
    [templatesQuery.data],
  );

  const durationMinutes = Number(durationDraft);

  function selectTemplate(next: WorkoutTemplate) {
    setTemplate(next);
    setStep('meta');
  }

  function openDatePicker() {
    const minDate = parseDateOnly('2020-01-01');
    const maxDate = parseDateOnly(todayKey);
    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: parseDateOnly(loggedOn),
        minimumDate: minDate,
        maximumDate: maxDate,
        onChange: (next) => setLoggedOn(localDateKey(next)),
      });
      return;
    }
    setShowDatePicker(true);
  }

  function goToSets() {
    if (!template) {
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
      Alert.alert(t('settings.errors.title'), t('home.training.invalidDuration'));
      return;
    }
    if (loggedOn > todayKey) {
      return;
    }
    if (!userId) {
      return;
    }
    const session = buildBackfillSession(template, {
      userId,
      loggedOn,
      durationMinutes: Math.round(durationMinutes),
      intensity,
      lang: i18n.language,
    });
    setDraft(session);
    setStep('sets');
  }

  function updateSetValue(
    exerciseIndex: number,
    setIndex: number,
    value: number,
    otherSide?: number | null,
  ) {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const items = prev.items.map((item, ei) => {
        if (ei !== exerciseIndex) {
          return item;
        }
        return {
          ...item,
          sets: item.sets.map((set, si) => {
            if (si !== setIndex) {
              return set;
            }
            return {
              ...set,
              value,
              secondsOtherSide:
                item.kind === 'time' && item.perSide
                  ? (otherSide ?? value)
                  : null,
            };
          }),
        };
      });
      return { ...prev, items };
    });
  }

  async function save() {
    if (!draft || !userId || !template) {
      return;
    }
    setSaving(true);
    try {
      const result = await runFinishActiveSession(draft, {
        intensity,
        userId,
        queryClient,
        finishedAt: draft.finishedAt ?? undefined,
        durationMinutes: Math.round(durationMinutes),
      });
      if (!result.ok) {
        throw result.error instanceof Error
          ? result.error
          : new Error('backfill_failed');
      }
      router.back();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.backfill.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <HomeLayout>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <SettingsBackButton label={t('training.backfill.title')} />
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingHorizontal: 24,
          paddingBottom: 48,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('training.backfill.title')}</Text>

        {step === 'template' ? (
          <>
            <Text style={styles.hint}>{t('training.backfill.pickTemplate')}</Text>
            {templatesQuery.isLoading ? (
              <ActivityIndicator color={BRAND_INDIGO} />
            ) : null}
            {templates.map((row) => (
              <Pressable
                key={row.id}
                testID={`training.backfill.template.${row.shortLabel}`}
                accessibilityRole="button"
                onPress={() => selectTemplate(row)}>
                <GlassCard style={styles.templateCard}>
                  <View style={styles.templateRow}>
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            TRAINING_UNIT_COLORS[row.colorKey] ?? BRAND_INDIGO,
                        },
                      ]}
                    />
                    <Text style={styles.templateName}>
                      {row.shortLabel} · {row.name}
                    </Text>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </>
        ) : null}

        {step === 'meta' && template ? (
          <>
            <Text style={styles.subtitle}>
              {template.shortLabel} · {template.name}
            </Text>
            <Text style={styles.fieldLabel}>{t('home.training.dateLabel')}</Text>
            <OnboardingFieldPressable
              testID="training.backfill.date"
              onPress={openDatePicker}>
              <Text style={styles.dateValue}>
                {formatAppDate(parseDateOnly(loggedOn), i18n.language)}
              </Text>
            </OnboardingFieldPressable>

            <Text style={styles.fieldLabel}>{t('home.training.durationLabel')}</Text>
            <OnboardingField
              testID="training.backfill.duration"
              value={durationDraft}
              onChangeText={setDurationDraft}
              keyboardType="number-pad"
              inputAccessoryViewID={NUMBER_ACCESSORY}
            />

            <Text style={styles.fieldLabel}>{t('home.training.intensityLabel')}</Text>
            <View style={styles.intensityRow}>
              {INTENSITIES.map((key) => {
                const selected = intensity === key;
                return (
                  <Pressable
                    key={key}
                    testID={`training.backfill.intensity.${key}`}
                    accessibilityRole="button"
                    onPress={() => setIntensity(key)}
                    style={[styles.chip, selected && styles.chipOn]}>
                    <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                      {t(`home.training.intensity.${key}.label`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              testID="training.backfill.next"
              accessibilityRole="button"
              onPress={goToSets}
              style={styles.primaryBtn}>
              <Text style={styles.primaryText}>{t('training.backfill.continue')}</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'sets' && draft ? (
          <>
            <Text style={styles.hint}>{t('training.backfill.setsHint')}</Text>
            {draft.items.map((item, exerciseIndex) => (
              <BackfillExerciseCard
                key={`${item.exerciseId}-${exerciseIndex}`}
                item={item}
                exerciseIndex={exerciseIndex}
                onChange={updateSetValue}
              />
            ))}
            <Pressable
              testID="training.backfill.save"
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void save()}
              style={styles.primaryBtn}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{t('training.backfill.save')}</Text>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <NumberInputAccessory nativeID={NUMBER_ACCESSORY} />

      {Platform.OS === 'ios' ? (
        <BirthDatePickerModal
          title={t('home.training.datePickerTitle')}
          visible={showDatePicker}
          value={parseDateOnly(loggedOn)}
          minimumDate={parseDateOnly('2020-01-01')}
          maximumDate={parseDateOnly(todayKey)}
          onClose={() => setShowDatePicker(false)}
          onChange={(next) => {
            setShowDatePicker(false);
            setLoggedOn(localDateKey(next));
          }}
        />
      ) : null}
    </HomeLayout>
  );
}

function BackfillExerciseCard({
  item,
  exerciseIndex,
  onChange,
}: {
  item: ActiveExercise;
  exerciseIndex: number;
  onChange: (
    exerciseIndex: number,
    setIndex: number,
    value: number,
    otherSide?: number | null,
  ) => void;
}) {
  const { t } = useTranslation();

  return (
    <GlassCard style={styles.exerciseCard}>
      <Text style={styles.exerciseName}>{item.name}</Text>
      {item.sets.map((set, setIndex) => (
        <View key={set.id} style={styles.setBlock}>
          <Text style={styles.setLabel}>
            {t('training.backfill.setN', { index: setIndex + 1 })}
          </Text>
          {item.kind === 'time' && item.perSide ? (
            <View style={styles.sideRow}>
              <TextInput
                testID={`training.backfill.set.${exerciseIndex}.${setIndex}`}
                value={String(set.value)}
                onChangeText={(text) => {
                  const value = Number(text.replace(',', '.'));
                  if (Number.isFinite(value)) {
                    onChange(exerciseIndex, setIndex, Math.round(value), set.secondsOtherSide);
                  }
                }}
                keyboardType="number-pad"
                inputAccessoryViewID={NUMBER_ACCESSORY}
                style={styles.input}
              />
              <Text style={styles.slash}>/</Text>
              <TextInput
                testID={`training.backfill.set.${exerciseIndex}.${setIndex}.other`}
                value={String(set.secondsOtherSide ?? set.value)}
                onChangeText={(text) => {
                  const other = Number(text.replace(',', '.'));
                  if (Number.isFinite(other)) {
                    onChange(exerciseIndex, setIndex, set.value, Math.round(other));
                  }
                }}
                keyboardType="number-pad"
                inputAccessoryViewID={NUMBER_ACCESSORY}
                style={styles.input}
              />
              <Text style={styles.unit}>s</Text>
            </View>
          ) : (
            <View style={styles.sideRow}>
              <TextInput
                testID={`training.backfill.set.${exerciseIndex}.${setIndex}`}
                value={String(set.value)}
                onChangeText={(text) => {
                  const value = Number(text.replace(',', '.'));
                  if (Number.isFinite(value)) {
                    onChange(exerciseIndex, setIndex, Math.round(value));
                  }
                }}
                keyboardType="number-pad"
                inputAccessoryViewID={NUMBER_ACCESSORY}
                style={styles.input}
              />
              <Text style={styles.unit}>{item.kind === 'time' ? 's' : ''}</Text>
            </View>
          )}
        </View>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  hint: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  templateCard: {
    padding: 14,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  fieldLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  dateValue: {
    fontSize: 16,
    color: '#111827',
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  chipOn: {
    backgroundColor: 'rgba(79,70,229,0.22)',
  },
  chipText: {
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  chipTextOn: {
    color: BRAND_INDIGO,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: BRAND_INDIGO,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  exerciseCard: {
    padding: 14,
    gap: 10,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  setBlock: {
    gap: 6,
  },
  setLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
    backgroundColor: '#fff',
  },
  slash: {
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  unit: {
    color: TEXT_SECONDARY,
    fontWeight: '600',
    minWidth: 12,
  },
});
