import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY, TRAINING_UNIT_COLORS } from '@/constants/brand';
import { applyStarterPlan, fetchStarterCatalogBySlugs } from '@/lib/workouts/apply-starter-plan';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import {
  STARTER_PLANS,
  collectStarterPlanSlugs,
  estimateStarterSessionMinutes,
  type StarterPlan,
} from '@/lib/workouts/starter-plans';
import type { StarterCatalogExercise } from '@/lib/workouts/apply-starter-plan';
import { useAuthStore } from '@/stores/auth-store';

type StarterPlanPickerProps = {
  onCustom: () => void;
  /** Called after a package was applied successfully (templates already invalidated). */
  onApplied?: () => void;
};

export function StarterPlanPicker({ onCustom, onApplied }: StarterPlanPickerProps) {
  const requirePlan = useRequirePlan();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [previewPlan, setPreviewPlan] = useState<StarterPlan | null>(null);
  const [catalogBySlug, setCatalogBySlug] = useState<Map<string, StarterCatalogExercise> | null>(
    null,
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);

  const openPreview = useCallback(
    async (plan: StarterPlan) => {
      setPreviewPlan(plan);
      setLoadingPreview(true);
      setCatalogBySlug(null);
      try {
        const catalog = await fetchStarterCatalogBySlugs(collectStarterPlanSlugs(plan));
        setCatalogBySlug(catalog);
      } catch (error) {
        Sentry.captureException(error);
        setPreviewPlan(null);
        Alert.alert(t('settings.errors.title'), t('training.starterPlans.previewFailed'));
      } finally {
        setLoadingPreview(false);
      }
    },
    [t],
  );

  async function handleApply() {
    if (!(await requirePlan('editPlan'))) {
      return;
    }
    if (!previewPlan || !userId || applying) {
      return;
    }
    setApplying(true);
    try {
      await applyStarterPlan(previewPlan.id, { userId, queryClient });
      setPreviewPlan(null);
      onApplied?.();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.starterPlans.applyFailed'));
    } finally {
      setApplying(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('training.starterPlans.chooseTitle')}</Text>
      <Text style={styles.intro}>{t('training.starterPlans.chooseIntro')}</Text>

      <View style={styles.cards}>
        {STARTER_PLANS.map((plan) => (
          <Pressable
            key={plan.id}
            testID={`training.starter.${plan.id}`}
            accessibilityRole="button"
            onPress={() => void openPreview(plan)}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>{t(plan.titleKey)}</Text>
              <Text style={styles.cardSubtitle}>{t(plan.subtitleKey)}</Text>
              <View style={styles.labels}>
                {plan.sessions.map((session) => (
                  <View
                    key={session.shortLabel}
                    style={[
                      styles.labelChip,
                      {
                        backgroundColor:
                          TRAINING_UNIT_COLORS[session.color] ?? BRAND_INDIGO,
                      },
                    ]}>
                    <Text style={styles.labelChipText}>{session.shortLabel}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.cardMeta}>
                {plan.sessions
                  .map((session) =>
                    t('training.starterPlans.sessionMeta', {
                      label: session.shortLabel,
                      exercises: session.exercises.length,
                      minutes: estimateStarterSessionMinutes(session),
                    }),
                  )
                  .join(' · ')}
              </Text>
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <Pressable
        testID="training.starter.custom"
        accessibilityRole="button"
        onPress={onCustom}
        style={styles.customWrap}>
        <Text style={styles.customText}>{t('training.starterPlans.custom.title')}</Text>
        <Text style={styles.customHint}>{t('training.starterPlans.custom.subtitle')}</Text>
      </Pressable>

      <GlassBottomSheet
        visible={previewPlan != null}
        onClose={() => {
          if (!applying) {
            setPreviewPlan(null);
          }
        }}
        maxHeightRatio={0.88}>
        {previewPlan ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.previewScroll}>
            <Text style={styles.previewTitle}>{t(previewPlan.titleKey)}</Text>
            <Text style={styles.previewEquipment}>{t(previewPlan.equipmentKey)}</Text>

            {loadingPreview ? (
              <ActivityIndicator color={BRAND_INDIGO} style={{ marginVertical: 24 }} />
            ) : (
              previewPlan.sessions.map((session) => (
                <View key={session.shortLabel} style={styles.previewSession}>
                  <View style={styles.previewSessionHeader}>
                    <View
                      style={[
                        styles.previewDot,
                        {
                          backgroundColor:
                            TRAINING_UNIT_COLORS[session.color] ?? BRAND_INDIGO,
                        },
                      ]}
                    />
                    <Text style={styles.previewSessionName}>{t(session.nameKey)}</Text>
                  </View>
                  {session.exercises.map((exercise) => {
                    const catalog = catalogBySlug?.get(exercise.slug);
                    const kind = catalog?.kind ?? 'reps';
                    const name = catalog
                      ? resolveExerciseName({ names: catalog.names }, i18n.language) ||
                        exercise.slug
                      : exercise.slug;
                    const target = formatExerciseTarget({
                      sets: exercise.sets,
                      kind,
                      reps: kind === 'time' ? null : exercise.targetMin,
                      repsMax: kind === 'time' ? null : exercise.targetMax,
                      seconds: kind === 'time' ? exercise.targetMin : null,
                      secondsMax: kind === 'time' ? exercise.targetMax : null,
                      perSide: catalog?.perSide,
                      perSideLabel: catalog?.perSide
                        ? t('training.timer.perSide')
                        : null,
                    });
                    return (
                      <View key={exercise.slug} style={styles.previewExercise}>
                        <Text style={styles.previewExerciseName}>{name}</Text>
                        <Text style={styles.previewExerciseTarget}>{target}</Text>
                      </View>
                    );
                  })}
                </View>
              ))
            )}

            <Pressable
              testID="training.starter.apply"
              accessibilityRole="button"
              disabled={applying || loadingPreview}
              onPress={() => void handleApply()}
              style={[styles.applyPressable, (applying || loadingPreview) && { opacity: 0.6 }]}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.applyGradient}>
                {applying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.applyText}>{t('training.starterPlans.apply')}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </ScrollView>
        ) : null}
      </GlassBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  cards: {
    gap: 12,
  },
  card: {
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  cardSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  labels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  labelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cardMeta: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  customWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  customText: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 15,
  },
  customHint: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  previewScroll: {
    gap: 14,
    paddingBottom: 8,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  previewEquipment: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 4,
  },
  previewSession: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(79, 70, 229, 0.15)',
  },
  previewSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewSessionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  previewExercise: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 18,
  },
  previewExerciseName: {
    flex: 1,
    fontSize: 14,
    color: '#1E1B4B',
  },
  previewExerciseTarget: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  applyPressable: {
    marginTop: 8,
  },
  applyGradient: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
