import { Platform, type ViewStyle } from 'react-native';
import { isGlassEffectAPIAvailable } from 'expo-glass-effect';

export const GLASS_CARD_RADIUS = 16;

/** Shared frosted-glass surface tokens used app-wide. */
export const GLASS_SURFACE = {
  backgroundColor: 'rgba(255, 255, 255, 0.38)',
  borderColor: 'rgba(255, 255, 255, 0.82)',
  borderWidth: 1,
  shadowColor: '#312E81',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 4,
} as const;

export function getGlassCardStyle(overrides?: ViewStyle): ViewStyle {
  return {
    ...GLASS_SURFACE,
    borderRadius: GLASS_CARD_RADIUS,
    overflow: 'hidden',
    ...overrides,
  };
}

/** Circular glass surface for icon buttons (e.g. Koli menu). */
export function getGlassPillStyle(size = 40): ViewStyle {
  return getGlassCardStyle({
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    borderColor: 'rgba(255, 255, 255, 0.92)',
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
