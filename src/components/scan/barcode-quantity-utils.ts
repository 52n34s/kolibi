import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';

export type QuantityOption = 'whole' | 'half' | 'serving' | 'custom';

export const MIN_GRAMS = 10;

export function positiveOr(value: number | null | undefined, fallback: number): number {
  return value != null && value > 0 ? value : fallback;
}

export function hasPositiveGrams(value: number | null | undefined): value is number {
  return value != null && value > 0;
}

export function getQuantityGramsForOption(
  option: QuantityOption,
  product: BarcodeProduct,
  customGrams: number,
): number {
  switch (option) {
    case 'whole':
      return positiveOr(product.quantityGrams, customGrams);
    case 'half':
      return Math.max(MIN_GRAMS, Math.round(positiveOr(product.quantityGrams, customGrams) / 2));
    case 'serving':
      return positiveOr(product.servingSizeGrams, customGrams);
    case 'custom':
      return customGrams;
  }
}

export function getDefaultOption(product: BarcodeProduct): QuantityOption {
  if (hasPositiveGrams(product.quantityGrams)) {
    return 'whole';
  }

  if (hasPositiveGrams(product.servingSizeGrams)) {
    return 'serving';
  }

  return 'custom';
}

export function getAvailableQuantityOptions(product: BarcodeProduct): QuantityOption[] {
  const options: QuantityOption[] = [];

  if (hasPositiveGrams(product.quantityGrams)) {
    options.push('whole', 'half');
  }

  if (hasPositiveGrams(product.servingSizeGrams)) {
    options.push('serving');
  }

  options.push('custom');
  return options;
}

export function getDefaultCustomGrams(product: BarcodeProduct, defaultGrams: number): number {
  return positiveOr(product.servingSizeGrams, positiveOr(product.quantityGrams, defaultGrams));
}
