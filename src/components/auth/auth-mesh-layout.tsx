import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingMeshBackground } from '@/components/onboarding/onboarding-background';

type AuthMeshLayoutProps = {
  children: ReactNode;
};

/** Login/sign-up screens share the same aurora mesh background as Home. */
export function AuthMeshLayout({ children }: AuthMeshLayoutProps) {
  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom', 'left', 'right']} style={{ backgroundColor: 'transparent' }}>
      <View className="flex-1">
        <OnboardingMeshBackground />
        <View className="flex-1">{children}</View>
      </View>
    </SafeAreaView>
  );
}
