import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuantityOption, QuantityPresetSource } from '@/components/scan/barcode-quantity-utils';
import { resolveValidServingGrams } from '@/components/scan/barcode-quantity-utils';
import {
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_COLORS,
  ONBOARDING_SECONDARY_SURFACE,
} from '@/components/onboarding/onboarding-styles';

type QuantityPresetPillsProps = {
  options: QuantityOption[];
  selected: QuantityOption | null;
  product: QuantityPresetSource;
  onSelect: (option: QuantityOption) => void;
};

function optionLabel(
  option: QuantityOption,
  product: QuantityPresetSource,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (option) {
    case 'whole':
      return t('home.scan.barcode.quantity.wholePackage');
    case 'half':
      return t('home.scan.barcode.quantity.halfPackage');
    case 'serving': {
      const grams = resolveValidServingGrams(product.servingSizeGrams, product.quantityGrams);
      if (grams == null) {
        return t('home.scan.barcode.quantity.oneServing');
      }
      return t('home.scan.barcode.quantity.oneServingWithAmount', { grams });
    }
    case 'piece':
      return t('home.scan.barcode.quantity.onePiece');
  }
}

/** Package / serving / piece presets — shared by the barcode and label flows. */
export function QuantityPresetPills({
  options,
  selected,
  product,
  onSelect,
}: QuantityPresetPillsProps) {
  const { t } = useTranslation();

  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.pillWrap}>
      {options.map((option) => {
        const label = optionLabel(option, product, t);
        const isActive = selected === option;

        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelect(option)}>
            <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
