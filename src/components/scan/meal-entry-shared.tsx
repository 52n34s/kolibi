import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import {
  isManualMealEntryValid,
  type ManualMealEntryInput,
  type ManualMealEntryUnit,
} from '@/lib/meals';

export const SHEET_MAX_HEIGHT_RATIO = 0.88;
const SHEET_CHROME_HEIGHT = 54;
const MEAL_ENTRY_FIXED_CHROME_HEIGHT = 230;

export type MealItemDraft = {
  id: string;
  mealItemId: string | null;
  wasAiGenerated: boolean;
  name: string;
  unit: ManualMealEntryUnit;
  amountText: string;
  gramsPerUnitText: string;
  kcalText: string;
};

export function createEntryId(): string {
  return `meal-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyMealItemDraft(): MealItemDraft {
  return {
    id: createEntryId(),
    mealItemId: null,
    wasAiGenerated: false,
    name: '',
    unit: 'grams',
    amountText: '',
    gramsPerUnitText: '',
    kcalText: '',
  };
}

export function parsePositiveDecimal(text: string): number {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') {
    return 0;
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  return value;
}

export function formatDraftNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return String(value);
}

export function draftToInput(draft: MealItemDraft): ManualMealEntryInput {
  const amount = parsePositiveDecimal(draft.amountText);
  const gramsPerUnit =
    draft.unit === 'count' ? parsePositiveDecimal(draft.gramsPerUnitText) : null;

  return {
    id: draft.id,
    name: draft.name,
    unit: draft.unit,
    amount,
    gramsPerUnit,
    kcal: parsePositiveDecimal(draft.kcalText),
  };
}

export function sumDraftKcal(drafts: MealItemDraft[]): number {
  return drafts.reduce((total, draft) => {
    const kcal = parsePositiveDecimal(draft.kcalText);
    if (!Number.isFinite(kcal) || kcal <= 0) {
      return total;
    }

    return total + Math.round(kcal);
  }, 0);
}

export function useGrowableMealEntrySheetLayout() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentMaxHeight =
    height * SHEET_MAX_HEIGHT_RATIO - SHEET_CHROME_HEIGHT - Math.max(insets.bottom, 16);
  const scrollMaxHeight = Math.max(100, contentMaxHeight - MEAL_ENTRY_FIXED_CHROME_HEIGHT);

  return { contentMaxHeight, scrollMaxHeight };
}

type MealItemEntryCardProps = {
  draft: MealItemDraft;
  canRemove: boolean;
  onNameChange: (value: string) => void;
  onUnitChange: (unit: ManualMealEntryUnit) => void;
  onAmountChange: (value: string) => void;
  onGramsPerUnitChange: (value: string) => void;
  onKcalChange: (value: string) => void;
  onRemove: () => void;
};

export function MealItemEntryCard({
  draft,
  canRemove,
  onNameChange,
  onUnitChange,
  onAmountChange,
  onGramsPerUnitChange,
  onKcalChange,
  onRemove,
}: MealItemEntryCardProps) {
  const { t } = useTranslation();
  const input = draftToInput(draft);
  const isInvalid = !isManualMealEntryValid(input);

  return (
    <View style={[styles.entryCard, isInvalid && styles.entryCardInvalid]}>
      <View style={styles.entryHeader}>
        <Text style={styles.fieldLabel}>{t('home.manualEntry.nameLabel')}</Text>
        {canRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.manualEntry.removeProduct')}
            hitSlop={6}
            style={styles.removeButton}
            onPress={onRemove}>
            <Ionicons name="close" size={16} color="#6B7280" />
          </Pressable>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={t('home.manualEntry.namePlaceholder')}
        placeholder={t('home.manualEntry.namePlaceholder')}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        value={draft.name}
        onChangeText={onNameChange}
      />

      <Text style={styles.fieldLabel}>{t('home.manualEntry.unitLabel')}</Text>
      <CompactSegmentToggle
        variant="unit"
        value={draft.unit}
        onChange={(value) => onUnitChange(value as ManualMealEntryUnit)}
        segments={[
          { id: 'grams', label: t('home.manualEntry.unitGrams') },
          { id: 'ml', label: t('home.manualEntry.unitMl') },
          { id: 'count', label: t('home.manualEntry.unitCount') },
        ]}
      />

      <Text style={styles.fieldLabel}>
        {draft.unit === 'count'
          ? t('home.manualEntry.countLabel')
          : draft.unit === 'ml'
            ? t('home.manualEntry.mlLabel')
            : t('home.manualEntry.gramsLabel')}
      </Text>
      <TextInput
        accessibilityLabel={t('home.manualEntry.amountPlaceholder')}
        keyboardType="decimal-pad"
        placeholder={t('home.manualEntry.amountPlaceholder')}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        value={draft.amountText}
        onChangeText={onAmountChange}
      />

      {draft.unit === 'count' ? (
        <>
          <Text style={styles.fieldLabel}>{t('home.manualEntry.gramsPerUnitLabel')}</Text>
          <TextInput
            accessibilityLabel={t('home.manualEntry.gramsPerUnitPlaceholder')}
            keyboardType="decimal-pad"
            placeholder={t('home.manualEntry.gramsPerUnitPlaceholder')}
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={draft.gramsPerUnitText}
            onChangeText={onGramsPerUnitChange}
          />
        </>
      ) : null}

      <Text style={styles.fieldLabel}>{t('home.manualEntry.kcalLabel')}</Text>
      <TextInput
        accessibilityLabel={t('home.manualEntry.kcalPlaceholder')}
        keyboardType="number-pad"
        placeholder={t('home.manualEntry.kcalPlaceholder')}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        value={draft.kcalText}
        onChangeText={onKcalChange}
      />
    </View>
  );
}

export const mealEntrySheetStyles = StyleSheet.create({
  sheetBody: {
    flexGrow: 0,
  },
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
    flexGrow: 0,
    marginBottom: 12,
  },
  listContent: {
    gap: 10,
  },
  entryCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  entryCardInvalid: {
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  removeButton: {
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
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
});

const styles = mealEntrySheetStyles;
