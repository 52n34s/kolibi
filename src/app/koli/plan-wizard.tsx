import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Href, Stack, router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
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

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { PlanWizardResult } from '@/components/training/PlanWizardResult';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, CHIP_SURFACE_SELECTED, TEXT_SECONDARY } from '@/constants/brand';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { applyBuiltPlan, type ApplyBuiltPlanMode } from '@/lib/workouts/apply-built-plan';
import {
  ASSESSMENT_LEVELS,
  PLAN_CARDIO,
  PLAN_DAYS,
  PLAN_FOCUSES,
  PLAN_GOALS,
  PLAN_MINUTES,
  PLAN_SCOPES,
  buildPlan,
  removePlanExercise,
  replacePlanExercise,
  type BuiltPlan,
  type PlanAssessment,
  type PlanWizardAnswers,
} from '@/lib/workouts/plan-builder';
import { PLAN_EQUIPMENT, type PlanEquipment } from '@/lib/workouts/plan-catalog';
import { loadPlanWizardAnswers, savePlanWizardAnswers } from '@/lib/workouts/plan-wizard-storage';
import { useAuthStore } from '@/stores/auth-store';

const STEPS = [
  'goal',
  'days',
  'minutes',
  'equipment',
  'assessment',
  'focus',
  'cardio',
  'scope',
] as const;

type Step = (typeof STEPS)[number];

const ASSESSMENT_AREAS: readonly (keyof PlanAssessment)[] = ['push', 'pull', 'legs'];

/**
 * Plan wizard (Block 2.3): one question per step, then an editable preview
 * saved as normal units. Open from anywhere via /koli/plan-wizard; callers
 * check useRequirePlan('editPlan') first, saving checks it again.
 */
export default function PlanWizardScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const requirePlan = useRequirePlan();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const templatesQuery = useWorkoutTemplates();
  const hasActiveUnits = (templatesQuery.data ?? []).length > 0;

  const [answers, setAnswers] = useState<PlanWizardAnswers | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [plan, setPlan] = useState<BuiltPlan | null>(null);
  const [saving, setSaving] = useState<ApplyBuiltPlanMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPlanWizardAnswers(userId).then((loaded) => {
      if (!cancelled) {
        setAnswers((current) => current ?? loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const step: Step = STEPS[stepIndex]!;

  function showResult(next: PlanWizardAnswers) {
    setPlan(buildPlan(next));
    void savePlanWizardAnswers(userId, next);
  }

  function advance(next: PlanWizardAnswers) {
    setAnswers(next);
    if (stepIndex >= STEPS.length - 1) {
      showResult(next);
      return;
    }
    setStepIndex(stepIndex + 1);
  }

  function goBack() {
    if (saving) {
      return;
    }
    if (plan) {
      setPlan(null);
      return;
    }
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home' as Href);
    }
  }

  async function persist(mode: ApplyBuiltPlanMode) {
    if (!plan || !userId) {
      return;
    }
    setSaving(mode);
    try {
      await applyBuiltPlan(plan, { userId, queryClient, mode });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/home' as Href);
      }
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('planWizard.result.saveFailed'));
    } finally {
      setSaving(null);
    }
  }

  async function handleSave(mode: ApplyBuiltPlanMode) {
    if (saving || !(await requirePlan('editPlan'))) {
      return;
    }
    if (mode !== 'replace') {
      void persist(mode);
      return;
    }
    Alert.alert(
      t('planWizard.result.replaceConfirmTitle'),
      t('planWizard.result.replaceConfirmBody'),
      [
        { text: t('planWizard.result.cancel'), style: 'cancel' },
        {
          text: t('planWizard.result.replaceConfirm'),
          style: 'destructive',
          onPress: () => void persist('replace'),
        },
      ],
    );
  }

  function renderStep(current: PlanWizardAnswers): ReactNode {
    switch (step) {
      case 'goal':
        return (
          <Question title={t('planWizard.steps.goal.title')}>
            {PLAN_GOALS.map((goal) => (
              <OptionRow
                key={goal}
                testID={`planWizard.goal.${goal}`}
                label={t(`planWizard.steps.goal.options.${goal}`)}
                selected={current.goal === goal}
                onPress={() => advance({ ...current, goal })}
              />
            ))}
          </Question>
        );
      case 'days':
        return (
          <Question title={t('planWizard.steps.days.title')}>
            {PLAN_DAYS.map((days) => (
              <OptionRow
                key={days}
                testID={`planWizard.days.${days}`}
                label={t('planWizard.steps.days.option', { count: days })}
                selected={current.days === days}
                onPress={() => advance({ ...current, days })}
              />
            ))}
          </Question>
        );
      case 'minutes':
        return (
          <Question title={t('planWizard.steps.minutes.title')}>
            {PLAN_MINUTES.map((minutes) => (
              <OptionRow
                key={minutes}
                testID={`planWizard.minutes.${minutes}`}
                label={
                  minutes === 75
                    ? t('planWizard.steps.minutes.optionMax')
                    : t('planWizard.steps.minutes.option', { count: minutes })
                }
                selected={current.minutes === minutes}
                onPress={() => advance({ ...current, minutes })}
              />
            ))}
          </Question>
        );
      case 'equipment': {
        const toggle = (item: PlanEquipment) => {
          const equipment = current.equipment.includes(item)
            ? current.equipment.filter((entry) => entry !== item)
            : PLAN_EQUIPMENT.filter((entry) => entry === item || current.equipment.includes(entry));
          setAnswers({ ...current, equipment });
        };
        return (
          <Question
            title={t('planWizard.steps.equipment.title')}
            hint={t('planWizard.steps.equipment.hint')}>
            <OptionRow
              testID="planWizard.equipment.none"
              label={t('planWizard.steps.equipment.options.none')}
              selected={current.equipment.length === 0}
              multi
              onPress={() => setAnswers({ ...current, equipment: [] })}
            />
            {PLAN_EQUIPMENT.map((item) => (
              <OptionRow
                key={item}
                testID={`planWizard.equipment.${item}`}
                label={t(`planWizard.steps.equipment.options.${item}`)}
                selected={current.equipment.includes(item)}
                multi
                onPress={() => toggle(item)}
              />
            ))}
            <NextButton label={t('planWizard.next')} onPress={() => advance(current)} />
          </Question>
        );
      }
      case 'assessment':
        return (
          <Question
            title={t('planWizard.steps.assessment.title')}
            hint={t('planWizard.steps.assessment.hint')}>
            {ASSESSMENT_AREAS.map((area) => (
              <View key={area} style={styles.assessmentBlock}>
                <Text style={styles.assessmentQuestion}>
                  {t(`planWizard.steps.assessment.${area}.question`)}
                </Text>
                <View style={styles.chips}>
                  {ASSESSMENT_LEVELS.map((level) => {
                    const selected = current.assessment[area] === level;
                    return (
                      <Pressable
                        key={level}
                        testID={`planWizard.assessment.${area}.${level}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() =>
                          setAnswers({
                            ...current,
                            assessment: { ...current.assessment, [area]: level },
                          })
                        }
                        style={[styles.chip, selected && styles.chipSelected]}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {t(`planWizard.steps.assessment.${area}.l${level}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <NextButton label={t('planWizard.next')} onPress={() => advance(current)} />
          </Question>
        );
      case 'focus':
        return (
          <Question title={t('planWizard.steps.focus.title')}>
            {PLAN_FOCUSES.map((focus) => (
              <OptionRow
                key={focus}
                testID={`planWizard.focus.${focus}`}
                label={t(`planWizard.steps.focus.options.${focus}`)}
                selected={current.focus === focus}
                onPress={() => advance({ ...current, focus })}
              />
            ))}
          </Question>
        );
      case 'cardio':
        return (
          <Question
            title={t('planWizard.steps.cardio.title')}
            hint={t('planWizard.steps.cardio.hint')}>
            {PLAN_CARDIO.map((cardio) => (
              <OptionRow
                key={cardio}
                testID={`planWizard.cardio.${cardio}`}
                label={t(`planWizard.steps.cardio.options.${cardio}`)}
                selected={current.cardio === cardio}
                onPress={() => advance({ ...current, cardio })}
              />
            ))}
          </Question>
        );
      case 'scope':
        return (
          <Question title={t('planWizard.steps.scope.title')}>
            {PLAN_SCOPES.map((scope) => (
              <OptionRow
                key={scope}
                testID={`planWizard.scope.${scope}`}
                label={t(`planWizard.steps.scope.options.${scope}`)}
                hint={t(`planWizard.steps.scope.hints.${scope}`)}
                selected={current.scope === scope}
                onPress={() => advance({ ...current, scope })}
              />
            ))}
          </Question>
        );
    }
  }

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={[styles.topBar, { paddingTop: contentTopPadding }]}>
        <Pressable
          testID="planWizard.back"
          accessibilityRole="button"
          accessibilityLabel={t('planWizard.back')}
          hitSlop={8}
          onPress={goBack}
          style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={BRAND_INDIGO} />
        </Pressable>
        {!plan && answers ? (
          <Text style={styles.stepCounter}>
            {t('planWizard.stepCounter', { current: stepIndex + 1, total: STEPS.length })}
          </Text>
        ) : null}
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        {!answers ? (
          <ActivityIndicator size="large" color={BRAND_INDIGO} />
        ) : plan ? (
          <PlanWizardResult
            plan={plan}
            equipment={answers.equipment}
            hasActiveUnits={hasActiveUnits}
            saving={saving}
            onReplaceExercise={(sessionIndex, exerciseIndex, slug) =>
              setPlan(replacePlanExercise(plan, sessionIndex, exerciseIndex, slug, answers.goal))
            }
            onRemoveExercise={(sessionIndex, exerciseIndex) =>
              setPlan(removePlanExercise(plan, sessionIndex, exerciseIndex))
            }
            onSave={(mode) => void handleSave(mode)}
            onEditAnswers={() => {
              setPlan(null);
              setStepIndex(0);
            }}
          />
        ) : (
          <>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((stepIndex + 1) / STEPS.length) * 100}%` },
                ]}
              />
            </View>
            {renderStep(answers)}
          </>
        )}
      </ScrollView>
    </HomeLayout>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionTitle}>{title}</Text>
      {hint ? <Text style={styles.questionHint}>{hint}</Text> : null}
      <View style={styles.options}>{children}</View>
    </View>
  );
}

function OptionRow({
  testID,
  label,
  hint,
  selected,
  multi = false,
  onPress,
}: {
  testID: string;
  label: string;
  hint?: string;
  selected: boolean;
  multi?: boolean;
  onPress: () => void;
}) {
  const icon = multi
    ? selected
      ? 'checkbox'
      : 'square-outline'
    : selected
      ? 'radio-button-on'
      : 'radio-button-off';
  return (
    <Pressable
      testID={testID}
      accessibilityRole={multi ? 'checkbox' : 'button'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <GlassCard style={StyleSheet.flatten([styles.option, selected && styles.optionSelected])}>
        <Ionicons name={icon} size={22} color={BRAND_INDIGO} />
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>{label}</Text>
          {hint ? <Text style={styles.optionHint}>{hint}</Text> : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

function NextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      testID="planWizard.next"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.nextBtn}>
      <Text style={styles.nextText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND_INDIGO,
  },
  question: {
    gap: 8,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  questionHint: {
    fontSize: 15,
    lineHeight: 21,
    color: TEXT_SECONDARY,
  },
  options: {
    gap: 10,
    marginTop: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionSelected: {
    backgroundColor: CHIP_SURFACE_SELECTED,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  optionHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  assessmentBlock: {
    gap: 8,
    marginBottom: 8,
  },
  assessmentQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  chipSelected: {
    backgroundColor: BRAND_INDIGO,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  nextBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 12,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
