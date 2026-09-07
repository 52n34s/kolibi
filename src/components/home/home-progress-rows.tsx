import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';

export type HomeProgressRowItem = {
  key: string;
  label: string;
  actual: number | null;
  goal: number | null;
  /** 0 for grams/steps, 1 for km. */
  decimals?: 0 | 1;
  onPress?: () => void;
  /** Draw a thin rule above this row (e.g. movement after macros). */
  dividerAbove?: boolean;
  /** Optional gray hint under the row (e.g. HealthKit required). */
  footerHint?: string;
  onFooterPress?: () => void;
};

type HomeProgressRowsProps = {
  rows: HomeProgressRowItem[];
};

function formatAmount(value: number, decimals: 0 | 1): string {
  if (!Number.isFinite(value)) {
    return '–';
  }
  if (decimals === 0) {
    return String(Math.round(value));
  }
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(1);
}

function HomeProgressRow({ item }: { item: HomeProgressRowItem }) {
  const decimals = item.decimals ?? 0;
  const hasGoal = item.goal != null && item.goal > 0;
  const actual = item.actual;
  const progressPercent = hasGoal
    ? Math.min(100, Math.max(0, ((actual ?? 0) / item.goal!) * 100))
    : 0;

  let valueText: string;
  if (hasGoal) {
    const left = formatAmount(actual ?? 0, decimals);
    valueText = `${left}/${formatAmount(item.goal!, decimals)}`;
  } else if (actual == null) {
    valueText = '–';
  } else {
    valueText = formatAmount(actual, decimals);
  }

  const row = (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
        {item.label}
      </Text>
      <View style={styles.barSlot}>
        {hasGoal ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressPercent}%` }]} />
          </View>
        ) : null}
      </View>
      <Text
        style={styles.value}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}>
        {valueText}
      </Text>
    </View>
  );

  return (
    <View>
      {item.dividerAbove ? <View style={styles.divider} /> : null}
      {item.onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={item.onPress}
          style={({ pressed }) => [pressed && styles.rowPressed]}>
          {row}
        </Pressable>
      ) : (
        row
      )}
      {item.footerHint ? (
        item.onFooterPress ? (
          <Pressable
            accessibilityRole="button"
            onPress={item.onFooterPress}
            style={({ pressed }) => [styles.footerHintWrap, pressed && styles.rowPressed]}>
            <Text style={styles.footerHint}>{item.footerHint}</Text>
          </Pressable>
        ) : (
          <View style={styles.footerHintWrap}>
            <Text style={styles.footerHint}>{item.footerHint}</Text>
          </View>
        )
      ) : null}
    </View>
  );
}

/** Flat label | bar | value rows for the Home calorie glass (not used by History). */
export function HomeProgressRows({ rows }: HomeProgressRowsProps) {
  return (
    <View style={styles.list}>
      {rows.map((item) => (
        <HomeProgressRow key={item.key} item={item} />
      ))}
    </View>
  );
}

const LABEL_WIDTH = 112;

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(38, 35, 74, 0.12)',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 18,
  },
  rowPressed: {
    opacity: 0.7,
  },
  label: {
    width: LABEL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  barSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  track: {
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
  value: {
    minWidth: 56,
    maxWidth: 88,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: '#26234A',
    fontVariant: ['tabular-nums'],
  },
  footerHintWrap: {
    marginTop: 6,
  },
  footerHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
});
