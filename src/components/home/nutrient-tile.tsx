import { StyleSheet, Text, View } from 'react-native';

export type NutrientTileState = 'empty' | 'value';

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

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function NutrientTile({ label, value, unit, state }: NutrientTileProps) {
  const isEmpty = state === 'empty' || value == null;

  return (
    <View style={styles.tile}>
      <Text
        style={styles.label}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}>
        {label}
      </Text>
      {isEmpty ? (
        <Text style={[styles.value, styles.valueEmpty]}>–</Text>
      ) : (
        <Text
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}>
          {formatNutrientValue(value)}
          <Text style={styles.unit}> {unit}</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#86839B',
  },
  value: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '600',
    color: '#26234A',
  },
  valueEmpty: {
    color: '#B0ADC2',
    fontWeight: '500',
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#86839B',
  },
});
