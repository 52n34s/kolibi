import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  createEmptyMealItemDraft,
  createEntryId,
  draftToInput,
  formatDraftNumber,
  MealItemEntryCard,
  mealEntrySheetStyles as styles,
  SHEET_MAX_HEIGHT_RATIO,
  sumDraftKcal,
  useGrowableMealEntrySheetLayout,
  type MealItemDraft,
} from '@/components/scan/meal-entry-shared';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import {
  fetchMealItemsForEdit,
  isManualMealEntryValid,
  type MealItemEditInput,
  type MealItemForEdit,
} from '@/lib/meals';

type MealEditSheetProps = {
  visible: boolean;
  mealId: string | null;
  userId: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (params: {
    mealId: string;
    items: MealItemEditInput[];
    removedMealItemIds: string[];
  }) => void;
};

function mealItemToDraft(item: MealItemForEdit): MealItemDraft {
  if (item.quantity_type === 'count') {
    return {
      id: createEntryId(),
      mealItemId: item.id,
      wasAiGenerated: item.was_ai_generated,
      name: item.name,
      unit: 'count',
      amountText: formatDraftNumber(item.count ?? 0),
      gramsPerUnitText: formatDraftNumber(item.grams_per_unit ?? 0),
      kcalText: formatDraftNumber(item.kcal),
    };
  }

  return {
    id: createEntryId(),
    mealItemId: item.id,
    wasAiGenerated: item.was_ai_generated,
    name: item.name,
    unit: 'grams',
    amountText: formatDraftNumber(item.quantity_grams),
    gramsPerUnitText: '',
    kcalText: formatDraftNumber(item.kcal),
  };
}

export function MealEditSheet({
  visible,
  mealId,
  userId,
  isSaving,
  onClose,
  onSave,
}: MealEditSheetProps) {
  const { t } = useTranslation();
  const { scrollMaxHeight } = useGrowableMealEntrySheetLayout();
  const scrollRef = useRef<ScrollView>(null);
  const [drafts, setDrafts] = useState<MealItemDraft[]>([]);
  const [initialMealItemIds, setInitialMealItemIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

  useEffect(() => {
    if (!visible || !mealId || !userId) {
      return;
    }

    let cancelled = false;

    async function loadMealItems() {
      setIsLoading(true);
      setLoadError(false);

      try {
        const items = await fetchMealItemsForEdit(mealId, userId);
        if (cancelled) {
          return;
        }

        setDrafts(items.map(mealItemToDraft));
        setInitialMealItemIds(items.map((item) => item.id));
      } catch (error) {
        console.error('[MealEditSheet] failed to load meal items:', error);
        if (!cancelled) {
          setLoadError(true);
          setDrafts([]);
          setInitialMealItemIds([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMealItems();

    return () => {
      cancelled = true;
    };
  }, [visible, mealId, userId]);

  useEffect(() => {
    if (!visible) {
      setDrafts([]);
      setInitialMealItemIds([]);
      setLoadError(false);
      setShouldScrollToEnd(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!shouldScrollToEnd) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      setShouldScrollToEnd(false);
    });
  }, [drafts.length, shouldScrollToEnd]);

  const totalKcal = useMemo(() => sumDraftKcal(drafts), [drafts]);

  const canSave = useMemo(() => {
    if (drafts.length === 0 || isLoading || loadError) {
      return false;
    }

    return drafts.every((draft) => isManualMealEntryValid(draftToInput(draft)));
  }, [drafts, isLoading, loadError]);

  function updateDraft(id: string, updates: Partial<MealItemDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft)),
    );
  }

  function handleAddProduct() {
    setDrafts((current) => [...current, createEmptyMealItemDraft()]);
    setShouldScrollToEnd(true);
  }

  function handleRemoveProduct(id: string) {
    setDrafts((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((draft) => draft.id !== id);
    });
  }

  function handleSavePress() {
    if (!canSave || !mealId) {
      return;
    }

    const remainingMealItemIds = new Set(
      drafts.map((draft) => draft.mealItemId).filter((id): id is string => id != null),
    );
    const removedMealItemIds = initialMealItemIds.filter((id) => !remainingMealItemIds.has(id));

    const items: MealItemEditInput[] = drafts.map((draft) => ({
      ...draftToInput(draft),
      mealItemId: draft.mealItemId,
      wasAiGenerated: draft.wasAiGenerated,
    }));

    onSave({
      mealId,
      items,
      removedMealItemIds,
    });
  }

  return (
    <GlassBottomSheet visible={visible} onClose={onClose} maxHeightRatio={SHEET_MAX_HEIGHT_RATIO}>
      <View style={styles.sheetBody}>
        <Text style={styles.title}>{t('home.mealEdit.title')}</Text>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#4F46E5" />
            <Text style={styles.loadingLabel}>{t('home.mealEdit.loading')}</Text>
          </View>
        ) : loadError ? (
          <View style={styles.loadingState}>
            <Text style={styles.loadingLabel}>{t('home.mealEdit.loadError')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.totalKcal}>{totalKcal}</Text>
            <Text style={styles.totalLabel}>{t('home.manualEntry.totalKcal')}</Text>

            <ScrollView
              ref={scrollRef}
              style={[styles.list, { maxHeight: scrollMaxHeight }]}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              {drafts.map((draft) => (
                <MealItemEntryCard
                  key={draft.id}
                  canRemove={drafts.length > 1}
                  draft={draft}
                  onAmountChange={(value) => updateDraft(draft.id, { amountText: value })}
                  onGramsPerUnitChange={(value) =>
                    updateDraft(draft.id, { gramsPerUnitText: value })
                  }
                  onKcalChange={(value) => updateDraft(draft.id, { kcalText: value })}
                  onNameChange={(value) => updateDraft(draft.id, { name: value })}
                  onRemove={() => handleRemoveProduct(draft.id)}
                  onUnitChange={(unit) =>
                    updateDraft(draft.id, {
                      unit,
                      gramsPerUnitText: unit === 'count' ? draft.gramsPerUnitText : '',
                    })
                  }
                />
              ))}
            </ScrollView>

            {!canSave ? (
              <Text style={styles.saveHint}>{t('home.manualEntry.validationFixRows')}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.manualEntry.addProduct')}
              style={styles.addButton}
              onPress={handleAddProduct}>
              <Ionicons name="add-circle-outline" size={18} color="#4F46E5" />
              <Text style={styles.addButtonLabel}>{t('home.manualEntry.addProduct')}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.mealEdit.save')}
              disabled={isSaving || !canSave}
              style={[styles.saveShell, (isSaving || !canSave) && styles.saveDisabled]}
              onPress={handleSavePress}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveLabel}>{t('home.mealEdit.save')}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>
    </GlassBottomSheet>
  );
}
