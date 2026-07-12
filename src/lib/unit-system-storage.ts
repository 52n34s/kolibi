import { createMMKV } from 'react-native-mmkv';

import { getDefaultUnitSystem, type UnitSystem } from '@/lib/unit-system';

const UNIT_SYSTEM_STORAGE_KEY = 'app.unitSystem';
const storage = createMMKV({ id: 'app-settings' });

export function getStoredUnitSystem(): UnitSystem {
  const saved = storage.getString(UNIT_SYSTEM_STORAGE_KEY);
  if (saved === 'metric' || saved === 'imperial') {
    return saved;
  }

  const deviceDefault = getDefaultUnitSystem();
  storage.set(UNIT_SYSTEM_STORAGE_KEY, deviceDefault);
  return deviceDefault;
}

export function setStoredUnitSystem(unitSystem: UnitSystem) {
  storage.set(UNIT_SYSTEM_STORAGE_KEY, unitSystem);
}
