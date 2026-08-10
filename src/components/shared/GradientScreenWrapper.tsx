import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingMeshBackground } from '@/components/onboarding/onboarding-background';
import { ONBOARDING_BACKGROUND } from '@/components/onboarding/onboarding-styles';

/** Default gap between status-bar safe area and screen content. */
export const GRADIENT_SCREEN_CONTENT_GAP = 12;

type GradientScreenInsetsOptions = {
  /** Extra padding below the status-bar inset. Defaults to GRADIENT_SCREEN_CONTENT_GAP. */
  extraTop?: number;
};

/**
 * Top padding for content that sits under a full-bleed mesh (status bar not clipped).
 * Prefer this over SafeAreaView's top edge so the gradient can extend behind the status bar.
 */
export function useGradientScreenInsets(options?: GradientScreenInsetsOptions) {
  const insets = useSafeAreaInsets();
  const extraTop = options?.extraTop ?? GRADIENT_SCREEN_CONTENT_GAP;

  return {
    insets,
    contentTopPadding: insets.top + extraTop,
  };
}

type GradientScreenWrapperProps = {
  children: ReactNode;
};

/**
 * Full-screen aurora mesh wrapper. Top safe area is intentionally excluded so the
 * gradient reaches behind the status bar; use useGradientScreenInsets() (or manual
 * insets) to offset interactive content.
 */
export function GradientScreenWrapper({ children }: GradientScreenWrapperProps) {
  return (
    <View className="flex-1" style={{ backgroundColor: ONBOARDING_BACKGROUND }}>
      <SafeAreaView className="flex-1" edges={['bottom', 'left', 'right']}>
        <View className="flex-1">
          <OnboardingMeshBackground />
          <View className="flex-1">{children}</View>
        </View>
      </SafeAreaView>
    </View>
  );
}
