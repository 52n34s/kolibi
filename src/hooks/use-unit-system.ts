import { useEffect } from 'react';

import type { UnitSystem } from '@/lib/unit-system';
import { useOnboardingStore } from '@/stores/onboarding-store';

/** Active unit system from MMKV-backed store (initializes on first use). */
export function useUnitSystem(): UnitSystem {
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  return unitSystem;
}
