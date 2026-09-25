import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { suggestedGoalExerciseIds } from '@/lib/workouts/skill-goal-forecast';
import {
  archiveActiveSkillGoal,
  saveSkillGoal,
  type SkillGoal,
} from '@/lib/workouts/skill-goals-api';
import type { Exercise } from '@/lib/workouts/types';
import { useAuthStore } from '@/stores/auth-store';

const MAX_TARGET = 10000;

type SkillGoalSheetProps = {
  visible: boolean;
  onClose: () => void;
  goal: SkillGoal | null;
  exercises: Exercise[];
  recentExerciseIds: string[];
};

export function SkillGoalSheet({
  visible,
  onClose,
  goal,
  exercises,
  recentExerciseIds,
}: SkillGoalSheetProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const current = goal ? (exercises.find((row) => row.id === goal.exerciseId) ?? null) : null;
    setPicked(current);
    setDraft(goal ? String(goal.targetValue) : '');
    setQuery('');
    setError(null);
    // Only when the sheet opens: later list refreshes keep the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const nameOf = (exercise: Exercise) => resolveExerciseName(exercise, i18n.language);

  const suggested = useMemo(() => {
    const byId = new Map(exercises.map((row) => [row.id, row]));
    return suggestedGoalExerciseIds(recentExerciseIds, exercises)
      .map((id) => byId.get(id))
      .filter((row): row is Exercise => row != null);
  }, [exercises, recentExerciseIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(i18n.language);
    return exercises
      .filter((row) => !q || nameOf(row).toLocaleLowerCase(i18n.language).includes(q))
      .slice()
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b), i18n.language));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, i18n.language, query]);

  async function refresh() {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: workoutQueryKeys.skillGoal(userId) });
    }
  }

  async function handleSave() {
    if (!picked || busy) {
      return;
    }
    const value = Number(draft.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value < 1 || value > MAX_TARGET) {
      setError(t('skillGoal.sheet.invalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveSkillGoal({ exerciseId: picked.id, targetValue: Math.round(value) });
      await refresh();
      onClose();
    } catch (saveError) {
      Sentry.captureException(saveError);
      setError(t('skillGoal.sheet.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await archiveActiveSkillGoal();
      await refresh();
      onClose();
    } catch (removeError) {
      Sentry.captureException(removeError);
      setError(t('skillGoal.sheet.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  function row(exercise: Exercise, keyPrefix: string) {
    return (
      <Pressable
        key={`${keyPrefix}-${exercise.id}`}
        testID={`skillGoal.pick.${exercise.catalogSlug ?? exercise.id}`}
        accessibilityRole="button"
        onPress={() => {
          setPicked(exercise);
          if (!goal || goal.exerciseId !== exercise.id) {
            setDraft('');
          }
        }}
        style={styles.row}>
        <Text style={styles.rowName} numberOfLines={1}>
          {nameOf(exercise)}
        </Text>
      </Pressable>
    );
  }

  return (
    <GlassBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.88} numberInputAccessory>
      {picked == null ? (
        <View style={styles.body}>
          <Text style={styles.title}>{t('skillGoal.sheet.pickTitle')}</Text>
          <OnboardingField
            testID="skillGoal.search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('skillGoal.sheet.searchPlaceholder')}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {query.trim().length === 0 && suggested.length > 0 ? (
              <>
                <Text style={styles.section}>{t('skillGoal.sheet.suggested')}</Text>
                {suggested.map((exercise) => row(exercise, 'suggested'))}
                <Text style={styles.section}>{t('skillGoal.sheet.all')}</Text>
              </>
            ) : null}
            {filtered.map((exercise) => row(exercise, 'all'))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.title}>{t('skillGoal.sheet.targetTitle')}</Text>
          <Text style={styles.pickedName}>{nameOf(picked)}</Text>
          <Text style={styles.label}>
            {picked.kind === 'time'
              ? t('skillGoal.sheet.targetLabelSeconds')
              : t('skillGoal.sheet.targetLabelReps')}
          </Text>
          <OnboardingField
            testID="skillGoal.target"
            keyboardType="number-pad"
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            placeholder={picked.kind === 'time' ? '30' : '10'}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            testID="skillGoal.save"
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void handleSave()}
            style={[styles.primary, busy && styles.disabled]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>{t('skillGoal.sheet.save')}</Text>
            )}
          </Pressable>
          <View style={styles.links}>
            <Pressable accessibilityRole="button" onPress={() => setPicked(null)} hitSlop={8}>
              <Text style={styles.link}>{t('skillGoal.sheet.otherExercise')}</Text>
            </Pressable>
            {goal ? (
              <Pressable
                testID="skillGoal.remove"
                accessibilityRole="button"
                onPress={() => void handleRemove()}
                hitSlop={8}>
                <Text style={styles.linkMuted}>{t('skillGoal.sheet.remove')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  list: {
    maxHeight: 380,
  },
  section: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  rowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E1B4B',
  },
  pickedName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  label: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  error: {
    fontSize: 14,
    color: '#B42318',
  },
  primary: {
    height: 48,
    borderRadius: 12,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  link: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 15,
  },
  linkMuted: {
    color: TEXT_SECONDARY,
    fontWeight: '600',
    fontSize: 15,
  },
});
