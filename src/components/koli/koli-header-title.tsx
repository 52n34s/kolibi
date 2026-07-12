import { Image } from 'expo-image';
import { View } from 'react-native';

type KoliHeaderTitleProps = {
  accessibilityLabel: string;
};

const HEADER_KOLI_WIDTH = 36;
const HEADER_KOLI_HEIGHT = 28;

export function KoliHeaderTitle({ accessibilityLabel }: KoliHeaderTitleProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      className="items-center justify-center">
      <Image
        source={require('@/assets/images/koli-neutral.png')}
        style={{ width: HEADER_KOLI_WIDTH, height: HEADER_KOLI_HEIGHT }}
        contentFit="contain"
      />
    </View>
  );
}
