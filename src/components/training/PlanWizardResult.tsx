import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY, TRAINING_UNIT_COLORS } from '@/constants/brand';
import type { ApplyBuiltPlanMode } from '@/lib/workouts/apply-built-plan';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import {
  getPlanCatalogEntry,
  planCatalogName,
  type PlanCatalogEntry,
  type PlanEquipment,
} from '@/lib/workouts/plan-catalog';
import { swapOptions, type BuiltPlan, type BuiltPlanExercise } from '@/lib/workouts/plan-builder';
import type { Exercise } from '@/lib/workouts/types';

type PlanWizardResultProps = {
  plan: BuiltPlan;
  equipment: readonly PlanEquipment[];
  /** Active units exist → offer add or replace; otherwise one save button. */
  hasActiveUnits: boolean;
  saving: ApplyBuiltPlanMode | null;
  onReplaceExercise: (sessionIndex: number, exerciseIndex: number, slug: string) => void;
  onRemoveExercise: (sessionIndex: number, exerciseIndex: number) => void;
  onSave: (mode: ApplyBuiltPlanMode) => void;
  onEditAnswers: () => void;
};

/** Catalog snapshot row as an Exercise for ExerciseThumb and the image viewer. */
function previewExercise(entry: PlanCatalogEntry): Exercise {
  return {
    id: `catalog:${entry.slug}`,
    userId: null,
    catalogSlug: entry.slug,
    names: entry.names,
    kind: entry.kind,
    perSide: entry.perSide,
    defaultSets: 3,
    defaultReps: entry.kind === 'reps' ? entry.rangeMin : null,
    defaultRepsMax: entry.kind === 'reps' ? entry.rangeMax : null,
    defaultSeconds: entry.kind === 'time' ? entry.rangeMin : null,
    defaultSecondsMax: entry.kind === 'time' ? entry.rangeMax : null,
    defaultRestSeconds: entry.defaultRestSeconds,
    imageAsset: entry.slug,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: entry.ladderKey,
    ladderStep: entry.ladderStep,
    progressionKind: entry.ladderKey ? 'variant' : 'none',
    timeCapSeconds: null,
  };
}

type SwapTarget = { sessionIndex: number; exerciseIndex: number };

export function PlanWizardResult({
  plan,
  equipment,
  hasActiveUnits,
  saving,
  onReplaceExercise,
  onRemoveExercise,
  onSave,
  onEditAnswers,
}: PlanWizardResultProps) {
  const { t, i18n } = useTranslation();
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const busy = saving != null;
  const hasExercises = plan.sessions.some((session) => session.exercises.length > 0);

  function targetLabel(exercise: BuiltPlanExercise): string {
    return formatExerciseTarget({
      sets: exercise.sets,
      kind: exercise.kind,
      reps: exercise.kind === 'time' ? null : exercise.targetMin,
      repsMax: exercise.kind === 'time' ? null : exercise.targetMax,
      seconds: exercise.kind === 'time' ? exercise.targetMin : null,
      secondsMax: exercise.kind === 'time' ? exercise.targetMax : null,
      perSide: exercise.perSide,
      perSideLabel: exercise.perSide ? t('training.timer.perSide') : null,
    });
  }

  const swapSession = swapTarget ? plan.sessions[swapTarget.sessionIndex] : undefined;
  const swapChoices =
    swapTarget && swapSession ? swapOptions(swapSession, swapTarget.exerciseIndex, equipment) : [];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('planWizard.result.title')}</Text>
      <Text style={styles.subtitle}>
        {plan.sessionsPerWeek != null
          ? t('planWizard.result.subtitleFull', {
              days: plan.sessionsPerWeek,
              count: plan.sessions.length,
            })
          : t('planWizard.result.subtitleSingle')}
      </Text>

      {plan.notes.includes('pull_alternative') ? (
        <View style={styles.note}>
          <Ionicons name="bulb-outline" size={18} color={BRAND_INDIGO} />
          <Text style={styles.noteText}>{t('planWizard.result.pullAlternative')}</Text>
        </View>
      ) : null}

      {plan.sessions.map((session, sessionIndex) => (
        <GlassCard
          key={`${session.kind}-${sessionIndex}`}
          testID={`planWizard.session.${session.kind}`}
          style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View
              style={[
                styles.dot,
                { backgroundColor: TRAINING_UNIT_COLORS[session.color] ?? BRAND_INDIGO },
              ]}
            />
            <Text style={styles.sessionName}>{t(session.nameKey)}</Text>
          </View>
          <Text style={styles.sessionMeta}>
            {t('planWizard.result.sessionMeta', {
              count: session.exercises.length,
              minutes: session.estimatedMinutes,
            })}
          </Text>

          {session.exercises.length === 0 ? (
            <Text style={styles.sessionMeta}>{t('planWizard.result.emptySession')}</Text>
          ) : null}

          {session.exercises.map((exercise, exerciseIndex) => {
            const entry = getPlanCatalogEntry(exercise.slug);
            if (!entry) {
              return null;
            }
            return (
              <View key={exercise.slug} style={styles.exerciseRow}>
                <ExerciseThumb exercise={previewExercise(entry)} size="sm" />
                <View style={styles.exerciseText}>
                  <Text style={styles.exerciseName}>{planCatalogName(entry, i18n.language)}</Text>
                  <Text style={styles.exerciseMeta}>
                    {targetLabel(exercise)} ·{' '}
                    {t('planWizard.result.rest', { seconds: exercise.restSeconds })}
                  </Text>
                </View>
                <Pressable
                  testID={`planWizard.swap.${sessionIndex}.${exercise.slug}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('planWizard.result.swap')}
                  disabled={busy}
                  hitSlop={6}
                  onPress={() => setSwapTarget({ sessionIndex, exerciseIndex })}
                  style={styles.iconBtn}>
                  <Ionicons name="swap-horizontal" size={20} color={BRAND_INDIGO} />
                </Pressable>
                <Pressable
                  testID={`planWizard.remove.${sessionIndex}.${exercise.slug}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('planWizard.result.remove')}
                  disabled={busy}
                  hitSlop={6}
                  onPress={() => onRemoveExercise(sessionIndex, exerciseIndex)}
                  style={styles.iconBtn}>
                  <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
                </Pressable>
              </View>
            );
          })}
        </GlassCard>
      ))}

      <View style={styles.actions}>
        {hasActiveUnits ? (
          <>
            <PrimaryButton
              testID="planWizard.add"
              label={t('planWizard.result.add')}
              loading={saving === 'add'}
              disabled={busy || !hasExercises}
              onPress={() => onSave('add')}
            />
            <Pressable
              testID="planWizard.replace"
              accessibilityRole="button"
              disabled={busy || !hasExercises}
              onPress={() => onSave('replace')}
              style={[styles.secondaryBtn, (busy || !hasExercises) && styles.disabled]}>
              {saving === 'replace' ? (
                <ActivityIndicator color={BRAND_INDIGO} />
              ) : (
                <Text style={styles.secondaryText}>{t('planWizard.result.replace')}</Text>
              )}
            </Pressable>
          </>
        ) : (
          <PrimaryButton
            testID="planWizard.save"
            label={t('planWizard.result.save')}
            loading={saving === 'add'}
            disabled={busy || !hasExercises}
            onPress={() => onSave('add')}
          />
        )}
        <Pressable
          testID="planWizard.editAnswers"
          accessibilityRole="button"
          disabled={busy}
          onPress={onEditAnswers}
          style={styles.linkWrap}>
          <Text style={styles.link}>{t('planWizard.result.editAnswers')}</Text>
        </Pressable>
      </View>

      <GlassBottomSheet
        visible={swapTarget != null}
        onClose={() => setSwapTarget(null)}
        maxHeightRatio={0.8}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('planWizard.result.swapTitle')}</Text>
          {swapChoices.map((entry) => (
            <Pressable
              key={entry.slug}
              testID={`planWizard.swapOption.${entry.slug}`}
              accessibilityRole="button"
              onPress={() => {
                if (swapTarget) {
                  onReplaceExercise(swapTarget.sessionIndex, swapTarget.exerciseIndex, entry.slug);
                }
                setSwapTarget(null);
              }}
              style={({ pressed }) => [styles.swapRow, pressed && styles.pressed]}>
              <ExerciseThumb exercise={previewExercise(entry)} size="sm" onPressEnabled={false} />
              <Text style={styles.exerciseName}>{planCatalogName(entry, i18n.language)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </GlassBottomSheet>
    </View>
  );
}

function PrimaryButton({
  testID,
  label,
  loading,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={disabled && !loading ? styles.disabled : undefined}>
      <LinearGradient
        colors={['#4F46E5', '#7CE7C7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGradient}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryText}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: TEXT_SECONDARY,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#1E1B4B',
  },
  sessionCard: {
    padding: 14,
    gap: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  sessionMeta: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  exerciseMeta: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  iconBtn: {
    padding: 6,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryGradient: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  secondaryText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  linkWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  link: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 15,
  },
  sheet: {
    gap: 10,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
    marginBottom: 4,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
