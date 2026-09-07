import { StyleSheet, Text, View } from 'react-native';

import { TEXT_SECONDARY } from '@/constants/brand';

export type NutrientTileState = 'empty' | 'value' | 'partial';

type NutrientTileProps = {
  label: string;
  value: number | null;
  unit: string;
  state: NutrientTileState;
  goalValue?: number | null;
};

function formatNutrientValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '–';
  }

  return String(Math.round(value));
}

export function NutrientTile({
  label,
  value,
  unit,
  state,
  goalValue = null,
}: NutrientTileProps) {
  const isEmpty = state === 'empty' || value == null;
  const isPartial = state === 'partial';
  const showGoal = goalValue != null && goalValue > 0 && !isPartial;
  const progressPercent = showGoal
    ? Math.min(100, Math.max(0, ((value ?? 0) / goalValue) * 100))
    : 0;

  let valueText: string;
  if (isPartial) {
    valueText = `~ ${formatNutrientValue(value!)}`;
  } else if (showGoal) {
    const actual = value == null ? '–' : formatNutrientValue(value);
    valueText = `${actual} / ${formatNutrientValue(goalValue)}`;
  } else if (isEmpty) {
    valueText = '–';
  } else {
    valueText = formatNutrientValue(value!);
  }

  return (
    <View style={styles.tile}>
      <View style={styles.labelSlot}>
        <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        {isEmpty && !showGoal ? (
          <Text style={[styles.value, styles.valueEmpty]} numberOfLines={1}>
            –
          </Text>
        ) : (
          <>
            <Text
              style={[styles.value, isPartial && styles.valuePartial]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              {valueText}
            </Text>
            <Text style={[styles.unit, isPartial && styles.unitPartial]} numberOfLines={1}>
              {unit}
            </Text>
          </>
        )}
      </View>
      {/* Always reserve bar height so tiles with/without goals stay equal. */}
      <View style={[styles.progressTrack, !showGoal && styles.progressTrackHidden]}>
        {showGoal ? (
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: 'rgba(111, 108, 137, 0.08)',
  },
  labelSlot: {
    height: 14,
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
    marginTop: 2,
    minWidth: 0,
  },
  value: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#26234A',
  },
  valuePartial: {
    color: '#6B6885',
    fontWeight: '500',
  },
  valueEmpty: {
    color: '#B0ADC2',
    fontWeight: '500',
  },
  unit: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '500',
    color: '#86839B',
  },
  unitPartial: {
    color: '#9B98AD',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
    backgroundColor: 'rgba(79, 70, 229, 0.13)',
  },
  progressTrackHidden: {
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#4F46E5',
  },
});
