import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import type { NameFieldAnchor } from '@/components/scan/FoodNameAutocompleteDropdown';
import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import { BRAND_INDIGO } from '@/constants/brand';
import {
  type MealStepperField,
  useMealInputBarActions,
} from '@/components/scan/meal-input-bar-context';
import {
  getDensityUnitLabel,
  isLinkedItem,
  isPcsUnitAvailable,
  KCAL_STEP,
  type MealItemMacroKey,
  type MealItemRowItem,
  type MealItemUnit,
} from '@/components/scan/meal-item-row-model';
import {
  fromDisplay,
  getMinDisplayQuantity,
  getQuantityStep,
  toDisplay,
} from '@/lib/units';
import { isPartialNumericInput } from '@/lib/numeric-input';
import { formatKcal, formatMacroGrams } from '@/utils/format';

export type MealItemRowProps = {
  item: MealItemRowItem;
  onChangeName: (id: string, name: string) => void;
  onChangeUnit: (id: string, unit: MealItemUnit) => void;
  onChangeQuantity: (id: string, value: number) => void;
  onChangeKcal: (id: string, value: number) => void;
  onChangeMacro: (id: string, key: MealItemMacroKey, value: number | null) => void;
  onRemove?: (id: string) => void;
  invalid?: boolean;
  onNameFieldFocus?: (id: string, anchor: NameFieldAnchor) => void;
  onQuantityFieldFocus?: (id: string) => void;
  onKcalFieldFocus?: (id: string) => void;
  remeasureTrigger?: number;
  /** Parent-driven focus for the name field — see ManualMealEntrySheet's autofocus. */
  shouldFocusName?: boolean;
  onNameFocusHandled?: () => void;
  /** Warning shown directly above the density line, e.g. a failed label check. */
  notice?: string | null;
  /** Small grey lines under the product name (barcode OFF hints). */
  metaHints?: string[];
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
  testID?: string;
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
  testID,
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
          testID={testID}
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

function formatMacroDisplay(value: number | null): string {
  if (value == null) {
    return '';
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function parseMacroInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') {
    return null;
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

type MacroNumberFieldProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
};

function MacroNumberField({ label, value, onChange }: MacroNumberFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [selectAllOnFocus, setSelectAllOnFocus] = useState(true);
  const skipNextSelectionChangeRef = useRef(false);
  const displayValue = isFocused ? draftText : formatMacroDisplay(value);

  function commitDraft(text: string) {
    onChange(parseMacroInput(text));
  }

  return (
    <View style={styles.macroField}>
      <Text style={styles.macroLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        blurOnSubmit
        selectTextOnFocus={selectAllOnFocus}
        onSubmitEditing={() => Keyboard.dismiss()}
        style={[styles.macroInput, isFocused && styles.macroInputFocused]}
        value={displayValue}
        placeholder="—"
        placeholderTextColor="#9CA3AF"
        onBlur={() => {
          commitDraft(draftText);
          setIsFocused(false);
          setSelectAllOnFocus(true);
          skipNextSelectionChangeRef.current = false;
          setDraftText('');
        }}
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
          if (!isPartialNumericInput(text, true)) {
            return;
          }

          setDraftText(text);
          const normalized = text.trim().replace(',', '.');
          if (normalized === '') {
            onChange(null);
            return;
          }
          if (normalized === '.') {
            return;
          }

          const parsed = Number.parseFloat(normalized);
          if (Number.isFinite(parsed) && parsed >= 0) {
            onChange(Math.round(parsed * 10) / 10);
          }
        }}
        onFocus={() => {
          const initialDraft = formatMacroDisplay(value);
          setIsFocused(true);
          setDraftText(initialDraft);
          setSelectAllOnFocus(true);
          skipNextSelectionChangeRef.current = true;
        }}
      />
    </View>
  );
}

/**
 * Label rows show the full transcribed column ("pro 100 g: 298 kcal · 7,6 P · …");
 * values the label did not print are left out.
 */
function formatLabelDensityValues(
  item: MealItemRowItem,
  t: (key: string) => string,
  language: string,
): string {
  const parts = [`${formatKcal(item.kcalPer100g ?? 0)} ${t('home.mealItemRow.kcalLabel')}`];
  const macros = item.macrosPer100g;

  const push = (value: number | null | undefined, abbrevKey: string) => {
    if (value == null) {
      return;
    }
    parts.push(`${formatMacroGrams(value, language)} ${t(abbrevKey)}`);
  };

  push(macros?.protein, 'home.mealItemRow.nutrientsAbbrevProtein');
  push(macros?.carbs, 'home.mealItemRow.nutrientsAbbrevCarbs');
  push(macros?.fat, 'home.mealItemRow.nutrientsAbbrevFat');
  push(macros?.fiber, 'home.mealItemRow.nutrientsAbbrevFiber');

  return parts.join(' · ');
}

function formatCollapsedNutrientsSummary(
  item: MealItemRowItem,
  t: (key: string) => string,
): string | null {
  const parts: string[] = [];
  if (item.proteinG != null) {
    parts.push(`${Math.round(item.proteinG)} ${t('home.mealItemRow.nutrientsAbbrevProtein')}`);
  }
  if (item.carbsG != null) {
    parts.push(`${Math.round(item.carbsG)} ${t('home.mealItemRow.nutrientsAbbrevCarbs')}`);
  }
  if (item.fatG != null) {
    parts.push(`${Math.round(item.fatG)} ${t('home.mealItemRow.nutrientsAbbrevFat')}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function getQuantityBarSuffix(unit: MealItemUnit, t: (key: string) => string): string {
  if (unit === 'pcs') {
    return ` ${t('home.manualEntry.unitCount')}`;
  }

  return unit === 'ml' ? ' ml' : ' g';
}

function formatQuantityBarValue(
  draftText: string,
  unit: MealItemUnit,
  t: (key: string) => string,
): string {
  const trimmed = draftText.trim();
  if (trimmed === '' || trimmed === '.') {
    return `0${getQuantityBarSuffix(unit, t)}`;
  }

  return `${trimmed}${getQuantityBarSuffix(unit, t)}`;
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
  onChangeMacro,
  onRemove,
  invalid = false,
  onNameFieldFocus,
  onQuantityFieldFocus,
  onKcalFieldFocus,
  remeasureTrigger = 0,
  shouldFocusName = false,
  onNameFocusHandled,
  notice = null,
  metaHints,
}: MealItemRowProps) {
  const { t, i18n } = useTranslation();
  const mealInputBarActions = useMealInputBarActions();
  const [nameFocused, setNameFocused] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [nutrientsExpanded, setNutrientsExpanded] = useState(false);
  const lastSentNameRef = useRef(item.name);
  const nameInputWrapRef = useRef<View>(null);
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (item.name === lastSentNameRef.current) {
      return;
    }

    lastSentNameRef.current = item.name;
    setNameDraft(item.name);
  }, [item.name]);

  function reportNameAnchor() {
    nameInputWrapRef.current?.measureInWindow((x, y, width, height) => {
      onNameFieldFocus?.(item.id, { x, y, width, height });
    });
  }

  useEffect(() => {
    if (!nameFocused) {
      return;
    }

    reportNameAnchor();
  }, [nameFocused, remeasureTrigger, item.id]);

  // One frame of delay so the row is laid out before focus() — otherwise the
  // anchor measured in onFocus is stale and the dropdown lands in the wrong place.
  useEffect(() => {
    if (!shouldFocusName) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      onNameFocusHandled?.();
    });

    return () => cancelAnimationFrame(frame);
  }, [shouldFocusName, onNameFocusHandled]);

  const displayQuantity = toDisplay(item.quantity, item.unit);
  const quantityStep = getQuantityStep(item.unit);
  const minDisplayQuantity = getMinDisplayQuantity(item.unit);
  const allowDecimalQuantity = false;
  const productName = item.name.trim() || t('home.manualEntry.namePlaceholder');
  const pcsAvailable = isPcsUnitAvailable(item);
  const currentUnitSegment =
    item.unit === 'g' ? 'grams' : item.unit === 'ml' ? 'ml' : 'count';

  const unitSegments = [
    { id: 'grams', label: t('home.manualEntry.unitGrams') },
    { id: 'ml', label: t('home.manualEntry.unitMl') },
    { id: 'count', label: t('home.manualEntry.unitCount') },
  ];

  function handleQuantityDisplayChange(displayValue: number) {
    const stored = fromDisplay(displayValue, item.unit);
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
      caretIndex: displayValue.length,
    });
  }

  function clearField(field: MealStepperField) {
    mealInputBarActions?.clearActiveField(item.id, field);
  }

  function handleQuantityDraftChange(draftText: string) {
    mealInputBarActions?.updateDisplayValue(formatQuantityBarValue(draftText, item.unit, t));
  }

  function handleKcalDraftChange(draftText: string) {
    mealInputBarActions?.updateDisplayValue(formatKcalBarValue(draftText));
  }

  function handleNameDraftChange(name: string) {
    lastSentNameRef.current = name;
    setNameDraft(name);
    onChangeName(item.id, name);
    mealInputBarActions?.updateDisplayValue(name);
  }

  function handleNameSelectionChange(
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) {
    const { start, end } = event.nativeEvent.selection;
    mealInputBarActions?.updateCaretIndex(start === end ? start : end);
  }

  return (
    <View style={[styles.row, invalid && styles.rowInvalid]}>
      <View style={styles.headerRow}>
        <View ref={nameInputWrapRef} style={styles.nameInputWrap} collapsable={false}>
          <TextInput
            testID="home.manualEntry.nameInput"
            ref={nameInputRef}
            accessibilityLabel={t('home.manualEntry.namePlaceholder')}
            placeholder={t('home.manualEntry.namePlaceholder')}
            placeholderTextColor="#9CA3AF"
            cursorColor={BRAND_INDIGO}
            selectionColor={BRAND_INDIGO}
            multiline
            numberOfLines={2}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
            style={[styles.nameInput, nameFocused && styles.nameInputFocused]}
            value={nameDraft}
            onBlur={() => {
              setNameFocused(false);
              clearField('name');
            }}
            onChangeText={handleNameDraftChange}
            onSelectionChange={handleNameSelectionChange}
            onFocus={() => {
              setNameFocused(true);
              activateField('name', nameDraft);
              reportNameAnchor();
            }}
          />
        </View>
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
            testIDPrefix="home.manualEntry.unit"
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

      {metaHints != null && metaHints.length > 0 ? (
        <View style={styles.metaHints}>
          {metaHints.map((hint) => (
            <Text key={hint} style={styles.metaHint}>
              {hint}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.steppersRow}>
        <StepperField
          testID="home.manualEntry.quantityInput"
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
          onFocus={(draftText) => {
            onQuantityFieldFocus?.(item.id);
            activateField(
              'quantity',
              formatQuantityBarValue(draftText, item.unit, t),
            );
          }}
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
          onFocus={(draftText) => {
            onKcalFieldFocus?.(item.id);
            activateField('kcal', formatKcalBarValue(draftText));
          }}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: nutrientsExpanded }}
        style={styles.nutrientsToggle}
        onPress={() => setNutrientsExpanded((current) => !current)}>
        <View style={styles.nutrientsToggleText}>
          <Text style={styles.nutrientsToggleTitle}>{t('home.mealItemRow.nutrientsToggle')}</Text>
          <Text style={styles.nutrientsToggleSummary}>
            {formatCollapsedNutrientsSummary(item, t) ?? t('home.mealItemRow.nutrientsEmpty')}
          </Text>
        </View>
        <Ionicons
          name={nutrientsExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#6B7280"
        />
      </Pressable>

      {nutrientsExpanded ? (
        <View style={styles.macrosGrid}>
          <MacroNumberField
            label={t('home.mealItemRow.proteinLabel')}
            value={item.proteinG}
            onChange={(value) => onChangeMacro(item.id, 'protein', value)}
          />
          <MacroNumberField
            label={t('home.mealItemRow.carbsLabel')}
            value={item.carbsG}
            onChange={(value) => onChangeMacro(item.id, 'carbs', value)}
          />
          <MacroNumberField
            label={t('home.mealItemRow.fatLabel')}
            value={item.fatG}
            onChange={(value) => onChangeMacro(item.id, 'fat', value)}
          />
          <MacroNumberField
            label={t('home.mealItemRow.fiberLabel')}
            value={item.fiberG}
            onChange={(value) => onChangeMacro(item.id, 'fiber', value)}
          />
        </View>
      ) : null}

      {notice ? <Text style={styles.densityNotice}>{notice}</Text> : null}

      {isLinkedItem(item) ? (
        <Text style={styles.densityHint}>
          {item.kcalPer100gSource === 'label'
            ? t('home.mealItemRow.labelDensityHint', {
                unit: getDensityUnitLabel(item.unit),
                values: formatLabelDensityValues(item, t, i18n.language),
              })
            : t('home.mealItemRow.densityHint', {
                kcal: formatKcal(item.kcalPer100g!),
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
    alignItems: 'flex-start',
    gap: 8,
  },
  metaHints: {
    gap: 2,
    marginTop: -2,
    marginBottom: 2,
  },
  metaHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  nameInputWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  nameInput: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    maxHeight: 50,
    fontWeight: '600',
    color: '#111827',
    textAlignVertical: 'top',
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
  densityNotice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
    textAlign: 'center',
  },
  nutrientsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  nutrientsToggleText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  nutrientsToggleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  nutrientsToggleSummary: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  macroField: {
    width: '47%',
    flexGrow: 1,
    minWidth: 120,
  },
  macroLabel: {
    marginBottom: 4,
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  macroInput: {
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  macroInputFocused: {
    borderColor: '#4F46E5',
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
});
