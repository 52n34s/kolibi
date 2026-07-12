import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingMeshBackground } from './onboarding-background';

type OnboardingLayoutProps = {
  children: ReactNode;
};

export function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: 'transparent' }}>
      <View className="flex-1">
        <OnboardingMeshBackground />
        <View className="flex-1">{children}</View>
      </View>
    </SafeAreaView>
  );
}
