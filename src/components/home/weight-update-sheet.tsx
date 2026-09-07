import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInput as TextInputType,
} from 'react-native';

import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';
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
  const { height: windowHeight } = useWindowDimensions();
  const inputRef = useRef<TextInputType>(null);
  const maxSheetHeight = windowHeight * 0.88;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
      {visible ? (
        <View style={styles.overlayRoot}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <Pressable
              style={[styles.sheetShell, { maxHeight: maxSheetHeight }]}
              onPress={(event) => event.stopPropagation()}>
              <GlassSheetSurface
                maxHeight={maxSheetHeight}
                contentStyle={styles.sheetContent}>
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.common.cancel')}
                    hitSlop={12}
                    onPress={onClose}
                    style={styles.closeButton}>
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </Pressable>
                </View>
                <View style={styles.body}>
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
              </GlassSheetSurface>
            </Pressable>
          </View>
        </View>
      ) : null}
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
    justifyContent: 'flex-end',
  },
  sheetShell: {
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
    color: '#6B7280',
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
