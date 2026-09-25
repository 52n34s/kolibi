import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { previewExercise } from '@/components/training/PlanWizardResult';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY, TRAINING_UNIT_COLORS } from '@/constants/brand';
import { useOwnWorkoutTemplates } from '@/hooks/use-own-workout-templates';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import { applyBuiltPlan } from '@/lib/workouts/apply-built-plan';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import { kolibiTemplateCards, singleSessionPlan, type KolibiTemplateCard } from '@/lib/workouts/kolibi-templates';
import { getPlanCatalogEntry, planCatalogName } from '@/lib/workouts/plan-catalog';
import type { Exercise, UnitColorKey, WorkoutTemplate } from '@/lib/workouts/types';
import {
  createUnitFromTemplate,
  removeTemplate,
  renameTemplate,
  type UnitTemplateBackend,
} from '@/lib/workouts/unit-templates';
import {
  archiveTemplate,
  restoreTemplate,
  saveTemplate,
  setTemplateFlag,
} from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';

const backend: UnitTemplateBackend = {
  saveTemplate,
  setTemplateFlag,
  archiveTemplate,
  restoreTemplate,
};

/** One preview row: exercise, thumb and target, whatever the template source. */
type PreviewRow = {
  key: string;
  exercise: Exercise | null;
  name: string;
  target: string;
};

type Preview = {
  title: string;
  color: UnitColorKey;
  rows: PreviewRow[];
  create: () => Promise<string>;
};

type TemplatesSectionProps = {
  /** Active units, to append a new unit at the end. */
  unitCount: number;
  archived: WorkoutTemplate[];
  restoringId: string | null;
  onRestore: (templateId: string) => void;
};

/**
 * "Vorlagen" in the plan screen: Kolibi templates (built with the plan wizard
 * rules), own templates (hidden until the template migration ran) and the
 * archived units with "Wiederherstellen".
 */
export function TemplatesSection({ unitCount, archived, restoringId, onRestore }: TemplatesSectionProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const requirePlan = useRequirePlan();
  const own = useOwnWorkoutTemplates();
  const kolibiCards = useMemo(() => kolibiTemplateCards(), []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  function perSideLabel(perSide: boolean) {
    return perSide ? t('training.timer.perSide') : null;
  }

  function kolibiPreview(card: KolibiTemplateCard): Preview {
    return {
      title: t(card.session.nameKey),
      color: card.session.color,
      rows: card.session.exercises.map((exercise, index) => {
        const entry = getPlanCatalogEntry(exercise.slug);
        return {
          key: `${exercise.slug}-${index}`,
          exercise: entry ? previewExercise(entry) : null,
          name: entry ? planCatalogName(entry, i18n.language) : exercise.slug,
          target: formatExerciseTarget({
            sets: exercise.sets,
            kind: exercise.kind,
            reps: exercise.kind === 'time' ? null : exercise.targetMin,
            repsMax: exercise.kind === 'time' ? null : exercise.targetMax,
            seconds: exercise.kind === 'time' ? exercise.targetMin : null,
            secondsMax: exercise.kind === 'time' ? exercise.targetMax : null,
            perSide: exercise.perSide,
            perSideLabel: perSideLabel(exercise.perSide),
          }),
        };
      }),
      create: async () => {
        if (!userId) {
          throw new Error('not_authenticated');
        }
        await applyBuiltPlan(singleSessionPlan(card.session), {
          userId,
          queryClient,
          mode: 'add',
        });
        return t(card.session.nameKey);
      },
    };
  }

  function ownPreview(template: WorkoutTemplate): Preview {
    return {
      title: template.name,
      color: template.colorKey,
      rows: [...template.exercises]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          key: item.id,
          exercise: item.exercise,
          name: resolveExerciseName(item.exercise, i18n.language),
          target: formatExerciseTarget({
            sets: item.targetSets,
            kind: item.exercise.kind,
            reps: item.targetReps,
            repsMax: item.targetRepsMax,
            seconds: item.targetSeconds,
            secondsMax: item.targetSecondsMax,
            perSide: item.exercise.perSide,
            perSideLabel: perSideLabel(item.exercise.perSide),
          }),
        })),
      create: async () => {
        await createUnitFromTemplate(backend, template, unitCount);
        return template.name;
      },
    };
  }

  async function refresh() {
    if (userId) {
      await invalidateTrainingQueries(queryClient, userId);
    }
  }

  async function createFromPreview() {
    if (!preview || busy || !(await requirePlan('editPlan'))) {
      return;
    }
    setBusy(true);
    try {
      const name = await preview.create();
      await refresh();
      setPreview(null);
      Alert.alert(t('templates.title'), t('templates.created', { name }));
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('templates.failed'));
    } finally {
      setBusy(false);
    }
  }

  function promptRename(template: WorkoutTemplate) {
    Alert.prompt(
      t('templates.rename'),
      t('templates.renamePrompt'),
      [
        { text: t('templates.cancel'), style: 'cancel' },
        {
          text: t('templates.save'),
          onPress: (value?: string) => {
            const name = (value ?? '').trim().slice(0, 20);
            if (!name || name === template.name) {
              return;
            }
            void (async () => {
              try {
                await renameTemplate(backend, template, name);
                await refresh();
              } catch (error) {
                Sentry.captureException(error);
                Alert.alert(t('settings.errors.title'), t('templates.failed'));
              }
            })();
          },
        },
      ],
      'plain-text',
      template.name,
    );
  }

  function confirmDelete(template: WorkoutTemplate) {
    Alert.alert(t('templates.deleteTitle'), t('templates.deleteBody'), [
      { text: t('templates.cancel'), style: 'cancel' },
      {
        text: t('templates.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeTemplate(backend, template);
              await refresh();
            } catch (error) {
              Sentry.captureException(error);
              Alert.alert(t('settings.errors.title'), t('templates.failed'));
            }
          })();
        },
      },
    ]);
  }

  const ownTemplates = own.data ?? [];

  return (
    <View style={styles.block} testID="training.plan.templates">
      <Text style={styles.title}>{t('templates.title')}</Text>

      <Text style={styles.sectionTitle}>{t('templates.kolibi')}</Text>
      <View style={styles.list}>
        {kolibiCards.map((card) => (
          <TemplateCard
            key={card.key}
            testID={`templates.kolibi.${card.key}`}
            color={card.session.color}
            title={t(card.session.nameKey)}
            subtitle={t(card.preset.titleKey)}
            meta={t('templates.exercises', {
              count: card.session.exercises.length,
              minutes: card.session.estimatedMinutes,
            })}
            onPress={() => setPreview(kolibiPreview(card))}
          />
        ))}
      </View>

      {own.available ? (
        <>
          <Text style={styles.sectionTitle}>{t('templates.mine')}</Text>
          {ownTemplates.length === 0 ? (
            <Text style={styles.hint}>{t('templates.mineEmpty')}</Text>
          ) : (
            <View style={styles.list}>
              {ownTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  testID={`templates.mine.${template.shortLabel}`}
                  color={template.colorKey}
                  title={template.name}
                  meta={t('templates.exercisesOnly', { count: template.exercises.length })}
                  onPress={() => setPreview(ownPreview(template))}
                  actions={
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('templates.rename')}
                        onPress={() => promptRename(template)}
                        style={styles.iconBtn}>
                        <Ionicons name="pencil-outline" size={18} color={BRAND_INDIGO} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('templates.delete')}
                        onPress={() => confirmDelete(template)}
                        style={styles.iconBtn}>
                        <Ionicons name="trash-outline" size={18} color={BRAND_INDIGO} />
                      </Pressable>
                    </View>
                  }
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      {archived.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('templates.previous')}</Text>
          <View style={styles.list}>
            {archived.map((template) => (
              <TemplateCard
                key={template.id}
                testID={`training.plan.archived.${template.shortLabel}`}
                color={template.colorKey}
                title={template.name}
                meta={t('training.plan.archivedMeta', { count: template.exercises.length })}
                muted
                actions={
                  <Pressable
                    testID={`training.plan.archived.${template.shortLabel}.restore`}
                    accessibilityRole="button"
                    disabled={restoringId != null}
                    onPress={() => onRestore(template.id)}
                    style={styles.restoreBtn}>
                    {restoringId === template.id ? (
                      <ActivityIndicator color={BRAND_INDIGO} />
                    ) : (
                      <Text style={styles.restoreText}>{t('templates.restore')}</Text>
                    )}
                  </Pressable>
                }
              />
            ))}
          </View>
        </>
      ) : null}

      <GlassBottomSheet
        visible={preview != null}
        onClose={() => setPreview(null)}
        maxHeightRatio={0.88}>
        {preview ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View
                style={[styles.dot, { backgroundColor: TRAINING_UNIT_COLORS[preview.color] ?? BRAND_INDIGO }]}
              />
              <Text style={styles.sheetTitle}>{preview.title}</Text>
            </View>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {preview.rows.map((row) => (
                <View key={row.key} style={styles.row}>
                  {row.exercise ? <ExerciseThumb exercise={row.exercise} size="sm" /> : null}
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {row.name}
                    </Text>
                    <Text style={styles.rowTarget}>{row.target}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable
              testID="templates.createUnit"
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void createFromPreview()}
              style={[styles.primary, busy && styles.disabled]}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>{t('templates.createUnit')}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </GlassBottomSheet>
    </View>
  );
}

function TemplateCard({
  testID,
  color,
  title,
  subtitle,
  meta,
  muted = false,
  onPress,
  actions,
}: {
  testID: string;
  color: UnitColorKey;
  title: string;
  subtitle?: string;
  meta: string;
  muted?: boolean;
  onPress?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <GlassCard testID={testID} style={muted ? { ...styles.card, ...styles.cardMuted } : styles.card}>
      <Pressable
        accessibilityRole="button"
        disabled={!onPress}
        onPress={onPress}
        style={styles.cardMain}>
        <View style={styles.cardHeader}>
          <View style={[styles.dot, { backgroundColor: TRAINING_UNIT_COLORS[color] ?? BRAND_INDIGO }]} />
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
        <Text style={styles.meta}>{meta}</Text>
      </Pressable>
      {actions}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  hint: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardMuted: {
    opacity: 0.85,
  },
  cardMain: {
    flex: 1,
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },
  restoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.08)',
    minWidth: 44,
    alignItems: 'center',
  },
  restoreText: {
    color: BRAND_INDIGO,
    fontSize: 14,
    fontWeight: '600',
  },
  sheet: {
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sheetList: {
    maxHeight: 420,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  rowTarget: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  primary: {
    height: 48,
    borderRadius: 14,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});
