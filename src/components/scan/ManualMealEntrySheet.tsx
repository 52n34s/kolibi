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
  isRowItemValid,
  rowItemsToEditable,
  sumRowItemsKcal,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { MealItemsSheetBody, MEAL_SHEET_MAX_HEIGHT_RATIO } from '@/components/scan/MealItemsSheetBody';
import { mealEntrySheetStyles as styles } from '@/components/scan/meal-entry-shared';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
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
  const scrollRef = useRef<ScrollView>(null);
  const [rowItems, setRowItems] = useState<MealItemRowItem[]>([createEmptyRowItem()]);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

  useEffect(() => {
    if (visible) {
      setRowItems([createEmptyRowItem()]);
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

  function handleAddProduct() {
    setRowItems((current) => [...current, createEmptyRowItem()]);
    setShouldScrollToEnd(true);
  }

  function handleRemoveProduct(id: string) {
    setRowItems((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((item) => item.id !== id);
    });
  }

  function handleSavePress() {
    if (!canSave) {
      return;
    }

    onSave(rowItemsToEditable(rowItems));
  }

  return (
    <GlassBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={MEAL_SHEET_MAX_HEIGHT_RATIO}>
      <MealItemsSheetBody
        scrollRef={scrollRef}
        header={
          <>
            <Text style={styles.title}>{t('home.manualEntry.title')}</Text>
            <Text style={styles.totalKcal}>{totalKcal}</Text>
            <Text style={styles.totalLabel}>{t('home.manualEntry.totalKcal')}</Text>
          </>
        }
        footer={
          <>
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
          </>
        }>
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
            onRemove={rowItems.length > 1 ? handleRemoveProduct : undefined}
          />
        ))}
      </MealItemsSheetBody>
    </GlassBottomSheet>
  );
}
