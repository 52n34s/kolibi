import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getOnboardingSecondarySurfaceStyle } from '@/components/onboarding/onboarding-styles';

type WeightMetricCardProps = {
  label: string;
  value: string;
  hint?: string | null;
  onPress: () => void;
};

export function WeightMetricCard({
  label,
  value,
  hint,
  onPress,
}: WeightMetricCardProps) {
  return (
    <View style={[getOnboardingSecondarySurfaceStyle(), styles.card]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressArea,
          pressed && { backgroundColor: 'rgba(79, 70, 229, 0.07)' },
        ]}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pressArea: {
    flex: 1,
    borderRadius: 14,
  },
  label: {
    fontSize: 12,
    color: '#6F6C89',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '500',
    color: '#26234A',
  },
  hint: {
    fontSize: 11,
    color: '#86839B',
  },
});
