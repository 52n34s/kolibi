import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import {
  getAvailableQuantityOptions,
  getDefaultOption,
  getQuantityGramsForOption,
  type QuantityOption,
  type QuantityPresetSource,
} from '@/components/scan/barcode-quantity-utils';
import { MealItemRow } from '@/components/scan/MealItemRow';
import {
  changeRowItemAbsoluteMacro,
  changeRowItemKcal,
  changeRowItemName,
  changeRowItemQuantity,
  changeRowItemUnit,
  createEmptyRowItem,
  createRowItemId,
  editableToRowItem,
  getMealItemsValidationIssue,
  isRowItemValid,
  mealValidationIssueToConfirmationKey,
  rowItemsToEditable,
  sumRowItemsKcal,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { mealEntrySheetStyles as styles } from '@/components/scan/meal-entry-shared';
import { MealItemsSheetBody, MEAL_SHEET_MAX_HEIGHT_RATIO } from '@/components/scan/MealItemsSheetBody';
import { MealPortionFactorChips } from '@/components/scan/MealPortionFactorChips';
import { QuantityPresetPills } from '@/components/scan/QuantityPresetPills';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { ShareStickerSheet } from '@/components/share/ShareStickerSheet';
import { buildMealSticker, type MealStickerData } from '@/lib/share/sticker-data';
import {
  createManualEditableItem,
  type EditableMealItem,
} from '@/services/mealVision/types';
import { formatKcal } from '@/utils/format';

/**
 * Set when the sheet was opened from a transcribed nutrition label: the printed
 * sizes drive quantity presets instead of the "how much did you eat" chips,
 * and a failed server-side kcal check is surfaced on the row.
 */
export type MealLabelContext = {
  presetSource: QuantityPresetSource;
  plausibilityPassed: boolean | null;
};

type MealConfirmationSheetProps = {
  visible: boolean;
  items: EditableMealItem[];
  isSaving: boolean;
  labelContext?: MealLabelContext | null;
  onClose: () => void;
  onDismissed?: () => void;
  onSave: (items: EditableMealItem[], portionFactor: number) => void;
  /**
   * Local URI of the scanned photo while this sheet is open. Enables "Teilen";
   * the caller deletes the file once the sheet closes.
   */
  photoUri?: string | null;
};

function createItemId(): string {
  return createRowItemId();
}

export function MealConfirmationSheet({
  visible,
  items,
  isSaving,
  labelContext = null,
  onClose,
  onDismissed,
  onSave,
  photoUri = null,
}: MealConfirmationSheetProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [rowItems, setRowItems] = useState<MealItemRowItem[]>([]);
  const [editableById, setEditableById] = useState<Map<string, EditableMealItem>>(new Map());
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);
  const [portionFactor, setPortionFactor] = useState(1);
  const [quantityOption, setQuantityOption] = useState<QuantityOption | null>(null);
  const [mealSticker, setMealSticker] = useState<MealStickerData | null>(null);

  useEffect(() => {
    if (visible) {
      setRowItems(items.map((item) => editableToRowItem(item)));
      setEditableById(new Map(items.map((item) => [item.id, item])));
      setShouldScrollToEnd(false);
      setPortionFactor(1);
      setQuantityOption(labelContext ? getDefaultOption(labelContext.presetSource) : null);
    }
  }, [items, labelContext, visible]);

  useEffect(() => {
    if (!shouldScrollToEnd) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      setShouldScrollToEnd(false);
    });
  }, [rowItems.length, shouldScrollToEnd]);

  const plateTotalKcal = useMemo(() => sumRowItemsKcal(rowItems), [rowItems]);
  const totalKcal = useMemo(
    () => Math.round(plateTotalKcal * portionFactor),
    [plateTotalKcal, portionFactor],
  );
  const saveBlockIssue = useMemo(() => getMealItemsValidationIssue(rowItems), [rowItems]);
  const canSave = saveBlockIssue == null;
  const quantityOptions = useMemo(
    () => (labelContext ? getAvailableQuantityOptions(labelContext.presetSource) : []),
    [labelContext],
  );
  const labelNotice =
    labelContext?.plausibilityPassed === false
      ? t('home.scan.confirmation.labelPlausibilityWarning')
      : null;

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

  /** Presets retarget the label row (the first one); added ingredients keep theirs. */
  function applyQuantityOption(option: QuantityOption) {
    if (!labelContext) {
      return;
    }

    setQuantityOption(option);
    setRowItems((current) => {
      const [first, ...rest] = current;
      if (!first) {
        return current;
      }

      const quantityGrams = getQuantityGramsForOption(
        option,
        labelContext.presetSource,
        first.quantity,
      );

      return [changeRowItemQuantity(first, quantityGrams), ...rest];
    });
  }

  function handleAddIngredient() {
    const id = createItemId();
    const editable = createManualEditableItem({ id, name: '', quantityGrams: 0, kcal: 0 });
    setRowItems((current) => [...current, editableToRowItem(editable)]);
    setEditableById((current) => new Map(current).set(id, editable));
    setShouldScrollToEnd(true);
  }

  function openShare() {
    setMealSticker(
      buildMealSticker({
        items: rowItems.map((item) => ({ name: item.name, kcal: item.kcal, proteinG: item.proteinG })),
        portionFactor,
        photoUri,
      }),
    );
  }

  function handleSavePress() {
    if (!canSave) {
      return;
    }

    onSave(rowItemsToEditable(rowItems, editableById), portionFactor);
  }

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
            {photoUri && rowItems.length > 0 ? (
              <Pressable
                testID="scan.confirmation.share"
                accessibilityRole="button"
                accessibilityLabel={t('home.scan.confirmation.share')}
                onPress={openShare}
                style={shareStyles.button}>
                <Ionicons name="share-outline" size={16} color="#4F46E5" />
                <Text style={shareStyles.label}>{t('home.scan.confirmation.share')}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.totalKcal}>{formatKcal(totalKcal)}</Text>
            <Text style={styles.totalLabel}>{t('home.scan.confirmation.totalKcal')}</Text>
            {!labelContext && portionFactor !== 1 ? (
              <Text style={styles.portionHint}>
                {t('home.scan.portion.hint', { total: formatKcal(plateTotalKcal) })}
              </Text>
            ) : null}
            {labelContext ? (
              <QuantityPresetPills
                options={quantityOptions}
                selected={quantityOption}
                product={labelContext.presetSource}
                onSelect={applyQuantityOption}
              />
            ) : (
              <MealPortionFactorChips value={portionFactor} onChange={setPortionFactor} />
            )}
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

            {saveBlockIssue != null ? (
              <Text style={styles.saveHint}>
                {t(mealValidationIssueToConfirmationKey(saveBlockIssue))}
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
            onChangeQuantity={(id, value) => {
              setQuantityOption(null);
              updateRowItem(id, (row) => changeRowItemQuantity(row, value));
            }}
            onChangeMacro={(id, key, value) =>
              updateRowItem(id, (row) => changeRowItemAbsoluteMacro(row, key, value))
            }
            onChangeUnit={(id, unit) => updateRowItem(id, (row) => changeRowItemUnit(row, unit))}
            onRemove={rowItems.length > 1 ? removeIngredient : undefined}
            notice={item.kcalPer100gSource === 'label' ? labelNotice : null}
          />
        ))}
      </MealItemsSheetBody>
      <ShareStickerSheet data={mealSticker} onClose={() => setMealSticker(null)} allowStory />
    </GlassBottomSheet>
  );
}

const shareStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  label: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
});
