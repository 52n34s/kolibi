import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';
import { BRAND_INDIGO, TEXT_SECONDARY, TEXT_TERTIARY } from '@/constants/brand';
import { useExercises } from '@/hooks/use-exercises';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import type { ActiveSession, Exercise } from '@/lib/workouts/types';

type TrainingOverviewSheetProps = {
  session: ActiveSession;
  visible: boolean;
  onClose: () => void;
  onJump: (exerciseIndex: number, setIndex: number) => void;
  onSkip: (exerciseIndex: number) => void;
  onMoveUp: (exerciseIndex: number) => void;
  onMoveDown: (exerciseIndex: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number) => void;
  onAddExercise: (exercise: Exercise) => void;
};

export function TrainingOverviewSheet({
  session,
  visible,
  onClose,
  onJump,
  onSkip,
  onMoveUp,
  onMoveDown,
  onAddSet,
  onRemoveSet,
  onAddExercise,
}: TrainingOverviewSheetProps) {
  const { t, i18n } = useTranslation();
  const [adding, setAdding] = useState(false);
  // Only one exercise shows its actions at a time — the row list stays scannable.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const exercisesQuery = useExercises(visible && adding);
  const catalog = exercisesQuery.data ?? [];

  useEffect(() => {
    if (!visible) {
      setExpandedIndex(null);
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(i18n.language);
    if (!q) {
      return catalog;
    }
    return catalog.filter((ex) =>
      resolveExerciseName(ex, i18n.language).toLocaleLowerCase(i18n.language).includes(q),
    );
  }, [catalog, i18n.language, query]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        testID="training.overview.backdrop"
        accessibilityRole="button"
        style={styles.dimmer}
        onPress={onClose}
      />
      <View style={styles.sheetWrap}>
        <GlassSheetSurface maxHeight={560} tintOpacity={0.52} blurIntensity={64}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('training.panel.overviewTitle')}</Text>
            <Pressable
              testID="training.overview.closeButton"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}>
              <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
            </Pressable>
          </View>

          {adding ? (
            <View style={styles.addBlock}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('training.panel.searchExercise')}
                placeholderTextColor={TEXT_TERTIARY}
                style={styles.search}
                autoFocus
              />
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.addRow}
                    onPress={() => {
                      onAddExercise(item);
                      setAdding(false);
                      setQuery('');
                      onClose();
                    }}>
                    <Text style={styles.addRowText}>
                      {resolveExerciseName(item, i18n.language)}
                    </Text>
                  </Pressable>
                )}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setAdding(false);
                  setQuery('');
                }}
                style={styles.linkBtn}>
                <Text style={styles.linkText}>{t('training.panel.overviewClose')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <FlatList
                data={session.items}
                keyExtractor={(_, index) => String(index)}
                style={styles.list}
                renderItem={({ item, index }) => {
                  const doneCount = item.sets.filter((s) => s.done).length;
                  const status =
                    doneCount === item.sets.length
                      ? t('training.panel.statusDone')
                      : doneCount > 0
                        ? t('training.panel.statusPartial', {
                            done: doneCount,
                            total: item.sets.length,
                          })
                        : t('training.panel.statusOpen');

                  const expanded = expandedIndex === index;

                  return (
                    <View style={styles.row}>
                      <View style={styles.rowTop}>
                        <Pressable
                          testID={`training.overview.exercise.${index}.jump`}
                          accessibilityRole="button"
                          style={styles.rowMain}
                          onPress={() => {
                            onJump(index, 0);
                            onClose();
                          }}>
                          <Text style={styles.rowName}>{item.name}</Text>
                          <Text style={styles.rowStatus}>{status}</Text>
                        </Pressable>
                        <Pressable
                          testID={`training.overview.exercise.${index}.more`}
                          accessibilityRole="button"
                          accessibilityLabel={t('training.panel.moreActions')}
                          accessibilityState={{ expanded }}
                          hitSlop={8}
                          onPress={() =>
                            setExpandedIndex((prev) => (prev === index ? null : index))
                          }
                          style={styles.iconBtn}>
                          <Ionicons
                            name={expanded ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal'}
                            size={20}
                            color={expanded ? BRAND_INDIGO : TEXT_SECONDARY}
                          />
                        </Pressable>
                      </View>

                      {expanded ? (
                        <View style={styles.rowActions}>
                          <Pressable
                            testID={`training.overview.exercise.${index}.up`}
                            accessibilityRole="button"
                            disabled={index === 0}
                            onPress={() => onMoveUp(index)}
                            style={styles.iconBtn}>
                            <Ionicons
                              name="chevron-up"
                              size={18}
                              color={index === 0 ? TEXT_TERTIARY : BRAND_INDIGO}
                            />
                          </Pressable>
                          <Pressable
                            testID={`training.overview.exercise.${index}.down`}
                            accessibilityRole="button"
                            disabled={index >= session.items.length - 1}
                            onPress={() => onMoveDown(index)}
                            style={styles.iconBtn}>
                            <Ionicons
                              name="chevron-down"
                              size={18}
                              color={
                                index >= session.items.length - 1 ? TEXT_TERTIARY : BRAND_INDIGO
                              }
                            />
                          </Pressable>
                          <Pressable
                            testID={`training.overview.exercise.${index}.skip`}
                            accessibilityRole="button"
                            onPress={() => {
                              onSkip(index);
                              onClose();
                            }}
                            style={styles.chip}>
                            <Text style={styles.chipText}>{t('training.panel.skip')}</Text>
                          </Pressable>
                          <Pressable
                            testID={`training.overview.exercise.${index}.addSet`}
                            accessibilityRole="button"
                            onPress={() => onAddSet(index)}
                            style={styles.chip}>
                            <Text style={styles.chipText}>{t('training.panel.addSet')}</Text>
                          </Pressable>
                          <Pressable
                            testID={`training.overview.exercise.${index}.removeSet`}
                            accessibilityRole="button"
                            onPress={() => onRemoveSet(index)}
                            style={styles.chip}>
                            <Text style={styles.chipText}>{t('training.panel.removeSet')}</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                }}
              />
              <Pressable
                testID="training.overview.addExercise"
                accessibilityRole="button"
                onPress={() => setAdding(true)}
                style={styles.addExerciseBtn}>
                <Text style={styles.addExerciseText}>{t('training.panel.addExercise')}</Text>
              </Pressable>
            </>
          )}
        </GlassSheetSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    justifyContent: 'flex-end',
  },
  dimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  sheetWrap: {
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_INDIGO,
  },
  list: {
    maxHeight: 360,
    paddingHorizontal: 16,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(79, 70, 229, 0.12)',
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  rowStatus: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  addExerciseBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    alignItems: 'center',
  },
  addExerciseText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
  },
  addBlock: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  search: {
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E1B4B',
  },
  addRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(79, 70, 229, 0.1)',
  },
  addRowText: {
    fontSize: 16,
    color: '#1E1B4B',
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkText: {
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
});
