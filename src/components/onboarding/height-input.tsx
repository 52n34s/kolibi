import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { UnitSystemToggle } from '@/components/onboarding/unit-system-toggle';
import type { UnitSystem } from '@/lib/unit-system';
import { cmToFeetInches, feetInchesToCm } from '@/lib/units';
import { useOnboardingStore } from '@/stores/onboarding-store';

type HeightInputProps = {
  heightCm: string;
  onChangeHeightCm: (value: string) => void;
};

function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function HeightInput({ heightCm, onChangeHeightCm }: HeightInputProps) {
  const { t } = useTranslation();
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const setUnitSystem = useOnboardingStore((state) => state.setUnitSystem);

  const parsedHeightCm = Number(heightCm);
  const imperialValues = useMemo(() => {
    if (!heightCm.trim() || Number.isNaN(parsedHeightCm) || parsedHeightCm <= 0) {
      return { feet: '', inches: '' };
    }

    const { feet, inches } = cmToFeetInches(parsedHeightCm);
    return { feet: String(feet), inches: String(inches) };
  }, [heightCm, parsedHeightCm]);

  function handleMetricChange(value: string) {
    onChangeHeightCm(value.replace(/[^\d]/g, ''));
  }

  function handleFeetChange(value: string) {
    const feet = parseNonNegativeInt(value.replace(/[^\d]/g, ''));
    const inches = parseNonNegativeInt(imperialValues.inches) ?? 0;

    if (feet === null) {
      onChangeHeightCm('');
      return;
    }

    onChangeHeightCm(String(feetInchesToCm(feet, inches)));
  }

  function handleInchesChange(value: string) {
    const inchesRaw = parseNonNegativeInt(value.replace(/[^\d]/g, ''));
    const feet = parseNonNegativeInt(imperialValues.feet) ?? 0;

    if (inchesRaw === null) {
      onChangeHeightCm(feet > 0 ? String(feetInchesToCm(feet, 0)) : '');
      return;
    }

    const inches = Math.min(inchesRaw, 11);
    onChangeHeightCm(String(feetInchesToCm(feet, inches)));
  }

  function handleUnitSystemChange(nextUnitSystem: UnitSystem) {
    setUnitSystem(nextUnitSystem);
  }

  return (
    <View>
      <UnitSystemToggle
        unitSystem={unitSystem}
        metricLabel={t('onboarding.units.cm')}
        imperialLabel={t('onboarding.units.ftIn')}
        onChange={handleUnitSystemChange}
      />

      {unitSystem === 'metric' ? (
        <OnboardingField
          keyboardType="number-pad"
          placeholder={t('onboarding.height.placeholderMetric')}
          value={heightCm}
          onChangeText={handleMetricChange}
        />
      ) : (
        <View style={styles.imperialRow}>
          <View style={styles.imperialField}>
            <OnboardingField
              keyboardType="number-pad"
              placeholder={t('onboarding.height.placeholderFeet')}
              value={imperialValues.feet}
              onChangeText={handleFeetChange}
            />
          </View>
          <View style={styles.imperialField}>
            <OnboardingField
              keyboardType="number-pad"
              placeholder={t('onboarding.height.placeholderInches')}
              value={imperialValues.inches}
              onChangeText={handleInchesChange}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  imperialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imperialField: {
    flex: 1,
  },
});
