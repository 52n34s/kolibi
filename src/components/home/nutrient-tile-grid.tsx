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
  layout?: '2x2' | 'row';
};

function resolveState(item: NutrientTileGridItem): NutrientTileState {
  if (item.state != null) {
    return item.state;
  }

  return item.value == null ? 'empty' : 'value';
}

function TileRow({ items }: { items: NutrientTileGridItem[] }) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <NutrientTile
          key={item.key}
          label={item.label}
          value={item.value}
          unit={item.unit}
          state={resolveState(item)}
        />
      ))}
    </View>
  );
}

export function NutrientTileGrid({ items, layout = '2x2' }: NutrientTileGridProps) {
  if (layout === 'row') {
    return (
      <View style={styles.grid}>
        <TileRow items={items} />
      </View>
    );
  }

  const rowOne = items.slice(0, 2);
  const rowTwo = items.slice(2, 4);

  return (
    <View style={styles.grid}>
      <TileRow items={rowOne} />
      <TileRow items={rowTwo} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    justifyContent: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
});
