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

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import {
  createEmptyMealItemDraft,
  draftToInput,
  MealItemEntryCard,
  mealEntrySheetStyles as styles,
  SHEET_MAX_HEIGHT_RATIO,
  sumDraftKcal,
  useGrowableMealEntrySheetLayout,
  type MealItemDraft,
} from '@/components/scan/meal-entry-shared';
import { mapManualMealEntriesToEditableItems, isManualMealEntryValid } from '@/lib/meals';
import type { EditableMealItem } from '@/services/mealVision/types';

type ManualMealEntrySheetProps = {
  visible: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (items: EditableMealItem[]) => void;
};

export function ManualMealEntrySheet({
  visible,
  isSaving,
  onClose,
  onSave,
}: ManualMealEntrySheetProps) {
  const { t } = useTranslation();
  const { scrollMaxHeight } = useGrowableMealEntrySheetLayout();
  const scrollRef = useRef<ScrollView>(null);
  const [drafts, setDrafts] = useState<MealItemDraft[]>([createEmptyMealItemDraft()]);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

  useEffect(() => {
    if (visible) {
      setDrafts([createEmptyMealItemDraft()]);
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
    if (drafts.length === 0) {
      return false;
    }

    return drafts.every((draft) => isManualMealEntryValid(draftToInput(draft)));
  }, [drafts]);

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
    if (!canSave) {
      return;
    }

    const items = mapManualMealEntriesToEditableItems(drafts.map(draftToInput));
    onSave(items);
  }

  return (
    <GlassBottomSheet visible={visible} onClose={onClose} maxHeightRatio={SHEET_MAX_HEIGHT_RATIO}>
      <View style={styles.sheetBody}>
        <Text style={styles.title}>{t('home.manualEntry.title')}</Text>

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
              onGramsPerUnitChange={(value) => updateDraft(draft.id, { gramsPerUnitText: value })}
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
          accessibilityLabel={t('home.manualEntry.save')}
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
              <Text style={styles.saveLabel}>{t('home.manualEntry.save')}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </GlassBottomSheet>
  );
}
