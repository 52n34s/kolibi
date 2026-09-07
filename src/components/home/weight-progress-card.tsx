import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getOnboardingSecondarySurfaceStyle } from '@/components/onboarding/onboarding-styles';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';

type WeightProgressCardProps = {
  currentLabel: string;
  currentValue: string;
  targetLabel: string;
  targetValue: string;
  /** 0–100 when the bar should show; null hides the bar. */
  progressPercent: number | null;
  onPressCurrent: () => void;
  onPressTarget: () => void;
};

/** Single glass card: current | target, optional progress from start → target. */
export function WeightProgressCard({
  currentLabel,
  currentValue,
  targetLabel,
  targetValue,
  progressPercent,
  onPressCurrent,
  onPressTarget,
}: WeightProgressCardProps) {
  const showBar = progressPercent != null;

  return (
    <View style={[getOnboardingSecondarySurfaceStyle(), styles.card]}>
      <View style={styles.valuesRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={currentLabel}
          onPress={onPressCurrent}
          style={({ pressed }) => [styles.valuePress, pressed && styles.valuePressed]}>
          <Text style={styles.label}>{currentLabel}</Text>
          <Text style={styles.value}>{currentValue}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={targetLabel}
          onPress={onPressTarget}
          style={({ pressed }) => [
            styles.valuePress,
            styles.valuePressRight,
            pressed && styles.valuePressed,
          ]}>
          <Text style={styles.label}>{targetLabel}</Text>
          <Text style={styles.value}>{targetValue}</Text>
        </Pressable>
      </View>
      {showBar ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progressPercent}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Progress along start → target using current weight.
 * (start − current) / (start − target), clamped to 0–100.
 * Null when start/target missing or start === target.
 */
export function weightGoalProgressPercent(params: {
  startKg: number | null;
  currentKg: number | null;
  targetKg: number | null;
}): number | null {
  const { startKg, currentKg, targetKg } = params;
  if (startKg == null || currentKg == null || targetKg == null) {
    return null;
  }
  if (!(Number.isFinite(startKg) && Number.isFinite(currentKg) && Number.isFinite(targetKg))) {
    return null;
  }
  if (startKg === targetKg) {
    return null;
  }

  const raw = ((startKg - currentKg) / (startKg - targetKg)) * 100;
  if (!Number.isFinite(raw)) {
    return null;
  }

  return Math.min(100, Math.max(0, raw));
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  valuePress: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
  },
  valuePressRight: {
    alignItems: 'flex-end',
  },
  valuePressed: {
    backgroundColor: 'rgba(79, 70, 229, 0.07)',
  },
  label: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  value: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '500',
    color: '#26234A',
  },
  track: {
    marginTop: 12,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    backgroundColor: 'rgba(79, 70, 229, 0.13)',
  },
  fill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: BRAND_INDIGO,
  },
});
