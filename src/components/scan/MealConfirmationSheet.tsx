import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';

import { MealItemRow } from '@/components/scan/MealItemRow';
import {
  changeRowItemKcal,
  changeRowItemName,
  changeRowItemQuantity,
  changeRowItemUnit,
  createEmptyRowItem,
  createRowItemId,
  editableToRowItem,
  isRowItemValid,
  rowItemsToEditable,
  sumRowItemsKcal,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { mealEntrySheetStyles as styles } from '@/components/scan/meal-entry-shared';
import { MealItemsSheetBody, MEAL_SHEET_MAX_HEIGHT_RATIO } from '@/components/scan/MealItemsSheetBody';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import {
  createManualEditableItem,
  visionItemToEditable,
  type EditableMealItem,
  type VisionFoodItem,
} from '@/services/mealVision/types';

type MealConfirmationSheetProps = {
  visible: boolean;
  items: VisionFoodItem[];
  isSaving: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  onSave: (items: EditableMealItem[]) => void;
};

function createItemId(): string {
  return createRowItemId();
}

export function MealConfirmationSheet({
  visible,
  items,
  isSaving,
  onClose,
  onDismissed,
  onSave,
}: MealConfirmationSheetProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [rowItems, setRowItems] = useState<MealItemRowItem[]>([]);
  const [editableById, setEditableById] = useState<Map<string, EditableMealItem>>(new Map());
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

  useEffect(() => {
    if (visible) {
      const editables = items.map((item) => visionItemToEditable(item, createItemId()));
      setRowItems(editables.map((item) => editableToRowItem(item)));
      setEditableById(new Map(editables.map((item) => [item.id, item])));
      setShouldScrollToEnd(false);
    }
  }, [items, visible]);

  useEffect(() => {
    if (!shouldScrollToEnd) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      setShouldScrollToEnd(false);
    });
  }, [rowItems.length, shouldScrollToEnd]);

  const totalKcal = useMemo(() => sumRowItemsKcal(rowItems), [rowItems]);

  const canSave = useMemo(
    () => rowItems.length > 0 && rowItems.every((item) => isRowItemValid(item)),
    [rowItems],
  );

  function updateRowItem(id: string, updater: (item: MealItemRowItem) => MealItemRowItem) {
    setRowItems((current) =>
      current.map((item) => (item.id === id ? updater(item) : item)),
    );
  }

  function removeIngredient(itemId: string) {
    setRowItems((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((item) => item.id !== itemId);
    });
    setEditableById((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
  }

  function handleAddIngredient() {
    const id = createItemId();
    const editable = createManualEditableItem({ id, name: '', quantityGrams: 0, kcal: 0 });
    setRowItems((current) => [...current, editableToRowItem(editable)]);
    setEditableById((current) => new Map(current).set(id, editable));
    setShouldScrollToEnd(true);
  }

  function handleSavePress() {
    if (!canSave) {
      return;
    }

    onSave(rowItemsToEditable(rowItems, editableById));
  }

  const sheetIssue =
    rowItems.length === 0 ? 'noIngredients' : !canSave ? 'fixRows' : null;

  return (
    <GlassBottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      maxHeightRatio={MEAL_SHEET_MAX_HEIGHT_RATIO}>
      <MealItemsSheetBody
        scrollRef={scrollRef}
        header={
          <>
            <Text style={styles.title}>{t('home.scan.confirmation.title')}</Text>
            <Text style={styles.totalKcal}>{totalKcal}</Text>
            <Text style={styles.totalLabel}>{t('home.scan.confirmation.totalKcal')}</Text>
          </>
        }
        footer={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.scan.confirmation.addIngredient')}
              style={styles.addButton}
              onPress={handleAddIngredient}>
              <Ionicons name="add-circle-outline" size={18} color="#4F46E5" />
              <Text style={styles.addButtonLabel}>{t('home.scan.confirmation.addIngredient')}</Text>
            </Pressable>

            {sheetIssue != null ? (
              <Text style={styles.saveHint}>
                {sheetIssue === 'noIngredients'
                  ? t('home.scan.confirmation.validationNoIngredients')
                  : t('home.scan.confirmation.validationFixRows')}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.scan.confirmation.save')}
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
                  <Text style={styles.saveLabel}>{t('home.scan.confirmation.save')}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </>
        }>
        {rowItems.length === 0 ? (
          <Text style={styles.saveHint}>{t('home.scan.confirmation.validationNoIngredients')}</Text>
        ) : null}
        {rowItems.map((item) => (
          <MealItemRow
            key={item.id}
            invalid={!isRowItemValid(item)}
            item={item}
            onChangeKcal={(id, value) => updateRowItem(id, (row) => changeRowItemKcal(row, value))}
            onChangeName={(id, name) => updateRowItem(id, (row) => changeRowItemName(row, name))}
            onChangeQuantity={(id, value) =>
              updateRowItem(id, (row) => changeRowItemQuantity(row, value))
            }
            onChangeUnit={(id, unit) => updateRowItem(id, (row) => changeRowItemUnit(row, unit))}
            onRemove={rowItems.length > 1 ? removeIngredient : undefined}
          />
        ))}
      </MealItemsSheetBody>
    </GlassBottomSheet>
  );
}
