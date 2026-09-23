import { Image } from 'expo-image';
import { Href, router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { getGlassPillStyle } from '@/components/ui/glass-styles';

type HistoryKoliButtonProps = {
  accessibilityLabel: string;
  /** Defaults to /koli (goals). Pass settings when product is locked. */
  href?: Href;
};

export function HistoryKoliButton({
  accessibilityLabel,
  href = '/koli' as Href,
}: HistoryKoliButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => router.push(href)}>
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
