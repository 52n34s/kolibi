import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { GLASS_SURFACE } from '@/components/ui/glass-styles';
import {
  NUMERIC_DONE_INPUT_PROPS,
  isPartialNumericInput,
  resolveNumericKeyboardType,
} from '@/lib/numeric-input';
import type { UnitSystem } from '@/lib/unit-system';

export type WeightInputSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  unitSystem: UnitSystem;
  value: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function WeightInputSheet({
  visible,
  title,
  subtitle,
  unitSystem,
  value,
  isSaving,
  onChange,
  onClose,
  onSave,
}: WeightInputSheetProps) {
  const { t } = useTranslation();
  const inputRef = useRef<TextInputType>(null);
  const [shouldFocus, setShouldFocus] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShouldFocus(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!shouldFocus) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [shouldFocus]);

  return (
    <GlassBottomSheet
      visible={visible}
      presentation="center"
      onClose={onClose}
      onShow={() => setShouldFocus(true)}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <TextInput
          ref={inputRef}
          keyboardType={resolveNumericKeyboardType('decimal-pad')}
          placeholder={
            unitSystem === 'imperial'
              ? t('home.weight.placeholderLbs')
              : t('home.weight.placeholderKg')
          }
          placeholderTextColor="#9CA3AF"
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
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.common.cancel')}
            style={styles.cancelButton}
            onPress={onClose}>
            <Text style={styles.cancelLabel}>{t('settings.common.cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.common.save')}
            disabled={isSaving}
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={onSave}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveLabel}>{t('settings.common.save')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </GlassBottomSheet>
  );
}

/** @deprecated Use WeightInputSheet */
export const WeightUpdateSheet = WeightInputSheet;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  saveButton: {
    minWidth: 88,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
