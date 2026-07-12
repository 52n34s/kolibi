import type { ViewStyle } from 'react-native';

import { getGlassCardStyle, GLASS_CARD_RADIUS } from '@/components/ui/glass-styles';

export const ONBOARDING_ACCENT = '#4F46E5';
export const ONBOARDING_MINT = '#7CE7C7';
export const ONBOARDING_BACKGROUND = '#FAFAFA';

export const ONBOARDING_CARD_COLORS = {
  idle: 'rgba(255, 255, 255, 0.52)',
  selected: 'rgba(255, 255, 255, 0.68)',
  border: 'rgba(255, 255, 255, 0.78)',
  shadow: '#312E81',
} as const;

export const ONBOARDING_CARD_RADIUS = GLASS_CARD_RADIUS;
export const ONBOARDING_CARD_INNER_RADIUS = 14;
export const ONBOARDING_GRID_CARD_MIN_HEIGHT = 132;

export const ONBOARDING_SECONDARY_SURFACE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#D1D5DB',
  borderWidth: 1,
  borderRadius: 12,
} as const;

export const ONBOARDING_SELECTED_GRADIENT = {
  inner: ['rgba(254, 252, 248, 0.98)', 'rgba(251, 248, 242, 0.98)'] as const,
  border: ['#4F46E5', '#7CE7C7'] as const,
};

export function getOnboardingSecondarySurfaceStyle(): ViewStyle {
  return getGlassCardStyle({
    borderRadius: ONBOARDING_SECONDARY_SURFACE.borderRadius,
  });
}

export function getOnboardingIdleCardStyle(): ViewStyle {
  return getGlassCardStyle({
    borderRadius: ONBOARDING_CARD_RADIUS,
    borderWidth: 1,
  });
}

export function getOptionIconColor() {
  return ONBOARDING_ACCENT;
}
