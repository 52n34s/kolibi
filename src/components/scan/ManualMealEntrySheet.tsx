import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import {
  type NameFieldAnchor,
  type SheetLayout,
} from '@/components/scan/FoodNameAutocompleteDropdown';
import { MealItemRow } from '@/components/scan/MealItemRow';
import { useMealInputBarValues } from '@/components/scan/meal-input-bar-context';
import {
  resolveFoodAutocompletePlacementMode,
  useFoodAutocompleteOverlayActions,
} from '@/components/scan/meal-food-autocomplete-overlay';
import {
  applyOffProductToRow,
  changeRowItemKcal,
  changeRowItemName,
  changeRowItemQuantity,
  changeRowItemUnit,
  createEmptyRowItem,
  isRowItemValid,
  rowItemsToEditable,
  sumRowItemsKcal,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { MealItemsSheetBody, MEAL_SHEET_MAX_HEIGHT_RATIO } from '@/components/scan/MealItemsSheetBody';
import { mealEntrySheetStyles as styles } from '@/components/scan/meal-entry-shared';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { useFoodNameSearch } from '@/hooks/use-food-name-search';
import { resolveFoodIdForOffProduct } from '@/lib/foods-cache';
import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';
import type { EditableMealItem } from '@/services/mealVision/types';

const SCROLL_REMEASURE_DEBOUNCE_MS = 100;

type ManualMealEntrySheetProps = {
  visible: boolean;
  isSaving: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  onSave: (items: EditableMealItem[]) => void;
};

export function ManualMealEntrySheet({
  visible,
  isSaving,
  onClose,
  onDismissed,
  onSave,
}: ManualMealEntrySheetProps) {
  return (
    <GlassBottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      maxHeightRatio={MEAL_SHEET_MAX_HEIGHT_RATIO}>
      <ManualMealEntrySheetContent
        visible={visible}
        isSaving={isSaving}
        onSave={onSave}
      />
    </GlassBottomSheet>
  );
}

function ManualMealEntrySheetContent({
  visible,
  isSaving,
  onSave,
}: Pick<ManualMealEntrySheetProps, 'visible' | 'isSaving' | 'onSave'>) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const mealInputBarValues = useMealInputBarValues();
  const overlayActions = useFoodAutocompleteOverlayActions();
  const keyboardHeight = mealInputBarValues?.keyboardHeight ?? 0;
  const scrollRef = useRef<ScrollView>(null);
  const sheetRootRef = useRef<View>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAutocompleteItemIdRef = useRef<string | null>(null);
  const [rowItems, setRowItems] = useState<MealItemRowItem[]>([createEmptyRowItem()]);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);
  const [activeAutocompleteItemId, setActiveAutocompleteItemId] = useState<string | null>(null);
  const [nameAnchor, setNameAnchor] = useState<NameFieldAnchor | null>(null);
  const [sheetLayout, setSheetLayout] = useState<SheetLayout | null>(null);
  const [scrollRemeasureTick, setScrollRemeasureTick] = useState(0);

  const activeRow = useMemo(
    () => rowItems.find((item) => item.id === activeAutocompleteItemId) ?? null,
    [activeAutocompleteItemId, rowItems],
  );

  const searchEnabled = visible && activeAutocompleteItemId != null;
  const { results, isSearching, rateLimited, searchUnavailable, canSearch, hasSettled } =
    useFoodNameSearch(
    activeRow?.name ?? '',
    searchEnabled,
  );

  const dropdownVisible =
    activeAutocompleteItemId != null &&
    canSearch &&
    nameAnchor != null &&
    sheetLayout != null &&
    (isSearching || hasSettled);

  const placementMode = resolveFoodAutocompletePlacementMode(
    keyboardHeight,
    activeAutocompleteItemId != null,
  );

  activeAutocompleteItemIdRef.current = activeAutocompleteItemId;

  useEffect(() => {
    if (visible) {
      setRowItems([createEmptyRowItem()]);
      setShouldScrollToEnd(false);
      setActiveAutocompleteItemId(null);
      setNameAnchor(null);
      setSheetLayout(null);
      setScrollRemeasureTick(0);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
    };
  }, []);

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

  const measureSheetLayout = useCallback(() => {
    sheetRootRef.current?.measureInWindow((x, y, width, height) => {
      setSheetLayout({ x, y, width, height });
    });
  }, []);

  const clearAutocomplete = useCallback(() => {
    setActiveAutocompleteItemId(null);
    setNameAnchor(null);
  }, []);

  useEffect(() => {
    if (nameAnchor) {
      measureSheetLayout();
    }
  }, [measureSheetLayout, nameAnchor]);

  useEffect(() => {
    if (!activeAutocompleteItemId || keyboardHeight <= 0) {
      return;
    }

    measureSheetLayout();
  }, [activeAutocompleteItemId, keyboardHeight, measureSheetLayout]);

  const handleNameFieldFocus = useCallback(
    (itemId: string, anchor: NameFieldAnchor) => {
      setActiveAutocompleteItemId(itemId);
      setNameAnchor(anchor);
      measureSheetLayout();
    },
    [measureSheetLayout],
  );

  const handleListScroll = useCallback(() => {
    if (!activeAutocompleteItemId) {
      return;
    }

    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }

    scrollDebounceRef.current = setTimeout(() => {
      measureSheetLayout();
      setScrollRemeasureTick((tick) => tick + 1);
    }, SCROLL_REMEASURE_DEBOUNCE_MS);
  }, [activeAutocompleteItemId, measureSheetLayout]);

  const handleBackgroundPress = useCallback(() => {
    clearAutocomplete();
    Keyboard.dismiss();
  }, [clearAutocomplete]);

  function handleAddProduct() {
    clearAutocomplete();
    setRowItems((current) => [...current, createEmptyRowItem()]);
    setShouldScrollToEnd(true);
  }

  function handleRemoveProduct(id: string) {
    if (activeAutocompleteItemId === id) {
      clearAutocomplete();
    }

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

    clearAutocomplete();
    onSave(rowItemsToEditable(rowItems));
  }

  async function handleSelectOffProduct(itemId: string, product: FoodSearchProduct) {
    clearAutocomplete();

    const knownFoodId = product.foodId ?? null;

    updateRowItem(itemId, (row) =>
      applyOffProductToRow(row, product, knownFoodId),
    );

    if (knownFoodId) {
      return;
    }

    try {
      const foodId = await resolveFoodIdForOffProduct(product);
      if (foodId) {
        updateRowItem(itemId, (row) =>
          row.id === itemId ? { ...row, foodId } : row,
        );
      }
    } catch (error) {
      console.error('[ManualMealEntrySheet] foods cache failed:', error);
    }
  }

  const handleSelectOffProductStable = useCallback((product: FoodSearchProduct) => {
    const itemId = activeAutocompleteItemIdRef.current;
    if (!itemId) {
      return;
    }

    void handleSelectOffProduct(itemId, product);
  }, []);

  useEffect(() => {
    const { setOverlayState } = overlayActions;

    if (!visible || !dropdownVisible || !sheetLayout) {
      setOverlayState(null);
      return;
    }

    if (placementMode === 'field' && !nameAnchor) {
      setOverlayState(null);
      return;
    }

    setOverlayState({
      visible: true,
      placementMode,
      anchor: nameAnchor,
      sheetLayout,
      keyboardHeight,
      windowHeight,
      results,
      isSearching,
      rateLimited,
      searchUnavailable,
      onSelect: handleSelectOffProductStable,
    });

    return () => {
      setOverlayState(null);
    };
  }, [
    dropdownVisible,
    handleSelectOffProductStable,
    isSearching,
    keyboardHeight,
    nameAnchor,
    overlayActions,
    placementMode,
    rateLimited,
    searchUnavailable,
    results,
    sheetLayout,
    visible,
    windowHeight,
  ]);

  useEffect(() => {
    if (!visible) {
      overlayActions.setOverlayState(null);
    }
  }, [overlayActions, visible]);

  return (
    <View ref={sheetRootRef} style={styles.sheetRoot} collapsable={false}>
        <MealItemsSheetBody
          scrollRef={scrollRef}
          onBackgroundPress={handleBackgroundPress}
          onScroll={handleListScroll}
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
              remeasureTrigger={scrollRemeasureTick}
              onChangeKcal={(id, value) => updateRowItem(id, (row) => changeRowItemKcal(row, value))}
              onChangeName={(id, name) => updateRowItem(id, (row) => changeRowItemName(row, name))}
              onChangeQuantity={(id, value) =>
                updateRowItem(id, (row) => changeRowItemQuantity(row, value))
              }
              onChangeUnit={(id, unit) => updateRowItem(id, (row) => changeRowItemUnit(row, unit))}
              onNameFieldFocus={handleNameFieldFocus}
              onQuantityFieldFocus={clearAutocomplete}
              onKcalFieldFocus={clearAutocomplete}
              onRemove={rowItems.length > 1 ? handleRemoveProduct : undefined}
            />
          ))}
        </MealItemsSheetBody>
      </View>
  );
}
