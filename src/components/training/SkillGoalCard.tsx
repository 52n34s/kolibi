import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShareStickerSheet } from '@/components/share/ShareStickerSheet';
import { SkillGoalSheet } from '@/components/training/SkillGoalSheet';
import {
  formatSkillGoalCurrent,
  formatSkillGoalStatus,
  formatSkillGoalTarget,
} from '@/components/training/skill-goal-text';
import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY } from '@/constants/brand';
import { useSkillGoal } from '@/hooks/use-skill-goal';
import { buildGoalSticker, type StickerData } from '@/lib/share/sticker-data';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';

type SkillGoalCardProps = {
  testID?: string;
  /** Wraps the content; the caller supplies the card look of its screen. */
  renderContainer: (children: ReactNode) => ReactElement;
};

/**
 * Compact skill goal: exercise, target, current value, bar and the expected
 * period (or an honest hint). Nothing renders until the migration has run.
 */
export function SkillGoalCard({ testID = 'skillGoal.card', renderContainer }: SkillGoalCardProps) {
  const { t, i18n } = useTranslation();
  const { available, goal, exercise, forecast, exercises, recentExerciseIds } = useSkillGoal();
  const [editing, setEditing] = useState(false);
  const [sticker, setSticker] = useState<StickerData | null>(null);

  const currentOtherName = useMemo(() => {
    const current = forecast?.current;
    if (!current || !goal || current.exerciseId === goal.exerciseId) {
      return null;
    }
    const row = exercises.find((ex) => ex.id === current.exerciseId);
    return row ? resolveExerciseName(row, i18n.language) : null;
  }, [exercises, forecast?.current, goal, i18n.language]);

  if (!available) {
    return null;
  }

  const sheet = (
    <SkillGoalSheet
      visible={editing}
      onClose={() => setEditing(false)}
      goal={goal}
      exercises={exercises}
      recentExerciseIds={recentExerciseIds}
    />
  );

  if (!goal || !exercise || !forecast) {
    return (
      <>
        {renderContainer(
          <Pressable
            testID={`${testID}.set`}
            accessibilityRole="button"
            onPress={() => setEditing(true)}
            style={styles.emptyRow}>
            <Ionicons name="flag-outline" size={20} color={BRAND_INDIGO} />
            <View style={styles.flex}>
              <Text style={styles.cta}>{t('skillGoal.setCta')}</Text>
              <Text style={styles.muted}>{t('skillGoal.setHint')}</Text>
            </View>
          </Pressable>,
        )}
        {sheet}
      </>
    );
  }

  const percent = Math.round(forecast.progress * 100);
  const current = forecast.current;
  const currentKind = current
    ? (exercises.find((ex) => ex.id === current.exerciseId)?.kind ?? exercise.kind)
    : exercise.kind;
  const achieved = forecast.status === 'achieved';

  return (
    <>
      {renderContainer(
        <View testID={testID} style={styles.body}>
          <View style={styles.header}>
            <Text style={styles.label}>{t('skillGoal.title')}</Text>
            <View style={styles.actions}>
              <Pressable
                testID={`${testID}.share`}
                accessibilityRole="button"
                accessibilityLabel={t('skillGoal.share')}
                hitSlop={8}
                onPress={() =>
                  setSticker(
                    buildGoalSticker({
                      goal,
                      forecast,
                      exercises,
                      lang: i18n.language,
                    }),
                  )
                }
                style={styles.iconBtn}>
                <Ionicons name="share-outline" size={16} color={BRAND_INDIGO} />
              </Pressable>
              <Pressable
                testID={`${testID}.edit`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setEditing(true)}>
                <Text style={styles.link}>{t('skillGoal.edit')}</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {resolveExerciseName(exercise, i18n.language)}
          </Text>
          <Text style={styles.muted} numberOfLines={2}>
            {formatSkillGoalTarget(goal.targetValue, exercise.kind, t)}
            {current && !achieved
              ? ` · ${formatSkillGoalCurrent(current.value, currentKind, currentOtherName, t)}`
              : ''}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t('skillGoal.progressA11y', { percent })}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(percent, 2)}%` },
                achieved && { backgroundColor: BRAND_MINT },
              ]}
            />
          </View>
          <Text style={styles.status}>{formatSkillGoalStatus(forecast, t, i18n.language)}</Text>
        </View>,
      )}
      {sheet}
      <ShareStickerSheet data={sticker} onClose={() => setSticker(null)} allowStory />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cta: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_INDIGO,
  },
  body: {
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79,70,229,0.1)',
  },
  link: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 14,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  muted: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  track: {
    marginTop: 4,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(79,70,229,0.12)',
  },
  fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_INDIGO,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E1B4B',
  },
});
