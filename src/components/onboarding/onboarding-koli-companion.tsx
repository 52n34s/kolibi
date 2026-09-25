import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';
import { View } from 'react-native';

import type { OnboardingStepId } from '@/lib/onboarding-steps';

const KOLI_BY_STEP: Record<OnboardingStepId, ImageSource> = {
  purpose: require('@/assets/images/koli-curious.png'),
  about: require('@/assets/images/koli-thinking.png'),
  height: require('@/assets/images/koli-curious.png'),
  weight: require('@/assets/images/koli-neutral.png'),
  activity: require('@/assets/images/koli-energetic.png'),
  goal: require('@/assets/images/koli-focused.png'),
  summary: require('@/assets/images/koli-happy.png'),
};

type OnboardingKoliCompanionProps = {
  stepId: OnboardingStepId;
};

export function OnboardingKoliCompanion({ stepId }: OnboardingKoliCompanionProps) {
  const source = KOLI_BY_STEP[stepId];

  if (!source) {
    return null;
  }

  return (
    <View className="mb-3 self-start">
      <Image source={source} style={{ width: 52, height: 42 }} contentFit="contain" />
    </View>
  );
}
