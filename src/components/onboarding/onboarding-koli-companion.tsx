import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';
import { View } from 'react-native';

const KOLI_BY_STEP: ImageSource[] = [
  require('@/assets/images/koli-confident.png'),
  require('@/assets/images/koli-thinking.png'),
  require('@/assets/images/koli-curious.png'),
  require('@/assets/images/koli-neutral.png'),
  require('@/assets/images/koli-energetic.png'),
  require('@/assets/images/koli-focused.png'),
  require('@/assets/images/koli-happy.png'),
];

type OnboardingKoliCompanionProps = {
  step: number;
};

export function OnboardingKoliCompanion({ step }: OnboardingKoliCompanionProps) {
  const source = KOLI_BY_STEP[step];

  if (!source) {
    return null;
  }

  return (
    <View className="mb-3 self-start">
      <Image source={source} style={{ width: 52, height: 42 }} contentFit="contain" />
    </View>
  );
}
