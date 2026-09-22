import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import type { ProgressionSuggestion } from '@/lib/workouts/progression';
import { isDescentKind } from '@/lib/workouts/progression-ui';
import type { Exercise } from '@/lib/workouts/types';

type ProgressionSuggestionCardProps = {
  exerciseIndex: number;
  name: string;
  toName?: string | null;
  exercise: Exercise;
  suggestion: ProgressionSuggestion;
  decision: 'accept' | 'later' | null;
  onAccept: () => void;
  onLater: () => void;
};

function targetLabel(
  exercise: Exercise,
  target: ProgressionSuggestion['toTarget'],
  perSideLabel: string | null,
): string {
  return formatExerciseTarget({
    sets: target.targetSets,
    kind: exercise.kind,
    reps: target.targetReps,
    repsMax: target.targetRepsMax,
    seconds: target.targetSeconds,
    secondsMax: target.targetSecondsMax,
    perSide: exercise.perSide,
    perSideLabel,
  });
}

export function ProgressionSuggestionCard({
  exerciseIndex,
  name,
  toName,
  exercise,
  suggestion,
  decision,
  onAccept,
  onLater,
}: ProgressionSuggestionCardProps) {
  const { t } = useTranslation();
  const descent = isDescentKind(suggestion.kind);
  const perSideLabel = exercise.perSide ? t('training.timer.perSide') : null;
  const fromLabel = targetLabel(exercise, suggestion.fromTarget, perSideLabel);
  const toLabel = targetLabel(exercise, suggestion.toTarget, perSideLabel);
  const reason = t(suggestion.reasonKey, suggestion.reasonParams);

  const headline = descent
    ? t('training.progression.descentLine', {
        name: toName ?? name,
        target: toLabel,
      })
    : suggestion.kind === 'variant_up' && toName
      ? t('training.progression.ascentLine', {
          name,
          from: fromLabel,
          to: `${toName}, ${toLabel}`,
        })
      : t('training.progression.ascentLine', {
          name,
          from: fromLabel,
          to: toLabel,
        });

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.change}>{headline}</Text>
      <Text style={styles.reason}>{reason}</Text>
      <View style={styles.actions}>
        <Pressable
          testID={`training.progression.${exerciseIndex}.accept`}
          accessibilityRole="button"
          onPress={onAccept}
          style={[styles.btn, styles.accept, decision === 'accept' && styles.btnOn]}>
          <Text style={[styles.btnText, decision === 'accept' && styles.btnTextOn]}>
            {t('training.progression.accept')}
          </Text>
        </Pressable>
        <Pressable
          testID={`training.progression.${exerciseIndex}.later`}
          accessibilityRole="button"
          onPress={onLater}
          style={[styles.btn, styles.later, decision === 'later' && styles.btnOn]}>
          <Text style={[styles.btnText, decision === 'later' && styles.btnTextOn]}>
            {t('training.progression.later')}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  change: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  reason: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.25)',
  },
  accept: {
    backgroundColor: 'rgba(124, 231, 199, 0.35)',
  },
  later: {
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
  },
  btnOn: {
    borderColor: BRAND_INDIGO,
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
  },
  btnText: {
    fontWeight: '700',
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  btnTextOn: {
    color: BRAND_INDIGO,
  },
});
