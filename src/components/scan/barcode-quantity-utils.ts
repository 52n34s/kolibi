export type QuantityOption = 'whole' | 'half' | 'serving' | 'piece';

/**
 * Just the sizes the presets need. Structural on purpose: a barcode product
 * satisfies it, and so does a transcribed nutrition label.
 */
export type QuantityPresetSource = {
  quantityGrams: number | null;
  servingSizeGrams: number | null;
};

export const MIN_GRAMS = 10;

export function positiveOr(value: number | null | undefined, fallback: number): number {
  return value != null && value > 0 ? value : fallback;
}

export function hasPositiveGrams(value: number | null | undefined): value is number {
  return value != null && value > 0;
}

/**
 * serving_size is free text and often nonsense. Keep only values > 0 that are
 * strictly smaller than the package when a package size is known.
 */
export function resolveValidServingGrams(
  servingSizeGrams: number | null | undefined,
  quantityGrams: number | null | undefined,
): number | null {
  if (!hasPositiveGrams(servingSizeGrams)) {
    return null;
  }

  if (hasPositiveGrams(quantityGrams) && servingSizeGrams >= quantityGrams) {
    return null;
  }

  return servingSizeGrams;
}

/**
 * One piece when package ÷ serving is an integer ≥ 2 (countable multipack).
 * Piece weight equals the validated serving size.
 */
export function resolvePieceGrams(product: QuantityPresetSource): number | null {
  const packageGrams = hasPositiveGrams(product.quantityGrams) ? product.quantityGrams : null;
  const servingGrams = resolveValidServingGrams(product.servingSizeGrams, packageGrams);
  if (packageGrams == null || servingGrams == null) {
    return null;
  }

  if (packageGrams % servingGrams !== 0) {
    return null;
  }

  const count = packageGrams / servingGrams;
  if (count < 2) {
    return null;
  }

  return servingGrams;
}

export function getQuantityGramsForOption(
  option: QuantityOption,
  product: QuantityPresetSource,
  customGrams: number,
): number {
  const servingGrams = resolveValidServingGrams(product.servingSizeGrams, product.quantityGrams);
  const pieceGrams = resolvePieceGrams(product);

  switch (option) {
    case 'whole':
      return positiveOr(product.quantityGrams, customGrams);
    case 'half':
      return Math.max(MIN_GRAMS, Math.round(positiveOr(product.quantityGrams, customGrams) / 2));
    case 'serving':
      return positiveOr(servingGrams, customGrams);
    case 'piece':
      return positiveOr(pieceGrams, customGrams);
  }
}

/** Prefer one serving when known; otherwise the whole package; else null (manual). */
export function getDefaultOption(product: QuantityPresetSource): QuantityOption | null {
  if (resolveValidServingGrams(product.servingSizeGrams, product.quantityGrams) != null) {
    return 'serving';
  }

  if (hasPositiveGrams(product.quantityGrams)) {
    return 'whole';
  }

  return null;
}

export function getAvailableQuantityOptions(product: QuantityPresetSource): QuantityOption[] {
  const options: QuantityOption[] = [];

  if (hasPositiveGrams(product.quantityGrams)) {
    options.push('whole', 'half');
  }

  if (resolveValidServingGrams(product.servingSizeGrams, product.quantityGrams) != null) {
    options.push('serving');
  }

  if (resolvePieceGrams(product) != null) {
    options.push('piece');
  }

  return options;
}

export function getDefaultCustomGrams(product: QuantityPresetSource, defaultGrams: number): number {
  const servingGrams = resolveValidServingGrams(product.servingSizeGrams, product.quantityGrams);
  return positiveOr(servingGrams, positiveOr(product.quantityGrams, defaultGrams));
}
