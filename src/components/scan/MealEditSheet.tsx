import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { MealItemRow } from '@/components/scan/MealItemRow';
import {
  changeRowItemKcal,
  changeRowItemName,
  changeRowItemQuantity,
  changeRowItemUnit,
  createEmptyRowItem,
  isRowItemValid,
  mealItemForEditToRow,
  rowItemToManualInput,
  sumRowItemsKcal,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { mealEntrySheetStyles as styles } from '@/components/scan/meal-entry-shared';
import { MealItemsSheetBody, MEAL_SHEET_MAX_HEIGHT_RATIO } from '@/components/scan/MealItemsSheetBody';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import {
  fetchMealItemsForEdit,
  type MealItemEditInput,
} from '@/lib/meals';

type MealEditSheetProps = {
  visible: boolean;
  mealId: string | null;
  userId: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onSave: (params: {
    mealId: string;
    items: MealItemEditInput[];
    removedMealItemIds: string[];
  }) => void;
  onDeleteMeal: (mealId: string) => void;
};

export function MealEditSheet({
  visible,
  mealId,
  userId,
  isSaving,
  isDeleting,
  onClose,
  onSave,
  onDeleteMeal,
}: MealEditSheetProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [rowItems, setRowItems] = useState<MealItemRowItem[]>([]);
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
        const items = await fetchMealItemsForEdit(mealId!, userId!);
        if (cancelled) {
          return;
        }

        setRowItems(items.map(mealItemForEditToRow));
        setInitialMealItemIds(items.map((item) => item.id));
      } catch (error) {
        console.error('[MealEditSheet] failed to load meal items:', error);
        if (!cancelled) {
          setLoadError(true);
          setRowItems([]);
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
      setRowItems([]);
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
  }, [rowItems.length, shouldScrollToEnd]);

  const totalKcal = useMemo(() => sumRowItemsKcal(rowItems), [rowItems]);

  const canSave = useMemo(() => {
    if (rowItems.length === 0 || isLoading || loadError) {
      return false;
    }

    return rowItems.every((item) => isRowItemValid(item));
  }, [rowItems, isLoading, loadError]);

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
    if (!canSave || !mealId) {
      return;
    }

    const remainingMealItemIds = new Set(
      rowItems.map((item) => item.mealItemId).filter((id): id is string => id != null),
    );
    const removedMealItemIds = initialMealItemIds.filter((id) => !remainingMealItemIds.has(id));

    const items: MealItemEditInput[] = rowItems.map((item) => ({
      ...rowItemToManualInput(item),
      mealItemId: item.mealItemId ?? null,
      wasAiGenerated: item.wasAiGenerated ?? false,
    }));

    onSave({
      mealId,
      items,
      removedMealItemIds,
    });
  }

  function handleDeleteMealPress() {
    if (!mealId || isSaving || isDeleting) {
      return;
    }

    Alert.alert(t('home.meal.deleteMeal'), t('home.meal.deleteMealConfirm'), [
      { text: t('settings.common.cancel'), style: 'cancel' },
      {
        text: t('home.meal.deleteMeal'),
        style: 'destructive',
        onPress: () => onDeleteMeal(mealId),
      },
    ]);
  }

  return (
    <GlassBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={MEAL_SHEET_MAX_HEIGHT_RATIO}>
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
          <MealItemsSheetBody
            scrollRef={scrollRef}
            header={
              <>
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
                  accessibilityLabel={t('home.mealEdit.save')}
                  disabled={isSaving || isDeleting || !canSave}
                  style={[styles.saveShell, (isSaving || isDeleting || !canSave) && styles.saveDisabled]}
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

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('home.meal.deleteMeal')}
                  disabled={isSaving || isDeleting}
                  style={styles.deleteMealButton}
                  onPress={handleDeleteMealPress}>
                  {isDeleting ? (
                    <ActivityIndicator color="#DC2626" />
                  ) : (
                    <Text style={styles.deleteMealLabel}>{t('home.meal.deleteMeal')}</Text>
                  )}
                </Pressable>
              </>
            }>
            {rowItems.map((item) => (
              <MealItemRow
                key={item.id}
                invalid={!isRowItemValid(item)}
                item={item}
                onChangeKcal={(id, value) =>
                  updateRowItem(id, (row) => changeRowItemKcal(row, value))
                }
                onChangeName={(id, name) => updateRowItem(id, (row) => changeRowItemName(row, name))}
                onChangeQuantity={(id, value) =>
                  updateRowItem(id, (row) => changeRowItemQuantity(row, value))
                }
                onChangeUnit={(id, unit) => updateRowItem(id, (row) => changeRowItemUnit(row, unit))}
                onRemove={rowItems.length > 1 ? handleRemoveProduct : undefined}
              />
            ))}
          </MealItemsSheetBody>
        )}
      </View>
    </GlassBottomSheet>
  );
}
