import { create } from 'zustand';

import { getStoredUnitSystem, setStoredUnitSystem } from '@/lib/unit-system-storage';
import type { UnitSystem } from '@/lib/unit-system';

type OnboardingStore = {
  unitSystem: UnitSystem;
  unitSystemInitialized: boolean;
  initializeUnitSystem: () => void;
  setUnitSystem: (unitSystem: UnitSystem) => void;
};

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  unitSystem: 'metric',
  unitSystemInitialized: false,

  initializeUnitSystem: () => {
    if (get().unitSystemInitialized) {
      return;
    }

    set({
      unitSystem: getStoredUnitSystem(),
      unitSystemInitialized: true,
    });
  },

  setUnitSystem: (unitSystem) => {
    setStoredUnitSystem(unitSystem);
    set({ unitSystem });
  },
}));
