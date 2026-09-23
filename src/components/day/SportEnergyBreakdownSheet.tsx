import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { BRAND_INDIGO, TEXT_SECONDARY, TRAINING_UNIT_COLORS } from '@/constants/brand';
import type { SportEnergyBreakdownItem, SportEnergyDay } from '@/lib/sport-energy-day';
import { isUnitColorKey } from '@/lib/workouts/types';
import { formatKcal } from '@/utils/format';

type SportEnergyBreakdownSheetProps = {
  visible: boolean;
  onClose: () => void;
  sportEnergyDay: SportEnergyDay;
};

function unitColor(colorKey: string | undefined): string {
  if (colorKey != null && isUnitColorKey(colorKey)) {
    return TRAINING_UNIT_COLORS[colorKey];
  }
  return BRAND_INDIGO;
}

function BreakdownRow({ item }: { item: SportEnergyBreakdownItem }) {
  const { t } = useTranslation();
  const muted = !item.counted;
  const hasUnitBadge = Boolean(item.shortLabel);

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.labelRow}>
          {hasUnitBadge ? (
            <View style={[styles.dot, { backgroundColor: unitColor(item.colorKey) }]} />
          ) : null}
          <Text style={[styles.label, muted && styles.labelMuted]} numberOfLines={2}>
            {hasUnitBadge ? `${item.shortLabel} · ${item.label}` : item.label}
          </Text>
        </View>
        {muted ? (
          <Text style={[styles.hint, hasUnitBadge && styles.hintIndented]}>
            {t('home.calorieGoal.sportBreakdown.suppressedHint')}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.kcal, muted && styles.kcalMuted]}>{formatKcal(item.kcal)}</Text>
    </View>
  );
}

export function SportEnergyBreakdownSheet({
  visible,
  onClose,
  sportEnergyDay,
}: SportEnergyBreakdownSheetProps) {
  const { t } = useTranslation();

  const rows = useMemo(
    () => sportEnergyDay.breakdown.filter((item) => item.kcal > 0),
    [sportEnergyDay.breakdown],
  );

  return (
    <GlassBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.72}>
      <Text style={styles.title}>{t('home.calorieGoal.sportBreakdown.title')}</Text>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {rows.map((item, index) => (
          <BreakdownRow
            key={`${item.kind}-${item.label}-${item.kcal}-${index}`}
            item={item}
          />
        ))}
      </ScrollView>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('home.calorieGoal.sportBreakdown.total')}</Text>
        <Text style={styles.totalKcal}>{formatKcal(sportEnergyDay.totalActiveKcal)}</Text>
      </View>
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    paddingBottom: 8,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  labelMuted: {
    color: TEXT_SECONDARY,
    fontWeight: '400',
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  hintIndented: {
    marginLeft: 16,
  },
  kcal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  kcalMuted: {
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(79, 70, 229, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  totalKcal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
});
