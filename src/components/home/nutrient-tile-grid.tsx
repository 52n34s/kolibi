import { StyleSheet, View } from 'react-native';

import {
  NutrientTile,
  type NutrientTileState,
} from '@/components/home/nutrient-tile';

export type NutrientTileGridItem = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  state?: NutrientTileState;
};

type NutrientTileGridProps = {
  items: NutrientTileGridItem[];
};

function resolveState(item: NutrientTileGridItem): NutrientTileState {
  if (item.state != null) {
    return item.state;
  }

  return item.value == null ? 'empty' : 'value';
}

export function NutrientTileGrid({ items }: NutrientTileGridProps) {
  const rowOne = items.slice(0, 2);
  const rowTwo = items.slice(2, 4);

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {rowOne.map((item) => (
          <NutrientTile
            key={item.key}
            label={item.label}
            value={item.value}
            unit={item.unit}
            state={resolveState(item)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {rowTwo.map((item) => (
          <NutrientTile
            key={item.key}
            label={item.label}
            value={item.value}
            unit={item.unit}
            state={resolveState(item)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    minWidth: 0,
    gap: 10,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
