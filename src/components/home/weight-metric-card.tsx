import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
  getOnboardingSecondarySurfaceStyle,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';

type WeightMetricCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string | null;
  onPress: () => void;
};

export function WeightMetricCard({
  icon,
  label,
  value,
  hint,
  onPress,
}: WeightMetricCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        getOnboardingSecondarySurfaceStyle(),
        styles.card,
        pressed && { backgroundColor: GLASS_SURFACE_PRESSED.backgroundColor },
        { borderRadius: ONBOARDING_CARD_RADIUS },
      ]}
      onPress={onPress}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={ONBOARDING_ACCENT} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Ionicons name="create-outline" size={16} color="#9CA3AF" style={styles.editIcon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 14,
    position: 'relative',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    paddingRight: 20,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  editIcon: {
    position: 'absolute',
    top: 14,
    right: 10,
  },
});
