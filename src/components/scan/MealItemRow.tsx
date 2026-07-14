import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import {
  type MealStepperField,
  useMealInputBarActions,
} from '@/components/scan/meal-input-bar-context';
import {
  getDensityUnitLabel,
  isLinkedItem,
  isPcsUnitAvailable,
  KCAL_STEP,
  type MealItemRowItem,
  type MealItemUnit,
} from '@/components/scan/meal-item-row-model';
import {
  fromDisplay,
  getMinDisplayQuantity,
  getQuantityStep,
  toDisplay,
} from '@/lib/units';
import type { UnitSystem } from '@/lib/unit-system';
import { useOnboardingStore } from '@/stores/onboarding-store';

export type MealItemRowProps = {
  item: MealItemRowItem;
  onChangeName: (id: string, name: string) => void;
  onChangeUnit: (id: string, unit: MealItemUnit) => void;
  onChangeQuantity: (id: string, value: number) => void;
  onChangeKcal: (id: string, value: number) => void;
  onRemove?: (id: string) => void;
  invalid?: boolean;
};

type StepperFieldProps = {
  label: string;
  value: number;
  step: number;
  minValue: number;
  decreaseLabel: string;
  increaseLabel: string;
  allowDecimals: boolean;
  onChange: (value: number) => void;
  onFocus?: (draftText: string) => void;
  onBlur?: () => void;
  onDraftChange?: (draftText: string) => void;
};

function formatStepperValue(value: number, allowDecimals: boolean): string {
  if (allowDecimals) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  return String(Math.round(value));
}

function parseStepperInput(text: string, minValue: number, allowDecimals: boolean): number {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') {
    return minValue;
  }

  const value = allowDecimals
    ? Number.parseFloat(normalized)
    : Number.parseInt(normalized.replace(/\D/g, ''), 10);

  if (!Number.isFinite(value)) {
    return minValue;
  }

  return value;
}

function clampStepperValue(value: number, minValue: number, allowDecimals: boolean): number {
  const clamped = Math.max(minValue, value);
  return allowDecimals ? Math.round(clamped * 10) / 10 : Math.round(clamped);
}

function isPartialNumericInput(text: string, allowDecimals: boolean): boolean {
  const normalized = text.replace(',', '.');
  if (normalized === '') {
    return true;
  }

  return allowDecimals ? /^[0-9]*\.?[0-9]*$/.test(normalized) : /^[0-9]*$/.test(normalized);
}

function StepperField({
  label,
  value,
  step,
  minValue,
  decreaseLabel,
  increaseLabel,
  allowDecimals,
  onChange,
  onFocus,
  onBlur,
  onDraftChange,
}: StepperFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [selectAllOnFocus, setSelectAllOnFocus] = useState(true);
  const skipNextSelectionChangeRef = useRef(false);
  const displayValue = isFocused ? draftText : formatStepperValue(value, allowDecimals);
  const minusDisabled = value <= minValue + (allowDecimals ? 0.001 : 0);
  const keyboardType = 'numbers-and-punctuation' as const;

  function commitDraft(text: string) {
    const parsed = parseStepperInput(text, minValue, allowDecimals);
    onChange(clampStepperValue(parsed, minValue, allowDecimals));
  }

  function handleBlur() {
    commitDraft(draftText);
    setIsFocused(false);
    setSelectAllOnFocus(true);
    skipNextSelectionChangeRef.current = false;
    onBlur?.();
    setDraftText('');
  }

  return (
    <View style={styles.stepperColumn}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          disabled={minusDisabled}
          style={[styles.stepperButton, minusDisabled && styles.stepperButtonDisabled]}
          onPress={() => {
            setIsFocused(false);
            setDraftText('');
            const next = Math.max(minValue, Math.round((value - step) * 10) / 10);
            onChange(next);
          }}>
          <Ionicons name="remove" size={14} color={minusDisabled ? '#9CA3AF' : '#4F46E5'} />
        </Pressable>
        <TextInput
          accessibilityLabel={label}
          keyboardType={keyboardType}
          returnKeyType="done"
          blurOnSubmit
          selectTextOnFocus={selectAllOnFocus}
          onSubmitEditing={() => Keyboard.dismiss()}
          style={[styles.stepperInput, isFocused && styles.stepperInputFocused]}
          value={displayValue}
          onBlur={handleBlur}
          onSelectionChange={() => {
            if (skipNextSelectionChangeRef.current) {
              skipNextSelectionChangeRef.current = false;
              return;
            }

            if (selectAllOnFocus) {
              setSelectAllOnFocus(false);
            }
          }}
          onChangeText={(text) => {
            if (!isPartialNumericInput(text, allowDecimals)) {
              return;
            }

            setDraftText(text);
            onDraftChange?.(text);
            const normalized = text.trim().replace(',', '.');
            if (normalized === '' || normalized === '.') {
              return;
            }

            const parsed = allowDecimals
              ? Number.parseFloat(normalized)
              : Number.parseInt(normalized.replace(/\D/g, ''), 10);

            if (Number.isFinite(parsed)) {
              onChange(clampStepperValue(parsed, minValue, allowDecimals));
            }
          }}
          onFocus={() => {
            const initialDraft = formatStepperValue(value, allowDecimals);
            setIsFocused(true);
            setDraftText(initialDraft);
            setSelectAllOnFocus(true);
            skipNextSelectionChangeRef.current = true;
            onFocus?.(initialDraft);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          style={styles.stepperButton}
          onPress={() => {
            setIsFocused(false);
            setDraftText('');
            const next = Math.round((value + step) * 10) / 10;
            onChange(next);
          }}>
          <Ionicons name="add" size={14} color="#4F46E5" />
        </Pressable>
      </View>
    </View>
  );
}

function getQuantityBarSuffix(
  unit: MealItemUnit,
  unitSystem: UnitSystem,
  t: (key: string) => string,
): string {
  if (unit === 'pcs') {
    return ` ${t('home.manualEntry.unitCount')}`;
  }

  if (unitSystem === 'imperial') {
    return unit === 'ml' ? ' fl oz' : ' oz';
  }

  return unit === 'ml' ? ' ml' : ' g';
}

function formatQuantityBarValue(draftText: string, unit: MealItemUnit, unitSystem: UnitSystem, t: (key: string) => string): string {
  const trimmed = draftText.trim();
  if (trimmed === '' || trimmed === '.') {
    return `0${getQuantityBarSuffix(unit, unitSystem, t)}`;
  }

  return `${trimmed}${getQuantityBarSuffix(unit, unitSystem, t)}`;
}

function formatKcalBarValue(draftText: string): string {
  const trimmed = draftText.trim();
  if (trimmed === '' || trimmed === '.') {
    return '0 kcal';
  }

  return `${trimmed} kcal`;
}

export function MealItemRow({
  item,
  onChangeName,
  onChangeUnit,
  onChangeQuantity,
  onChangeKcal,
  onRemove,
  invalid = false,
}: MealItemRowProps) {
  const { t } = useTranslation();
  const mealInputBarActions = useMealInputBarActions();
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const [nameFocused, setNameFocused] = useState(false);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  const displayQuantity = toDisplay(item.quantity, item.unit, unitSystem);
  const quantityStep = getQuantityStep(item.unit, unitSystem);
  const minDisplayQuantity = getMinDisplayQuantity(item.unit, unitSystem);
  const allowDecimalQuantity = unitSystem === 'imperial' && item.unit !== 'pcs';
  const productName = item.name.trim() || t('home.manualEntry.namePlaceholder');
  const pcsAvailable = isPcsUnitAvailable(item);
  const currentUnitSegment =
    item.unit === 'g' ? 'grams' : item.unit === 'ml' ? 'ml' : 'count';

  const unitSegments =
    unitSystem === 'imperial'
      ? [
          { id: 'grams', label: t('home.manualEntry.unitOz') },
          { id: 'ml', label: t('home.manualEntry.unitFlOz') },
          { id: 'count', label: t('home.manualEntry.unitCount') },
        ]
      : [
          { id: 'grams', label: t('home.manualEntry.unitGrams') },
          { id: 'ml', label: t('home.manualEntry.unitMl') },
          { id: 'count', label: t('home.manualEntry.unitCount') },
        ];

  function handleQuantityDisplayChange(displayValue: number) {
    const stored = fromDisplay(displayValue, item.unit, unitSystem);
    onChangeQuantity(item.id, stored);
  }

  function activateField(field: MealStepperField, displayValue: string) {
    mealInputBarActions?.setActiveField({
      itemId: item.id,
      field,
      productName:
        field === 'name' ? t('home.manualEntry.namePlaceholder') : productName,
      fieldLabel:
        field === 'quantity'
          ? t('home.mealItemRow.quantityLabel')
          : field === 'kcal'
            ? t('home.mealItemRow.kcalLabel')
            : t('home.manualEntry.nameLabel'),
      displayValue,
    });
  }

  function clearField(field: MealStepperField) {
    mealInputBarActions?.clearActiveField(item.id, field);
  }

  function handleQuantityDraftChange(draftText: string) {
    mealInputBarActions?.updateDisplayValue(
      formatQuantityBarValue(draftText, item.unit, unitSystem, t),
    );
  }

  function handleKcalDraftChange(draftText: string) {
    mealInputBarActions?.updateDisplayValue(formatKcalBarValue(draftText));
  }

  function handleNameDraftChange(name: string) {
    onChangeName(item.id, name);
    mealInputBarActions?.updateDisplayValue(name);
  }

  return (
    <View style={[styles.row, invalid && styles.rowInvalid]}>
      <View style={styles.headerRow}>
        <TextInput
          accessibilityLabel={t('home.manualEntry.namePlaceholder')}
          placeholder={t('home.manualEntry.namePlaceholder')}
          placeholderTextColor="#9CA3AF"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={() => Keyboard.dismiss()}
          style={[styles.nameInput, nameFocused && styles.nameInputFocused]}
          value={item.name}
          onBlur={() => {
            setNameFocused(false);
            clearField('name');
          }}
          onChangeText={handleNameDraftChange}
          onFocus={() => {
            setNameFocused(true);
            activateField('name', item.name);
          }}
        />
        <View style={styles.headerActions}>
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.meal.removeItem')}
              hitSlop={6}
              style={styles.removeButton}
              onPress={() => onRemove(item.id)}>
              <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
          <View style={styles.unitToggleWrap}>
            <CompactSegmentToggle
            variant="unit"
            containerStyle={styles.unitToggle}
            value={currentUnitSegment}
            disabledSegmentIds={pcsAvailable ? [] : ['count']}
            onDisabledSegmentPress={(segmentId) => {
              if (segmentId === 'count') {
                Alert.alert(
                  t('home.mealItemRow.pcsUnavailableTitle'),
                  t('home.mealItemRow.pcsUnavailableMessage'),
                );
              }
            }}
            onChange={(value) => {
              const unit: MealItemUnit =
                value === 'ml' ? 'ml' : value === 'count' ? 'pcs' : 'g';
              onChangeUnit(item.id, unit);
            }}
            segments={unitSegments}
          />
          </View>
        </View>
      </View>

      <View style={styles.steppersRow}>
        <StepperField
          allowDecimals={allowDecimalQuantity}
          decreaseLabel={t('home.scan.confirmation.decrease')}
          increaseLabel={t('home.scan.confirmation.increase')}
          label={t('home.mealItemRow.quantityLabel')}
          minValue={minDisplayQuantity}
          step={quantityStep}
          value={displayQuantity}
          onChange={handleQuantityDisplayChange}
          onBlur={() => clearField('quantity')}
          onDraftChange={handleQuantityDraftChange}
          onFocus={(draftText) =>
            activateField(
              'quantity',
              formatQuantityBarValue(draftText, item.unit, unitSystem, t),
            )
          }
        />
        <StepperField
          allowDecimals={false}
          decreaseLabel={t('home.scan.confirmation.decrease')}
          increaseLabel={t('home.scan.confirmation.increase')}
          label={t('home.mealItemRow.kcalLabel')}
          minValue={0}
          step={KCAL_STEP}
          value={item.kcal}
          onChange={(value) => onChangeKcal(item.id, value)}
          onBlur={() => clearField('kcal')}
          onDraftChange={handleKcalDraftChange}
          onFocus={(draftText) => activateField('kcal', formatKcalBarValue(draftText))}
        />
      </View>

      {isLinkedItem(item) ? (
        <Text style={styles.densityHint}>
          {t('home.mealItemRow.densityHint', {
            kcal: Math.round(item.kcalPer100g!),
            unit: getDensityUnitLabel(item.unit),
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  rowInvalid: {
    borderColor: 'rgba(220, 38, 38, 0.45)',
    backgroundColor: 'rgba(254, 242, 242, 0.55)',
  },
  removeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  nameInputFocused: {
    borderColor: '#4F46E5',
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  unitToggleWrap: {
    flexShrink: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  unitToggle: {
    marginBottom: 0,
  },
  steppersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepperColumn: {
    flex: 1,
    minWidth: 0,
  },
  stepperLabel: {
    marginBottom: 4,
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    flexShrink: 0,
  },
  stepperButtonDisabled: {
    opacity: 0.45,
  },
  stepperInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  stepperInputFocused: {
    borderColor: '#4F46E5',
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  densityHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
});
