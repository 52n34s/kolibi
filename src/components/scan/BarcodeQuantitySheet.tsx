import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import {
  getAvailableQuantityOptions,
  getDefaultCustomGrams,
  getDefaultOption,
  getQuantityGramsForOption,
  MIN_GRAMS,
  type QuantityOption,
} from '@/components/scan/barcode-quantity-utils';
import {
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_COLORS,
  ONBOARDING_SECONDARY_SURFACE,
} from '@/components/onboarding/onboarding-styles';
import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';

type BarcodeQuantitySheetProps = {
  visible: boolean;
  product: BarcodeProduct | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (params: { quantityGrams: number }) => void;
};

const GRAM_STEP = 10;
const DEFAULT_CUSTOM_GRAMS = 100;

function scaleKcal(kcalPer100g: number, quantityGrams: number): number {
  return Math.max(0, Math.round((kcalPer100g / 100) * quantityGrams));
}

export function BarcodeQuantitySheet({
  visible,
  product,
  isSaving,
  onClose,
  onSave,
}: BarcodeQuantitySheetProps) {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<QuantityOption>('custom');
  const [customGrams, setCustomGrams] = useState(DEFAULT_CUSTOM_GRAMS);

  useEffect(() => {
    if (visible && product) {
      setSelectedOption(getDefaultOption(product));
      setCustomGrams(getDefaultCustomGrams(product, DEFAULT_CUSTOM_GRAMS));
    }
  }, [product, visible]);

  const availableOptions = useMemo(() => {
    if (!product) {
      return [] as QuantityOption[];
    }

    return getAvailableQuantityOptions(product);
  }, [product]);

  const quantityGrams = useMemo(() => {
    if (!product) {
      return 0;
    }

    return getQuantityGramsForOption(selectedOption, product, customGrams);
  }, [customGrams, product, selectedOption]);

  const totalKcal = useMemo(() => {
    if (!product) {
      return 0;
    }

    return scaleKcal(product.kcalPer100g, quantityGrams);
  }, [product, quantityGrams]);

  function adjustCustomGrams(direction: 1 | -1) {
    setSelectedOption('custom');
    setCustomGrams((current) => Math.max(MIN_GRAMS, current + direction * GRAM_STEP));
  }

  function handleOptionPress(option: QuantityOption) {
    setSelectedOption(option);
  }

  function handleSavePress() {
    if (quantityGrams <= 0) {
      return;
    }

    onSave({ quantityGrams });
  }

  if (!product) {
    return null;
  }

  const optionLabels: Record<QuantityOption, string> = {
    whole: t('home.scan.barcode.quantity.wholePackage'),
    half: t('home.scan.barcode.quantity.halfPackage'),
    serving: t('home.scan.barcode.quantity.oneServing'),
    custom: t('home.scan.barcode.quantity.customAmount'),
  };

  return (
    <GlassBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.productName}>{product.productName}</Text>

      <Text style={styles.totalKcal}>{totalKcal}</Text>
      <Text style={styles.totalLabel}>{t('home.scan.confirmation.totalKcal')}</Text>

      <View style={styles.pillWrap}>
        {availableOptions.map((option) => {
          const isActive = selectedOption === option;

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={optionLabels[option]}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => handleOptionPress(option)}>
              <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
                {optionLabels[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedOption === 'custom' ? (
        <View style={styles.customRow}>
          <Text style={styles.customLabel}>
            {t('home.scan.barcode.quantity.gramsValue', { value: customGrams })}
          </Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.scan.confirmation.decrease')}
              style={styles.stepperButton}
              onPress={() => adjustCustomGrams(-1)}>
              <Ionicons name="remove" size={18} color="#4F46E5" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.scan.confirmation.increase')}
              style={styles.stepperButton}
              onPress={() => adjustCustomGrams(1)}>
              <Ionicons name="add" size={18} color="#4F46E5" />
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.selectedQuantity}>
          {t('home.scan.barcode.quantity.gramsValue', { value: quantityGrams })}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.barcode.save')}
        disabled={isSaving || quantityGrams <= 0}
        style={[styles.saveShell, (isSaving || quantityGrams <= 0) && styles.saveDisabled]}
        onPress={handleSavePress}>
        <LinearGradient
          colors={['#4F46E5', '#7CE7C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.saveGradient}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveLabel}>{t('home.scan.barcode.save')}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  productName: {
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
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
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 4,
    borderRadius: ONBOARDING_SECONDARY_SURFACE.borderRadius,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: ONBOARDING_CARD_COLORS.border,
  },
  pill: {
    borderRadius: ONBOARDING_SECONDARY_SURFACE.borderRadius - 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: ONBOARDING_ACCENT,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillLabelActive: {
    color: '#FFFFFF',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  selectedQuantity: {
    marginBottom: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
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
