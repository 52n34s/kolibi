import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getOnboardingSecondarySurfaceStyle } from '@/components/onboarding/onboarding-styles';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';

type WeightProgressCardProps = {
  currentValue: string;
  startLabel: string;
  startValue: string;
  targetLabel: string;
  targetValue: string;
  /** 0–100 when the bar should show; null hides bar and edge labels. */
  progressPercent: number | null;
  onPress: () => void;
  accessibilityLabel: string;
};

/**
 * Glass card: start (small) | current (large) | target (small) above the bar.
 * Whole card opens today's weight sheet.
 */
export function WeightProgressCard({
  currentValue,
  startLabel,
  startValue,
  targetLabel,
  targetValue,
  progressPercent,
  onPress,
  accessibilityLabel,
}: WeightProgressCardProps) {
  const showRange = progressPercent != null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        getOnboardingSecondarySurfaceStyle(),
        styles.card,
        pressed && styles.cardPressed,
      ]}>
      {showRange ? (
        <>
          <View style={styles.valuesRow}>
            <View style={styles.edgeLeft}>
              <Text style={styles.edgeLabel}>{startLabel}</Text>
              <Text style={styles.edgeValue}>{startValue}</Text>
            </View>
            <View style={styles.currentSlot}>
              <Text style={styles.currentValue}>{currentValue}</Text>
            </View>
            <View style={styles.edgeRight}>
              <Text style={styles.edgeLabel}>{targetLabel}</Text>
              <Text style={styles.edgeValue}>{targetValue}</Text>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressPercent}%` }]} />
          </View>
        </>
      ) : (
        <Text style={styles.currentValueAlone}>{currentValue}</Text>
      )}
    </Pressable>
  );
}

/**
 * Progress along start → target using current weight.
 * (start − current) / (start − target), clamped to 0–100.
 * Null when start/target/current missing or start === target.
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
  cardPressed: {
    backgroundColor: 'rgba(79, 70, 229, 0.07)',
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  edgeLeft: {
    flex: 1,
    minWidth: 0,
  },
  edgeRight: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  edgeLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  edgeValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: '#26234A',
  },
  currentSlot: {
    flexShrink: 0,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentValue: {
    fontSize: 20,
    fontWeight: '500',
    color: '#26234A',
    textAlign: 'center',
  },
  currentValueAlone: {
    fontSize: 20,
    fontWeight: '500',
    color: '#26234A',
    textAlign: 'center',
  },
  track: {
    marginTop: 10,
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
