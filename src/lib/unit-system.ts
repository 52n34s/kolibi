import * as Localization from 'expo-localization';

export type UnitSystem = 'metric' | 'imperial';

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export function getDefaultUnitSystem(): UnitSystem {
  const regionCode = Localization.getLocales()[0]?.regionCode?.toUpperCase();

  if (regionCode && IMPERIAL_REGIONS.has(regionCode)) {
    return 'imperial';
  }

  return 'metric';
}
