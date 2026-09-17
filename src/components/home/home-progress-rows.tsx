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
  /** Appended to the ratio in primary weight, e.g. " km" */
  valueUnit?: string;
  /**
   * Mon–Sun filled flags. When set, replaces the progress bar with seven dots
   * (e.g. training week).
   */
  weekDayDots?: boolean[];
  /**
   * Macro coverage: empty → "—"; partial → "~ N"; value (default) → "N/goal".
   * null actual with value mode also shows "—" (unknown ≠ 0).
   */
  coverage?: 'empty' | 'partial' | 'value';
  /**
   * When set, replaces the numeric value text entirely (e.g. protein hit rate).
   */
  valueOverride?: string;
  /** Value color: secondary for very-rough balance accuracy. */
  valueTone?: 'default' | 'secondary';
  /** Prefix the goal side, e.g. "mind." for fat/fiber floors. */
  goalPrefix?: string;
  /**
   * Drop the bar and fixed value column; value text uses the remaining width
   * (e.g. protein hit-rate copy that must not truncate).
   */
  valueFullWidth?: boolean;
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

function WeekDayDots({ flags }: { flags: boolean[] }) {
  const days = flags.length === 7 ? flags : [false, false, false, false, false, false, false];
  return (
    <View style={styles.dotsRow}>
      {days.map((filled, index) => (
        <View
          key={index}
          style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
        />
      ))}
    </View>
  );
}

function HomeProgressRow({ item }: { item: HomeProgressRowItem }) {
  const decimals = item.decimals ?? 0;
  const coverage = item.coverage ?? 'value';
  const hasGoal = item.goal != null && item.goal > 0 && coverage === 'value';
  const actual = item.actual;
  const progressPercent = hasGoal
    ? Math.min(100, Math.max(0, ((actual ?? 0) / item.goal!) * 100))
    : 0;
  const useWeekDots = item.weekDayDots != null;

  let valueText: string;
  if (item.valueOverride != null) {
    valueText = item.valueOverride;
  } else if (coverage === 'empty' || actual == null) {
    // Unknown macros must never render as "0/goal".
    valueText = '–';
  } else if (coverage === 'partial') {
    valueText = `~ ${formatProgressAmount(actual, decimals)}`;
  } else if (hasGoal) {
    const left = formatProgressAmount(actual, decimals);
    const right = formatProgressAmount(item.goal!, decimals);
    valueText = item.goalPrefix
      ? `${item.goalPrefix} ${left}/${right}`
      : `${left}/${right}`;
  } else {
    valueText = formatProgressAmount(actual, decimals);
  }
  if (item.valueUnit && valueText !== '–') {
    valueText = `${valueText}${item.valueUnit}`;
  }

  const showBar =
    !item.valueFullWidth && hasGoal && coverage === 'value' && actual != null;

  const row = (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
        {item.label}
      </Text>
      {item.valueFullWidth ? (
        <Text
          style={[
            styles.valueFullWidth,
            item.valueTone === 'secondary' ? styles.valueSecondary : null,
          ]}
          numberOfLines={1}>
          {valueText}
        </Text>
      ) : (
        <>
          <View style={styles.barSlot}>
            {useWeekDots ? (
              <WeekDayDots flags={item.weekDayDots!} />
            ) : showBar ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progressPercent}%` }]} />
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.value, item.valueTone === 'secondary' ? styles.valueSecondary : null]}
            numberOfLines={1}>
            {valueText}
          </Text>
        </>
      )}
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
/** Fits longest value "10.6/25 km" at 13/600 tabular-nums (iPhone SE). */
const VALUE_WIDTH = 78;

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
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: BRAND_INDIGO,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotFilled: {
    backgroundColor: BRAND_INDIGO,
  },
  dotEmpty: {
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
  },
  value: {
    width: VALUE_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: '#26234A',
    fontVariant: ['tabular-nums'],
  },
  valueFullWidth: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: '#26234A',
  },
  valueSecondary: {
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  footerHintWrap: {
    marginTop: 6,
  },
  footerHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
});
