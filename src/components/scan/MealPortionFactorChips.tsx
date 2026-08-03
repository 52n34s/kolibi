import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_COLORS,
  ONBOARDING_SECONDARY_SURFACE,
} from '@/components/onboarding/onboarding-styles';

export const MEAL_PORTION_FACTOR_OPTIONS = [
  { factor: 1, labelKey: 'home.scan.portion.all' },
  { factor: 0.75, labelKey: 'home.scan.portion.mostly' },
  { factor: 0.5, labelKey: 'home.scan.portion.half' },
  { factor: 0.33, labelKey: 'home.scan.portion.third' },
] as const;

export function normalizeMealPortionFactor(value: number): number {
  const match = MEAL_PORTION_FACTOR_OPTIONS.find(
    (option) => Math.abs(option.factor - value) < 0.005,
  );
  return match?.factor ?? 1;
}

type MealPortionFactorChipsProps = {
  value: number;
  onChange: (factor: number) => void;
};

export function MealPortionFactorChips({ value, onChange }: MealPortionFactorChipsProps) {
  const { t } = useTranslation();
  const activeFactor = normalizeMealPortionFactor(value);

  return (
    <View style={styles.pillWrap}>
      {MEAL_PORTION_FACTOR_OPTIONS.map((option) => {
        const isActive = option.factor === activeFactor;

        return (
          <Pressable
            key={option.labelKey}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(option.labelKey)}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onChange(option.factor)}>
            <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
              {t(option.labelKey)}
            </Text>
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
