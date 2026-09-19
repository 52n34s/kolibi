import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInput as TextInputType,
} from 'react-native';

import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';
import {
  BirthDatePickerModal,
  openBirthDatePickerAndroid,
} from '@/components/onboarding/birth-date-picker';
import { GLASS_SURFACE } from '@/components/ui/glass-styles';
import { TEXT_SECONDARY } from '@/constants/brand';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { localDateKey } from '@/lib/day-window';
import {
  NUMERIC_DONE_INPUT_PROPS,
  isPartialNumericInput,
  resolveNumericKeyboardType,
} from '@/lib/numeric-input';
import { formatAppDate } from '@/lib/onboarding';
import type { UnitSystem } from '@/lib/unit-system';

export type WeightInputSheetProps = {
  visible: boolean;
  title: string;
  /** Shown only when today already has a weight log (replace hint). */
  subtitle?: string | null;
  unitSystem: UnitSystem;
  value: string;
  waistValue: string;
  bodyFatValue: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onWaistChange: (value: string) => void;
  onBodyFatChange: (value: string) => void;
  onClose: () => void;
  onSave: (loggedOn: string) => void;
  /** Fired only when the user picks another day. */
  onLoggedDateChange?: (loggedOn: string) => void;
};

export function WeightInputSheet({
  visible,
  title,
  subtitle,
  unitSystem,
  value,
  waistValue,
  bodyFatValue,
  isSaving,
  onChange,
  onWaistChange,
  onBodyFatChange,
  onClose,
  onSave,
  onLoggedDateChange,
}: WeightInputSheetProps) {
  const { t, i18n } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const inputRef = useRef<TextInputType>(null);
  const keyboardHeight = useKeyboardHeight();
  const maxSheetHeight = windowHeight * 0.88;
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, [visible]);
  const minimumDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 30);
    return date;
  }, [today]);
  const [loggedDate, setLoggedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isToday = localDateKey(loggedDate) === localDateKey(today);
  const saveLabel = isToday
    ? t('settings.common.save')
    : t('home.weight.saveForDate', {
        date: loggedDate.toLocaleDateString(i18n.language, {
          day: 'numeric',
          month: 'long',
        }),
      });

  // Prefill on open lives in the parent. Calling it from here re-ran the effect
  // on every unstable-callback render and overwrote what the user was typing.
  useEffect(() => {
    if (!visible) {
      return;
    }

    setLoggedDate(today);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- today is memoised on visible
  }, [visible]);

  function updateLoggedDate(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    setLoggedDate(next);
    onLoggedDateChange?.(localDateKey(next));
  }

  function openDatePicker() {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: loggedDate,
        minimumDate,
        maximumDate: today,
        onChange: updateLoggedDate,
      });
      return;
    }
    setShowDatePicker(true);
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
      {visible ? (
        <View style={styles.overlayRoot}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <Pressable
              style={[
                styles.sheetShell,
                { maxHeight: maxSheetHeight, bottom: keyboardHeight },
              ]}
              onPress={(event) => event.stopPropagation()}>
              <GlassSheetSurface
                maxHeight={maxSheetHeight}
                contentStyle={styles.sheetContent}
                tintOpacity={0.52}
                blurIntensity={64}>
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.common.cancel')}
                    hitSlop={12}
                    onPress={onClose}
                    style={styles.closeButton}>
                    <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                  </Pressable>
                </View>
                <View style={styles.body}>
                  {subtitle && isToday ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                  <TextInput
                    ref={inputRef}
                    keyboardType={resolveNumericKeyboardType('decimal-pad')}
                    placeholder={
                      unitSystem === 'imperial'
                        ? t('home.weight.placeholderLbs')
                        : t('home.weight.placeholderKg')
                    }
                    placeholderTextColor={TEXT_SECONDARY}
                    style={styles.input}
                    value={value}
                    onChangeText={(text) => {
                      if (!isPartialNumericInput(text, true)) {
                        return;
                      }

                      onChange(text);
                    }}
                    {...NUMERIC_DONE_INPUT_PROPS}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('home.weight.dateLabel')}
                    style={styles.dateRow}
                    onPress={openDatePicker}>
                    <Text style={styles.dateLabel}>{t('home.weight.dateLabel')}</Text>
                    <View style={styles.dateValueGroup}>
                      <Text style={styles.dateValue}>
                        {formatAppDate(loggedDate, i18n.language)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
                    </View>
                  </Pressable>
                  <Text style={styles.optionalLabel}>{t('home.weight.waistLabel')}</Text>
                  <TextInput
                    keyboardType={resolveNumericKeyboardType('decimal-pad')}
                    placeholder={
                      unitSystem === 'imperial'
                        ? t('home.weight.waistPlaceholderIn')
                        : t('home.weight.waistPlaceholder')
                    }
                    placeholderTextColor={TEXT_SECONDARY}
                    style={styles.inputTight}
                    value={waistValue}
                    onChangeText={(text) => {
                      if (!isPartialNumericInput(text, true)) {
                        return;
                      }

                      onWaistChange(text);
                    }}
                    {...NUMERIC_DONE_INPUT_PROPS}
                  />
                  <Text style={styles.hint}>{t('home.weight.waistHint')}</Text>
                  <Text style={styles.optionalLabel}>{t('home.weight.bodyFatLabel')}</Text>
                  <TextInput
                    keyboardType={resolveNumericKeyboardType('decimal-pad')}
                    placeholder={t('home.weight.bodyFatPlaceholder')}
                    placeholderTextColor={TEXT_SECONDARY}
                    style={styles.input}
                    value={bodyFatValue}
                    onChangeText={(text) => {
                      if (!isPartialNumericInput(text, true)) {
                        return;
                      }

                      onBodyFatChange(text);
                    }}
                    {...NUMERIC_DONE_INPUT_PROPS}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={saveLabel}
                    disabled={isSaving}
                    style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                    onPress={() => onSave(localDateKey(loggedDate))}>
                    {isSaving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveLabel}>{saveLabel}</Text>
                    )}
                  </Pressable>
                </View>
              </GlassSheetSurface>
            </Pressable>
          </View>
        </View>
      ) : null}
      <BirthDatePickerModal
        visible={showDatePicker}
        value={loggedDate}
        minimumDate={minimumDate}
        maximumDate={today}
        title={t('home.weight.datePickerTitle')}
        onChange={updateLoggedDate}
        onClose={() => setShowDatePicker(false)}
      />
    </Modal>
  );
}

/** @deprecated Use WeightInputSheet */
export const WeightUpdateSheet = WeightInputSheet;

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlay: {
    flex: 1,
  },
  sheetShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
  },
  sheetContent: {
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  input: {
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: GLASS_SURFACE.borderWidth,
  },
  inputTight: {
    marginBottom: 6,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: GLASS_SURFACE.borderWidth,
  },
  hint: {
    marginBottom: 16,
    fontSize: 13,
    fontWeight: '400',
    color: TEXT_SECONDARY,
  },
  optionalLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  dateRow: {
    minHeight: 48,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: GLASS_SURFACE.borderWidth,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  dateValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateValue: {
    fontSize: 16,
    color: TEXT_SECONDARY,
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
