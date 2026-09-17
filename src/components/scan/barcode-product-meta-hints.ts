import type { TFunction } from 'i18next';

import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';

/** Grey hint lines under the product name on barcode sheets. */
export function barcodeProductMetaHints(
  product: BarcodeProduct,
  t: TFunction,
): string[] {
  const hints: string[] = [];

  if (product.veganAnalysisHint === 'vegan') {
    hints.push(t('home.scan.barcode.product.veganHint.vegan'));
  } else if (product.veganAnalysisHint === 'maybe_vegan') {
    hints.push(t('home.scan.barcode.product.veganHint.maybeVegan'));
  } else if (product.veganAnalysisHint === 'non_vegan') {
    hints.push(t('home.scan.barcode.product.veganHint.nonVegan'));
  }

  if (product.novaGroup != null) {
    hints.push(t(`home.scan.barcode.product.nova.${product.novaGroup}`));
  }

  return hints;
}
