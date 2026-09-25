import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  IdleProgressionOverlay,
  useDeferredProgressions,
} from '@/components/training/IdleProgressionOverlay';
import {
  PlanWizardEntryCard,
  useOpenPlanWizard,
} from '@/components/training/PlanWizardEntryCard';
import { RestTimerCard } from '@/components/training/RestTimerCard';
import { SkillGoalCard } from '@/components/training/SkillGoalCard';
import { StarterPlanPicker } from '@/components/training/StarterPlanPicker';
import { useRequirePlan } from '@/hooks/use-require-plan';
import type { ProductAction } from '@/lib/product-access';
import {
  countTemplateExercises,
  daysSinceLoggedOn,
  estimateTemplateMinutes,
} from '@/components/training/training-panel-utils';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY, TRAINING_UNIT_COLORS } from '@/constants/brand';
import { useArchivedWorkoutTemplates } from '@/hooks/use-archived-workout-templates';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { localDateKey, shiftLocalDateKey } from '@/lib/day-window';
import { useReadiness } from '@/hooks/use-checkin';
import { pickNextTemplateForReadiness } from '@/lib/workouts/progression-readiness';
import { resolveTrainingTabEnabled } from '@/lib/workouts/training-release';
import type { WorkoutTemplate } from '@/lib/workouts/types';

type TrainingIdleViewProps = {
  onStart: (template: WorkoutTemplate) => void;
  onEditPlan?: () => void;
};

function lastLoggedOnForTemplate(
  sessions: { templateId: string | null; loggedOn: string }[],
  templateId: string,
): string | null {
  let best: string | null = null;
  for (const session of sessions) {
    if (session.templateId !== templateId) {
      continue;
    }
    if (best == null || session.loggedOn > best) {
      best = session.loggedOn;
    }
  }
  return best;
}

function openNewWorkout() {
  router.push('/koli/workout-template-edit' as Href);
}

function openPlanEditor() {
  router.push('/koli/workout-plan' as Href);
}

export function TrainingIdleView({ onStart, onEditPlan }: TrainingIdleViewProps) {
  const { t } = useTranslation();
  const requirePlan = useRequirePlan();
  // Plan edits and backfill need an active plan (AGB Ziffer 10 Abs. 5).
  const withPlan = (action: ProductAction, run: () => void) => () => {
    void requirePlan(action).then((allowed) => {
      if (allowed) {
        run();
      }
    });
  };
  const todayKey = localDateKey();
  const startKey = shiftLocalDateKey(todayKey, -90);
  const templatesQuery = useWorkoutTemplates();
  const archivedQuery = useArchivedWorkoutTemplates();
  const sessionsQuery = useWorkoutSessionsRange({ startKey, endKey: todayKey });
  const { data: trainingTabFlag = false } = useFeatureFlag('training_tab');
  const showEditPlan = Boolean(resolveTrainingTabEnabled(trainingTabFlag) && onEditPlan);
  const [showProgressionOverlay, setShowProgressionOverlay] = useState(false);
  const openPlanWizard = useOpenPlanWizard();

  const templates = templatesQuery.data ?? [];
  const archived = archivedQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  const readiness = useReadiness();
  // Without a check-in and without notable data this is plain pickNextTemplate.
  const nextPick = useMemo(
    () => pickNextTemplateForReadiness(templates, sessions, todayKey, readiness),
    [templates, sessions, todayKey, readiness],
  );
  const next = nextPick.template;

  function readinessHint(): string | null {
    if (nextPick.adjustment === 'alternative' && next && nextPick.plannedTemplate) {
      return t('checkin.next.alternative', {
        name: next.name,
        planned: nextPick.plannedTemplate.name,
      });
    }
    if (nextPick.adjustment === 'lighterUnit' && nextPick.plannedTemplate) {
      return t('checkin.next.lighterUnit', { planned: nextPick.plannedTemplate.name });
    }
    if (nextPick.adjustment === 'lighterVariant') {
      return t('checkin.next.lighterVariant');
    }
    return null;
  }
  const nextHint = readinessHint();

  const deferredProgressions = useDeferredProgressions(next);

  const others = useMemo(() => {
    if (!next) {
      return templates.slice().sort((a, b) => a.position - b.position);
    }
    return templates
      .filter((template) => template.id !== next.id)
      .sort((a, b) => a.position - b.position);
  }, [templates, next]);

  function lastLabel(templateId: string): string {
    const loggedOn = lastLoggedOnForTemplate(sessions, templateId);
    if (loggedOn == null) {
      return t('training.panel.lastNever');
    }
    const days = daysSinceLoggedOn(loggedOn, todayKey);
    if (days === 0) {
      return t('training.panel.lastToday');
    }
    if (days === 1) {
      return t('training.panel.lastYesterday');
    }
    return t('training.panel.lastDays', { count: days });
  }

  function metaLabel(template: WorkoutTemplate): string {
    return t('training.panel.meta', {
      exercises: countTemplateExercises(template),
      minutes: estimateTemplateMinutes(template),
    });
  }

  if (templates.length === 0) {
    if (archived.length > 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.empty}
          showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.archivedHintCard}>
            <Text style={styles.archivedHintTitle}>{t('training.panel.emptyArchivedTitle')}</Text>
            <Text style={styles.archivedHintBody}>{t('training.panel.emptyArchivedBody')}</Text>
            <Pressable
              testID="training.idle.openArchivedPlan"
              accessibilityRole="button"
              onPress={withPlan('editPlan', onEditPlan ?? openPlanEditor)}
              style={styles.archivedHintBtn}>
              <Text style={styles.archivedHintBtnText}>
                {t('training.panel.emptyArchivedOpenPlan')}
              </Text>
            </Pressable>
          </GlassCard>
          <PlanWizardEntryCard testID="training.idle.planWizard" />
          <RestTimerCard />
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.empty}
        showsVerticalScrollIndicator={false}>
        <PlanWizardEntryCard testID="training.idle.planWizard" />
        <StarterPlanPicker onCustom={withPlan('editPlan', openNewWorkout)} />
        <RestTimerCard />
      </ScrollView>
    );
  }

  return (
    // Scrollable so nothing at the bottom ("Einheit nachtragen", "Plan
    // bearbeiten") can become unreachable on short screens.
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.wrap}
        showsVerticalScrollIndicator={false}>
        {next ? (
          <GlassCard testID="training.next.card" style={styles.nextCard}>
            <Text style={styles.nextTitle}>{t('training.panel.nextTitle')}</Text>
            <View style={styles.nextHeader}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: TRAINING_UNIT_COLORS[next.colorKey] ?? BRAND_INDIGO },
                ]}
              />
              <Text style={styles.short}>{next.shortLabel}</Text>
            </View>
            <Text style={styles.nextName}>{next.name}</Text>
            <Text style={styles.muted}>{lastLabel(next.id)}</Text>
            <Text style={styles.muted}>{metaLabel(next)}</Text>
            {nextHint ? (
              <Text testID="training.next.readiness" style={styles.readinessHint}>
                {nextHint}
              </Text>
            ) : null}
            {deferredProgressions.length > 0 ? (
              <Pressable
                testID="training.next.progression"
                accessibilityRole="button"
                onPress={() => setShowProgressionOverlay(true)}
                style={styles.progressLine}>
                <Text style={styles.progressLineText}>
                  {t('training.progression.nextReady', {
                    count: deferredProgressions.length,
                  })}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="training.next.start"
              accessibilityRole="button"
              onPress={() => onStart(next)}
              style={styles.startPressable}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startGradient}>
                <Text style={styles.startText}>{t('training.panel.start')}</Text>
              </LinearGradient>
            </Pressable>
          </GlassCard>
        ) : null}

        <SkillGoalCard
          testID="training.skillGoal"
          renderContainer={(children) => (
            <GlassCard style={styles.goalCard}>{children}</GlassCard>
          )}
        />

        {others.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('training.panel.moreUnits')}</Text>
            {others.map((template) => (
              <GlassCard key={template.id} style={styles.compactCard}>
                <View style={styles.compactRow}>
                  <View style={styles.compactLeft}>
                    <View
                      style={[
                        styles.dotSm,
                        {
                          backgroundColor:
                            TRAINING_UNIT_COLORS[template.colorKey] ?? BRAND_INDIGO,
                        },
                      ]}
                    />
                    <View style={styles.compactText}>
                      <Text style={styles.compactName}>
                        {template.shortLabel} · {template.name}
                      </Text>
                      <Text style={styles.mutedSm}>{metaLabel(template)}</Text>
                    </View>
                  </View>
                  <Pressable
                    testID={`training.template.${template.shortLabel}.start`}
                    accessibilityRole="button"
                    onPress={() => onStart(template)}
                    style={styles.compactStart}>
                    <Text style={styles.compactStartText}>{t('training.panel.start')}</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        <RestTimerCard />

        <Pressable
          testID="training.backfill.open"
          accessibilityRole="button"
          onPress={withPlan('backfillSession', () => router.push('/koli/workout-backfill' as Href))}
          style={styles.linkWrap}>
          <Text style={styles.link}>{t('training.backfill.open')}</Text>
        </Pressable>

        {showEditPlan ? (
          <View style={styles.planActions}>
            <Pressable
              testID="training.idle.newWorkout"
              accessibilityRole="button"
              onPress={withPlan('editPlan', openNewWorkout)}
              style={styles.linkWrap}>
              <Text style={styles.link}>{t('training.panel.newWorkout')}</Text>
            </Pressable>
            <Pressable
              testID="training.idle.editPlan"
              accessibilityRole="button"
              onPress={onEditPlan ? withPlan('editPlan', onEditPlan) : undefined}
              style={styles.linkWrap}>
              <Text style={styles.link}>{t('training.panel.editPlan')}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          testID="training.idle.planWizardLink"
          accessibilityRole="button"
          onPress={openPlanWizard}
          style={styles.linkWrap}>
          <Text style={styles.link}>{t('planWizard.title')}</Text>
        </Pressable>
      </ScrollView>

      {showProgressionOverlay && next ? (
        <IdleProgressionOverlay
          template={next}
          rows={deferredProgressions}
          onClose={() => setShowProgressionOverlay(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  wrap: {
    gap: 16,
    paddingBottom: 24,
  },
  empty: {
    gap: 16,
    paddingVertical: 24,
  },
  archivedHintCard: {
    padding: 20,
    gap: 10,
  },
  archivedHintTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  archivedHintBody: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_SECONDARY,
  },
  archivedHintBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: BRAND_INDIGO,
  },
  archivedHintBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  nextCard: {
    padding: 20,
    gap: 8,
  },
  goalCard: {
    padding: 16,
  },
  nextTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  nextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotSm: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  short: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 0.4,
  },
  nextName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  muted: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  readinessHint: {
    color: BRAND_INDIGO,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  mutedSm: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  startPressable: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  progressLine: {
    marginTop: 4,
    paddingVertical: 6,
  },
  progressLineText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
    fontSize: 14,
  },
  startGradient: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 96,
    alignItems: 'center',
  },
  startText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  compactCard: {
    padding: 14,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  compactText: {
    flex: 1,
    gap: 2,
  },
  compactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  compactStart: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  compactStartText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
    fontSize: 13,
  },
  planActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkWrap: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  link: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
});
