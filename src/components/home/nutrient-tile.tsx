import { StyleSheet, Text, View } from 'react-native';

export type NutrientTileState = 'empty' | 'value' | 'partial';

type NutrientTileProps = {
  label: string;
  value: number | null;
  unit: string;
  state: NutrientTileState;
};

function formatNutrientValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '–';
  }

  return String(Math.round(value));
}

export function NutrientTile({ label, value, unit, state }: NutrientTileProps) {
  const isEmpty = state === 'empty' || value == null;
  const isPartial = state === 'partial';

  return (
    <View style={styles.tile}>
      <View style={styles.labelSlot}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {isEmpty ? (
        <Text style={[styles.value, styles.valueEmpty]}>–</Text>
      ) : (
        <View style={styles.valueRow}>
          <Text
            style={[styles.value, isPartial && styles.valuePartial]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {isPartial ? `~ ${formatNutrientValue(value)}` : formatNutrientValue(value)}
          </Text>
          <Text style={[styles.unit, isPartial && styles.unitPartial]}>{unit}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
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
    color: '#86839B',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
    marginTop: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#26234A',
  },
  valuePartial: {
    color: '#6B6885',
    fontWeight: '500',
  },
  valueEmpty: {
    marginTop: 2,
    color: '#B0ADC2',
    fontWeight: '500',
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#86839B',
  },
  unitPartial: {
    color: '#9B98AD',
  },
});
