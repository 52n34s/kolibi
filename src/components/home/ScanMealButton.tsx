import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { SCAN_MEAL_BUTTON_SIZE } from '@/components/home/scan-button-bar';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';

export {
  SCAN_BUTTON_BAR_HEIGHT,
  scanButtonBarScrollPadding,
} from '@/components/home/scan-button-bar';

type ScanMealButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
};

export function ScanMealButton({ accessibilityLabel, onPress }: ScanMealButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.pressable}>
      <LinearGradient
        colors={['#4F46E5', '#7CE7C7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={28} tint="light" style={styles.blurOverlay} />
        ) : (
          <View style={styles.androidGlassOverlay} />
        )}
        <Ionicons name="camera" size={34} color="#FFFFFF" style={styles.icon} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: SCAN_MEAL_BUTTON_SIZE,
    height: SCAN_MEAL_BUTTON_SIZE,
    borderRadius: SCAN_MEAL_BUTTON_SIZE / 2,
    shadowColor: ONBOARDING_ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 10,
  },
  gradient: {
    width: SCAN_MEAL_BUTTON_SIZE,
    height: SCAN_MEAL_BUTTON_SIZE,
    borderRadius: SCAN_MEAL_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.42)',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  androidGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  icon: {
    zIndex: 1,
  },
});
