import { Platform, type ViewStyle } from 'react-native';
import { isGlassEffectAPIAvailable } from 'expo-glass-effect';

import { GLASS_BORDER, GLASS_BORDER_TOP } from '@/constants/brand';

export const GLASS_CARD_RADIUS = 16;

/** Shared frosted-glass surface tokens used app-wide. */
export const GLASS_SURFACE = {
  backgroundColor: 'rgba(79, 70, 229, 0.07)',
  borderColor: GLASS_BORDER,
  borderTopColor: GLASS_BORDER_TOP,
  borderWidth: 1,
  shadowColor: '#312E81',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.14,
  shadowRadius: 20,
  elevation: 4,
} as const;

/** Pressed-state glass — darkens surface without dimming blur via container opacity. */
export const GLASS_SURFACE_PRESSED = {
  backgroundColor: 'rgba(255, 255, 255, 0.28)',
} as const;

export function getGlassCardStyle(overrides?: ViewStyle): ViewStyle {
  return {
    ...GLASS_SURFACE,
    borderRadius: GLASS_CARD_RADIUS,
    overflow: 'hidden',
    ...overrides,
  };
}

/** Subtle divider inside glass settings cards — avoids solid gray bands. */
export const SETTINGS_GLASS_DIVIDER_CLASS = 'border-indigo-600/15';

/** Circular glass surface for icon buttons (e.g. Koli menu). */
export function getGlassPillStyle(size = 40): ViewStyle {
  return getGlassCardStyle({
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderColor: GLASS_BORDER,
    borderTopColor: GLASS_BORDER_TOP,
  });
}

/** Slightly stronger glass for selected/onboarding active states. */
export function getGlassCardSelectedStyle(overrides?: ViewStyle): ViewStyle {
  return getGlassCardStyle({
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    borderColor: 'rgba(255, 255, 255, 0.88)',
    ...overrides,
  });
}

export function canUseNativeGlassEffect(): boolean {
  return Platform.OS === 'ios' && isGlassEffectAPIAvailable();
}
