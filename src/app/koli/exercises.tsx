import { Ionicons } from '@expo/vector-icons';
import { Href, Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ExerciseThumb } from '@/components/training/ExerciseThumb';
import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import {
  BRAND_INDIGO,
  CHIP_BORDER,
  CHIP_SURFACE_SELECTED,
  TEXT_SECONDARY,
} from '@/constants/brand';
import { useExercises } from '@/hooks/use-exercises';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import type { Exercise } from '@/lib/workouts/types';
import { useExercisePickStore } from '@/stores/exercise-pick-store';

type FilterKey = 'all' | 'own' | 'catalog';

function itemTestId(exercise: Exercise): string {
  return `training.catalog.item.${exercise.catalogSlug ?? exercise.id}`;
}

export default function ExercisesCatalogScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const params = useLocalSearchParams<{ select?: string }>();
  const selectMode = params.select === '1' || params.select === 'true';

  const { data: exercises = [], isLoading, isError } = useExercises();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const selectedIds = useExercisePickStore((s) => s.selectedIds);
  const toggleId = useExercisePickStore((s) => s.toggleId);
  const clearSelection = useExercisePickStore((s) => s.clear);

  useEffect(() => {
    if (selectMode) {
      clearSelection();
    }
  }, [selectMode, clearSelection]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(i18n.language);
    return exercises.filter((exercise) => {
      if (filter === 'own' && exercise.userId == null) {
        return false;
      }
      if (filter === 'catalog' && exercise.userId != null) {
        return false;
      }
      if (!q) {
        return true;
      }
      return resolveExerciseName(exercise, i18n.language)
        .toLocaleLowerCase(i18n.language)
        .includes(q);
    });
  }, [exercises, filter, i18n.language, query]);

  const ladderTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const exercise of exercises) {
      if (exercise.ladderKey && exercise.userId == null) {
        map.set(exercise.ladderKey, (map.get(exercise.ladderKey) ?? 0) + 1);
      }
    }
    return map;
  }, [exercises]);

  function handlePress(exercise: Exercise) {
    if (selectMode) {
      toggleId(exercise.id);
      return;
    }

    const isOwn = exercise.userId != null;
    if (isOwn) {
      router.push(`/koli/exercise-edit?id=${encodeURIComponent(exercise.id)}` as Href);
      return;
    }
    router.push(
      `/koli/exercise-edit?id=${encodeURIComponent(exercise.id)}&readonly=1` as Href,
    );
  }

  function handleDoneSelect() {
    // Selection stays in the store until the previous screen calls consumeSelection().
    router.back();
  }

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <View style={styles.headerRow}>
          <SettingsBackButton label={t('training.catalog.back')} />
          {!selectMode ? (
            <Pressable
              testID="training.catalog.add"
              accessibilityRole="button"
              accessibilityLabel={t('training.catalog.add')}
              hitSlop={8}
              onPress={() => router.push('/koli/exercise-edit' as Href)}
              style={styles.addBtn}>
              <Ionicons name="add" size={26} color={BRAND_INDIGO} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="flex-1 px-6">
        <Text className="mb-2 text-2xl font-bold text-gray-900">
          {selectMode ? t('training.catalog.selectTitle') : t('training.catalog.title')}
        </Text>

        <OnboardingField
          testID="training.catalog.search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('training.catalog.searchPlaceholder')}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={styles.search}
        />

        <View style={styles.filters}>
          {(
            [
              ['all', 'training.catalog.filterAll'],
              ['own', 'training.catalog.filterOwn'],
              ['catalog', 'training.catalog.filterCatalog'],
            ] as const
          ).map(([key, labelKey]) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                testID={`training.catalog.filter.${key}`}
                accessibilityRole="button"
                onPress={() => setFilter(key)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isError ? (
          <Text className="mt-6 text-center text-base text-gray-600">
            {t('training.catalog.loadFailed')}
          </Text>
        ) : isLoading ? (
          <View className="mt-10 items-center">
            <ActivityIndicator size="large" color={BRAND_INDIGO} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text className="mt-8 text-center text-base text-gray-500">
                {t('training.catalog.empty')}
              </Text>
            }
            renderItem={({ item }) => {
              const name = resolveExerciseName(item, i18n.language);
              const target = formatExerciseTarget({
                sets: item.defaultSets,
                kind: item.kind,
                reps: item.defaultReps,
                repsMax: item.defaultRepsMax,
                seconds: item.defaultSeconds,
                secondsMax: item.defaultSecondsMax,
                perSide: item.perSide,
                perSideLabel: item.perSide ? t('training.timer.perSide') : null,
              });
              const selected = selectedIds.includes(item.id);

              return (
                <Pressable
                  testID={itemTestId(item)}
                  accessibilityRole="button"
                  onPress={() => handlePress(item)}
                  style={[styles.row, selected && styles.rowSelected]}>
                  <ExerciseThumb exercise={item} size="md" onPressEnabled={false} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.ladderKey && item.ladderStep != null
                        ? `${t('training.progression.catalogLevel', {
                            step: item.ladderStep,
                            total: ladderTotals.get(item.ladderKey) ?? item.ladderStep,
                          })} · ${target}`
                        : target}
                    </Text>
                  </View>
                  {selectMode ? (
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? BRAND_INDIGO : TEXT_SECONDARY}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {selectMode ? (
        <View className="px-6 pb-8">
          <Pressable
            testID="training.catalog.confirmSelection"
            accessibilityRole="button"
            disabled={selectedIds.length === 0}
            onPress={handleDoneSelect}
            style={[styles.confirm, selectedIds.length === 0 && styles.confirmDisabled]}>
            <Text style={styles.confirmText}>
              {t('training.catalog.confirmSelection', { count: selectedIds.length })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </HomeLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    padding: 4,
  },
  search: {
    marginBottom: 12,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  chipActive: {
    backgroundColor: CHIP_SURFACE_SELECTED,
    borderColor: BRAND_INDIGO,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  chipTextActive: {
    color: BRAND_INDIGO,
  },
  list: {
    paddingBottom: 24,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  rowSelected: {
    backgroundColor: CHIP_SURFACE_SELECTED,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  meta: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  confirm: {
    height: 48,
    borderRadius: 12,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
