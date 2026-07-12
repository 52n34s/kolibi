import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingMeshBackground } from '@/components/onboarding/onboarding-background';
import { ONBOARDING_BACKGROUND } from '@/components/onboarding/onboarding-styles';

/** Native stack header height used for transparent-header content offset. */
export const STACK_HEADER_HEIGHT = 44;

/** Default gap between safe area / header and scroll content. */
export const SCREEN_CONTENT_GAP = 12;

/**
 * Shared stack options for screens that render inside HomeLayout with a mesh
 * background extending under the status bar and transparent stack header.
 */
export const MESH_STACK_SCREEN_OPTIONS = {
  headerShown: true,
  headerTransparent: true,
  headerBackTitle: '',
  headerTintColor: '#4F46E5',
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

type MeshScreenInsetsOptions = {
  /** Add stack header height when a transparent native header overlays the content. */
  hasStackHeader?: boolean;
  /** Extra padding below the safe area / header. Defaults to SCREEN_CONTENT_GAP. */
  extraTop?: number;
};

export function useMeshScreenInsets(options?: MeshScreenInsetsOptions) {
  const insets = useSafeAreaInsets();
  const headerOffset = options?.hasStackHeader ? STACK_HEADER_HEIGHT : 0;
  const extraTop = options?.extraTop ?? SCREEN_CONTENT_GAP;

  return {
    insets,
    contentTopPadding: insets.top + headerOffset + extraTop,
  };
}

type HomeLayoutProps = {
  children: ReactNode;
};

/**
 * Full-screen mesh background wrapper. Top safe area is intentionally excluded so
 * the gradient reaches behind the status bar; use useMeshScreenInsets() for
 * scroll content offsets on each screen.
 */
export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <SafeAreaView
      className="flex-1"
      edges={['bottom', 'left', 'right']}
      style={{ backgroundColor: ONBOARDING_BACKGROUND }}>
      <View className="flex-1">
        <OnboardingMeshBackground />
        <View className="flex-1">{children}</View>
      </View>
    </SafeAreaView>
  );
}
