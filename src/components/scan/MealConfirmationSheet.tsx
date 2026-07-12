import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import {
  createManualEditableItem,
  getItemTotalGrams,
  scaleItemKcal,
  sumEditableKcal,
  visionItemToEditable,
  type EditableMealItem,
  type VisionFoodItem,
} from '@/services/mealVision/types';

type MealConfirmationSheetProps = {
  visible: boolean;
  items: VisionFoodItem[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (items: EditableMealItem[]) => void;
};

const GRAM_STEP = 10;
const COUNT_STEP = 1;
const MIN_GRAMS = 10;
const MIN_COUNT = 1;

type ItemValidationIssue = 'missingName' | 'missingGrams' | 'missingKcal';

type ItemValidation = {
  canSave: boolean;
  itemIssues: Map<string, ItemValidationIssue[]>;
  sheetIssue: 'noIngredients' | 'fixRows' | null;
};

function getItemValidationIssues(item: EditableMealItem): ItemValidationIssue[] {
  const issues: ItemValidationIssue[] = [];

  if ((item.name ?? '').trim().length === 0) {
    issues.push('missingName');
  }

  if (getItemTotalGrams(item) <= 0) {
    issues.push('missingGrams');
  }

  if (item.kcal <= 0) {
    issues.push('missingKcal');
  }

  return issues;
}

function getSheetValidation(items: EditableMealItem[]): ItemValidation {
  const itemIssues = new Map<string, ItemValidationIssue[]>();

  for (const item of items) {
    const issues = getItemValidationIssues(item);
    if (issues.length > 0) {
      itemIssues.set(item.id, issues);
    }
  }

  if (items.length === 0) {
    return {
      canSave: false,
      itemIssues,
      sheetIssue: 'noIngredients',
    };
  }

  if (itemIssues.size > 0) {
    return {
      canSave: false,
      itemIssues,
      sheetIssue: 'fixRows',
    };
  }

  return {
    canSave: true,
    itemIssues,
    sheetIssue: null,
  };
}

function formatItemValidationHint(
  issues: ItemValidationIssue[],
  t: (key: string) => string,
): string {
  const messages = issues.map((issue) => {
    switch (issue) {
      case 'missingName':
        return t('home.scan.confirmation.validationMissingName');
      case 'missingGrams':
        return t('home.scan.confirmation.validationMissingGrams');
      case 'missingKcal':
        return t('home.scan.confirmation.validationMissingKcal');
    }
  });

  return messages.join(' · ');
}

function createItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatQuantityLabel(
  item: EditableMealItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.quantityCount != null) {
    return t('home.scan.confirmation.quantityCount', { value: item.quantityCount });
  }

  if (item.quantityGrams != null) {
    return t('home.scan.confirmation.quantityGrams', { value: item.quantityGrams });
  }

  return t('home.scan.confirmation.quantityUnknown');
}

function parsePositiveInt(text: string): number {
  const digits = text.replace(/\D/g, '');
  if (digits === '') {
    return 0;
  }

  return Number.parseInt(digits, 10);
}

type DeleteButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
};

function DeleteButton({ accessibilityLabel, onPress }: DeleteButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.deleteButton}
      hitSlop={6}
      onPress={onPress}>
      <Ionicons name="close" size={16} color="#6B7280" />
    </Pressable>
  );
}

type AiIngredientRowProps = {
  item: EditableMealItem;
  decreaseLabel: string;
  increaseLabel: string;
  removeLabel: string;
  validationHint: string | null;
  formatQuantity: (item: EditableMealItem) => string;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
};

function AiIngredientRow({
  item,
  decreaseLabel,
  increaseLabel,
  removeLabel,
  validationHint,
  formatQuantity,
  onDecrease,
  onIncrease,
  onRemove,
}: AiIngredientRowProps) {
  return (
    <View style={[styles.itemRow, validationHint != null && styles.itemRowInvalid]}>
      <View style={styles.itemTextBlock}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemMeta}>
          {formatQuantity(item)} · {item.kcal} kcal
        </Text>
        {validationHint != null ? <Text style={styles.rowValidationHint}>{validationHint}</Text> : null}
      </View>

      <View style={styles.itemActions}>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={decreaseLabel}
            style={styles.stepperButton}
            onPress={onDecrease}>
            <Ionicons name="remove" size={18} color="#4F46E5" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={increaseLabel}
            style={styles.stepperButton}
            onPress={onIncrease}>
            <Ionicons name="add" size={18} color="#4F46E5" />
          </Pressable>
        </View>
        <DeleteButton accessibilityLabel={removeLabel} onPress={onRemove} />
      </View>
    </View>
  );
}

type ManualIngredientRowProps = {
  item: EditableMealItem;
  namePlaceholder: string;
  gramsPlaceholder: string;
  kcalPlaceholder: string;
  removeLabel: string;
  issues: ItemValidationIssue[];
  validationHint: string | null;
  onNameChange: (value: string) => void;
  onGramsChange: (value: string) => void;
  onKcalChange: (value: string) => void;
  onRemove: () => void;
};

function ManualIngredientRow({
  item,
  namePlaceholder,
  gramsPlaceholder,
  kcalPlaceholder,
  removeLabel,
  issues,
  validationHint,
  onNameChange,
  onGramsChange,
  onKcalChange,
  onRemove,
}: ManualIngredientRowProps) {
  const gramsValue = item.quantityGrams != null && item.quantityGrams > 0 ? String(item.quantityGrams) : '';
  const kcalValue = item.kcal > 0 ? String(item.kcal) : '';
  const hasNameIssue = issues.includes('missingName');
  const hasGramsIssue = issues.includes('missingGrams');
  const hasKcalIssue = issues.includes('missingKcal');

  return (
    <View style={[styles.manualRow, validationHint != null && styles.itemRowInvalid]}>
      <View style={styles.manualHeader}>
        <TextInput
          accessibilityLabel={namePlaceholder}
          placeholder={namePlaceholder}
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.nameInput, hasNameIssue && styles.inputInvalid]}
          value={item.name}
          onChangeText={onNameChange}
        />
        <DeleteButton accessibilityLabel={removeLabel} onPress={onRemove} />
      </View>

      <View style={styles.manualFields}>
        <TextInput
          accessibilityLabel={gramsPlaceholder}
          keyboardType="number-pad"
          placeholder={gramsPlaceholder}
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.numericInput, hasGramsIssue && styles.inputInvalid]}
          value={gramsValue}
          onChangeText={onGramsChange}
        />
        <TextInput
          accessibilityLabel={kcalPlaceholder}
          keyboardType="number-pad"
          placeholder={kcalPlaceholder}
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.numericInput, hasKcalIssue && styles.inputInvalid]}
          value={kcalValue}
          onChangeText={onKcalChange}
        />
      </View>
      {validationHint != null ? <Text style={styles.rowValidationHint}>{validationHint}</Text> : null}
    </View>
  );
}

export function MealConfirmationSheet({
  visible,
  items,
  isSaving,
  onClose,
  onSave,
}: MealConfirmationSheetProps) {
  const { t } = useTranslation();
  const [editableItems, setEditableItems] = useState<EditableMealItem[]>([]);

  useEffect(() => {
    if (visible) {
      setEditableItems(
        items.map((item) => visionItemToEditable(item, createItemId())),
      );
    }
  }, [items, visible]);

  const totalKcal = useMemo(() => sumEditableKcal(editableItems), [editableItems]);
  const validation = useMemo(() => getSheetValidation(editableItems), [editableItems]);
  const saveDisabled = isSaving || !validation.canSave;

  function adjustQuantity(itemId: string, direction: 1 | -1) {
    setEditableItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (item.quantityCount != null) {
          const nextCount = Math.max(MIN_COUNT, item.quantityCount + direction * COUNT_STEP);
          const gramsPerUnit = item.gramsPerUnit ?? 0;
          return {
            ...item,
            quantityCount: nextCount,
            quantityGrams: nextCount * gramsPerUnit,
            kcal: scaleItemKcal(item, nextCount),
          };
        }

        const nextGrams = Math.max(
          MIN_GRAMS,
          (item.quantityGrams ?? MIN_GRAMS) + direction * GRAM_STEP,
        );

        return {
          ...item,
          quantityGrams: nextGrams,
          kcal: scaleItemKcal(item, nextGrams),
        };
      }),
    );
  }

  function updateManualItem(
    itemId: string,
    updates: Partial<Pick<EditableMealItem, 'name' | 'quantityGrams' | 'kcal'>>,
  ) {
    setEditableItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || item.origin !== 'manual') {
          return item;
        }

        return { ...item, ...updates };
      }),
    );
  }

  function removeIngredient(itemId: string) {
    setEditableItems((current) => current.filter((item) => item.id !== itemId));
  }

  function handleAddIngredient() {
    setEditableItems((current) => [
      ...current,
      createManualEditableItem({
        id: createItemId(),
        name: '',
        quantityGrams: 0,
        kcal: 0,
      }),
    ]);
  }

  function handleSavePress() {
    if (!validation.canSave) {
      return;
    }

    onSave(editableItems);
  }

  return (
    <GlassBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('home.scan.confirmation.title')}</Text>

      <Text style={styles.totalKcal}>{totalKcal}</Text>
      <Text style={styles.totalLabel}>{t('home.scan.confirmation.totalKcal')}</Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {editableItems.length === 0 ? (
          <Text style={styles.emptyListHint}>{t('home.scan.confirmation.validationNoIngredients')}</Text>
        ) : null}
        {editableItems.map((item) => {
          const issues = validation.itemIssues.get(item.id) ?? [];
          const validationHint =
            issues.length > 0 ? formatItemValidationHint(issues, t) : null;

          return item.origin === 'manual' ? (
            <ManualIngredientRow
              key={item.id}
              gramsPlaceholder={t('home.scan.confirmation.gramsPlaceholder')}
              issues={issues}
              item={item}
              kcalPlaceholder={t('home.scan.confirmation.kcalPlaceholder')}
              namePlaceholder={t('home.scan.confirmation.namePlaceholder')}
              removeLabel={t('home.scan.confirmation.removeIngredient')}
              validationHint={validationHint}
              onGramsChange={(value) =>
                updateManualItem(item.id, { quantityGrams: parsePositiveInt(value) })
              }
              onKcalChange={(value) => updateManualItem(item.id, { kcal: parsePositiveInt(value) })}
              onNameChange={(value) => updateManualItem(item.id, { name: value })}
              onRemove={() => removeIngredient(item.id)}
            />
          ) : (
            <AiIngredientRow
              key={item.id}
              decreaseLabel={t('home.scan.confirmation.decrease')}
              formatQuantity={(row) => formatQuantityLabel(row, t)}
              increaseLabel={t('home.scan.confirmation.increase')}
              item={item}
              removeLabel={t('home.scan.confirmation.removeIngredient')}
              validationHint={validationHint}
              onDecrease={() => adjustQuantity(item.id, -1)}
              onIncrease={() => adjustQuantity(item.id, 1)}
              onRemove={() => removeIngredient(item.id)}
            />
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.confirmation.addIngredient')}
        style={styles.addButton}
        onPress={handleAddIngredient}>
        <Ionicons name="add-circle-outline" size={18} color="#4F46E5" />
        <Text style={styles.addButtonLabel}>{t('home.scan.confirmation.addIngredient')}</Text>
      </Pressable>

      {validation.sheetIssue != null ? (
        <Text style={styles.saveHint}>
          {validation.sheetIssue === 'noIngredients'
            ? t('home.scan.confirmation.validationNoIngredients')
            : t('home.scan.confirmation.validationFixRows')}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.confirmation.save')}
        disabled={saveDisabled}
        style={[styles.saveShell, saveDisabled && styles.saveDisabled]}
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
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  totalKcal: {
    fontSize: 44,
    fontWeight: '700',
    color: '#4F46E5',
    textAlign: 'center',
  },
  totalLabel: {
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  list: {
    maxHeight: 280,
    marginBottom: 12,
  },
  listContent: {
    gap: 10,
  },
  emptyListHint: {
    paddingVertical: 16,
    fontSize: 14,
    color: '#B45309',
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manualRow: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  itemRowInvalid: {
    borderColor: 'rgba(220, 38, 38, 0.45)',
    backgroundColor: 'rgba(254, 242, 242, 0.55)',
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualFields: {
    flexDirection: 'row',
    gap: 8,
  },
  itemTextBlock: {
    flex: 1,
    paddingRight: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  input: {
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
  },
  nameInput: {
    flex: 1,
    fontWeight: '600',
  },
  numericInput: {
    flex: 1,
  },
  inputInvalid: {
    borderColor: 'rgba(220, 38, 38, 0.55)',
  },
  rowValidationHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#B91C1C',
  },
  saveHint: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '500',
    color: '#B45309',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 8,
  },
  addButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4F46E5',
  },
  saveShell: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveGradient: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
