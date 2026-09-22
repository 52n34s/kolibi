import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { UnitSystemToggle } from '@/components/onboarding/unit-system-toggle';
import type { UnitSystem } from '@/lib/unit-system';
import { kgToLbs } from '@/lib/units';
import { parseWeightInputToKg } from '@/lib/weight-parse';
import { useOnboardingStore } from '@/stores/onboarding-store';

type WeightInputProps = {
  /** Always stored as kilograms (same idea as HeightInput's cm). */
  weightKg: string;
  onChangeWeightKg: (value: string) => void;
};

export function WeightInput({ weightKg, onChangeWeightKg }: WeightInputProps) {
  const { t } = useTranslation();
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const setUnitSystem = useOnboardingStore((state) => state.setUnitSystem);

  const parsedKg = Number(weightKg);
  const displayValue = useMemo(() => {
    if (!weightKg.trim() || Number.isNaN(parsedKg) || parsedKg <= 0) {
      return '';
    }
    if (unitSystem === 'imperial') {
      return String(kgToLbs(parsedKg));
    }
    return weightKg;
  }, [parsedKg, unitSystem, weightKg]);

  function handleChange(value: string) {
    const cleaned = value.replace(/[^\d.,]/g, '');
    if (!cleaned.trim()) {
      onChangeWeightKg('');
      return;
    }

    if (unitSystem === 'imperial') {
      const kg = parseWeightInputToKg({ value: cleaned, unitSystem: 'imperial' });
      onChangeWeightKg(kg == null ? '' : String(kg));
      return;
    }

    onChangeWeightKg(cleaned.replace(',', '.'));
  }

  function handleUnitSystemChange(next: UnitSystem) {
    setUnitSystem(next);
  }

  return (
    <View>
      <UnitSystemToggle
        unitSystem={unitSystem}
        metricLabel={t('onboarding.units.kg')}
        imperialLabel={t('onboarding.units.lbs')}
        onChange={handleUnitSystemChange}
      />
      <OnboardingField
        keyboardType="numeric"
        placeholder={
          unitSystem === 'imperial'
            ? t('onboarding.weight.placeholderImperial')
            : t('onboarding.weight.placeholderMetric')
        }
        value={displayValue}
        onChangeText={handleChange}
      />
    </View>
  );
}
