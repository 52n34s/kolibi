import { Image } from 'expo-image';
import { Href, router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { getGlassPillStyle } from '@/components/ui/glass-styles';

type HistoryKoliButtonProps = {
  accessibilityLabel: string;
};

export function HistoryKoliButton({ accessibilityLabel }: HistoryKoliButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => router.push('/koli' as Href)}>
      <View style={getGlassPillStyle(40)}>
        <Image
          source={require('@/assets/images/koli-curious.png')}
          style={{ width: 28, height: 28 }}
          contentFit="contain"
        />
      </View>
    </Pressable>
  );
}
