import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';

export type HomeProgressValueKind = 'ratio' | 'minimum' | 'weekly';

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
  /**
   * ratio (default): "21/30"
   * minimum: trailing value is `minimumLabel` (e.g. "Mindestens 30 g")
   * weekly: "10.6 von 25 km · erwartet: 7 km" via weeklyLabel
   */
  valueKind?: HomeProgressValueKind;
  /** Preformatted trailing value when valueKind is minimum or weekly. */
  valueLabel?: string;
  /** Expected amount by today for weekly goals — draws a marker on the bar. */
  expected?: number | null;
};

type HomeProgressRowsProps = {
  rows: HomeProgressRowItem[];
};

export function formatProgressAmount(value: number, decimals: 0 | 1): string {
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
  const expectedPercent =
    hasGoal && item.expected != null && item.expected > 0
      ? Math.min(100, Math.max(0, (item.expected / item.goal!) * 100))
      : null;

  let valueText: string;
  if (item.valueKind === 'minimum' || item.valueKind === 'weekly') {
    valueText = item.valueLabel ?? '–';
  } else if (hasGoal) {
    const left = formatProgressAmount(actual ?? 0, decimals);
    valueText = `${left}/${formatProgressAmount(item.goal!, decimals)}`;
  } else if (actual == null) {
    valueText = '–';
  } else {
    valueText = formatProgressAmount(actual, decimals);
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
            {expectedPercent != null ? (
              <View
                pointerEvents="none"
                style={[styles.expectedMarker, { left: `${expectedPercent}%` }]}
              />
            ) : null}
          </View>
        ) : null}
      </View>
      <Text
        style={[
          styles.value,
          (item.valueKind === 'minimum' || item.valueKind === 'weekly') && styles.valueWide,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}>
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
    backgroundColor: 'rgba(79, 70, 229, 0.13)',
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: BRAND_INDIGO,
  },
  expectedMarker: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: '#26234A',
    opacity: 0.45,
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
  valueWide: {
    minWidth: 72,
    maxWidth: 168,
  },
  footerHintWrap: {
    marginTop: 6,
  },
  footerHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
});
