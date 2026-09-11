import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuantityOption } from '@/components/scan/barcode-quantity-utils';
import {
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_COLORS,
  ONBOARDING_SECONDARY_SURFACE,
} from '@/components/onboarding/onboarding-styles';

const OPTION_LABEL_KEYS: Record<QuantityOption, string> = {
  whole: 'home.scan.barcode.quantity.wholePackage',
  half: 'home.scan.barcode.quantity.halfPackage',
  serving: 'home.scan.barcode.quantity.oneServing',
  custom: 'home.scan.barcode.quantity.customAmount',
};

type QuantityPresetPillsProps = {
  options: QuantityOption[];
  selected: QuantityOption;
  onSelect: (option: QuantityOption) => void;
};

/** Package / serving / custom presets — shared by the barcode and label flows. */
export function QuantityPresetPills({
  options,
  selected,
  onSelect,
}: QuantityPresetPillsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.pillWrap}>
      {options.map((option) => {
        const label = t(OPTION_LABEL_KEYS[option]);
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
