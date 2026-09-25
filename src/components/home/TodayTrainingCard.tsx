import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getOnboardingIdleCardStyle, ONBOARDING_CARD_RADIUS } from '@/components/onboarding/onboarding-styles';
import { useOpenPlanWizard } from '@/components/training/PlanWizardEntryCard';
import { BRAND_INDIGO, TEXT_SECONDARY, TRAINING_UNIT_COLORS } from '@/constants/brand';
import { useReadiness } from '@/hooks/use-checkin';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { localDateKey, shiftLocalDateKey } from '@/lib/day-window';
import { todayTrainingState } from '@/lib/today-layout';
import { isoWeekdayFromDateKey } from '@/lib/workouts/next-template';
import { pickNextTemplateForReadiness } from '@/lib/workouts/progression-readiness';
import type { WorkoutTemplate } from '@/lib/workouts/types';

type TodayTrainingCardProps = {
  /** Starts the unit (plan check included) and shows the training tab. */
  onStart: (template: WorkoutTemplate) => void;
  onOpenTraining: () => void;
  /** Week progress row (the existing training row with day dots). */
  children?: React.ReactNode;
};

/** Today → Training: "Als Nächstes: <Einheit> · Start", rest day or done, plus the week. */
export function TodayTrainingCard({ onStart, onOpenTraining, children }: TodayTrainingCardProps) {
  const { t } = useTranslation();
  const openPlanWizard = useOpenPlanWizard();
  const todayKey = localDateKey();
  const startKey = shiftLocalDateKey(todayKey, -90);
  const templatesQuery = useWorkoutTemplates();
  const sessionsQuery = useWorkoutSessionsRange({ startKey, endKey: todayKey });
  const readiness = useReadiness();

  const templates = templatesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const next = useMemo(
    () => pickNextTemplateForReadiness(templates, sessions, todayKey, readiness).template,
    [templates, sessions, todayKey, readiness],
  );
  const state = todayTrainingState({
    units: templates,
    sessions,
    todayKey,
    todayWeekday: isoWeekdayFromDateKey(todayKey),
  });

  if (templatesQuery.isLoading) {
    return null;
  }

  return (
    <View
      testID="today.training"
      style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
      <View style={styles.body}>
        {state === 'none' ? (
          <Pressable accessibilityRole="button" onPress={openPlanWizard} style={styles.row}>
            <Ionicons name="barbell-outline" size={20} color={BRAND_INDIGO} />
            <Text style={styles.title}>{t('today.training.createPlan')}</Text>
            <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
          </Pressable>
        ) : state === 'rest' ? (
          <Pressable accessibilityRole="button" onPress={onOpenTraining} style={styles.row}>
            <Ionicons name="leaf-outline" size={20} color={BRAND_INDIGO} />
            <View style={styles.text}>
              <Text style={styles.title}>{t('today.training.restDay')}</Text>
              <Text style={styles.meta}>{t('today.training.restDayBody')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
          </Pressable>
        ) : next && state === 'next' ? (
          <View style={styles.row}>
            <View
              style={[styles.dot, { backgroundColor: TRAINING_UNIT_COLORS[next.colorKey] ?? BRAND_INDIGO }]}
            />
            <View style={styles.text}>
              <Text style={styles.meta}>{t('today.training.next')}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {next.name}
              </Text>
            </View>
            <Pressable
              testID="today.training.start"
              accessibilityRole="button"
              onPress={() => onStart(next)}
              style={styles.start}>
              <Text style={styles.startText}>{t('today.training.start')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onOpenTraining} style={styles.row}>
            <Ionicons name="checkmark-circle-outline" size={20} color={BRAND_INDIGO} />
            <Text style={styles.title}>{t('today.training.openTraining')}</Text>
            <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
          </Pressable>
        )}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  start: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND_INDIGO,
  },
  startText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
