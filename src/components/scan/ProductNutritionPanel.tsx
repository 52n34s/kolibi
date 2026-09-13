import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { mealEntrySheetStyles } from '@/components/scan/meal-entry-shared';
import { TEXT_SECONDARY } from '@/constants/brand';
import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';

type ProductNutritionPanelProps = {
  product: BarcodeProduct;
};

export function ProductNutritionPanel({ product }: ProductNutritionPanelProps) {
  const { t, i18n } = useTranslation();
  const rows = [
    { key: 'energy', value: product.kcalPer100g },
    { key: 'fat', value: product.fatPer100g },
    { key: 'saturatedFat', value: product.saturatedFatPer100g, indented: true },
    { key: 'carbs', value: product.carbsPer100g },
    { key: 'sugar', value: product.sugarPer100g, indented: true },
    { key: 'fiber', value: product.fiberPer100g },
    { key: 'protein', value: product.proteinPer100g },
    { key: 'salt', value: product.saltPer100g },
  ] as const;

  return (
    <View style={styles.panel}>
      <Text style={[mealEntrySheetStyles.title, styles.title]}>
        {t('home.scan.barcode.nutrition.per100g')}
      </Text>
      {rows.map((row) => {
        if (row.value == null) {
          return null;
        }

        const indented = 'indented' in row && row.indented;
        const value = row.key === 'energy'
          ? `${new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language, {
              maximumFractionDigits: 0,
            }).format(row.value)} kcal`
          : t(`home.scan.barcode.nutrition.${row.key === 'salt' ? 'gramsValueFine' : 'gramsValue'}`, {
              value: row.value,
            });

        return (
          <View key={row.key} style={[styles.row, indented && styles.indentedRow]}>
            <Text style={[styles.label, indented && styles.secondary]}>
              {t(`home.scan.barcode.nutrition.${row.key}`)}
            </Text>
            <Text style={[styles.value, indented && styles.secondary]}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 4,
  },
  title: {
    marginBottom: 4,
    fontSize: 15,
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  indentedRow: {
    paddingLeft: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  secondary: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
});
