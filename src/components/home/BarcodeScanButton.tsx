import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { getGlassPillStyle } from '@/components/ui/glass-styles';

const BUTTON_SIZE = 56;

type BarcodeScanButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
};

export function BarcodeScanButton({ accessibilityLabel, onPress }: BarcodeScanButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}>
      <View style={getGlassPillStyle(BUTTON_SIZE)}>
        <Ionicons name="barcode-outline" size={26} color="#4F46E5" />
      </View>
    </Pressable>
  );
}
