import { z } from 'zod';

const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 8_000;
const OFF_USER_AGENT = 'Kolibi/1.0 (kontakt@kolibi.app)';
const KJ_TO_KCAL = 4.184;

const nutrimentsSchema = z
  .object({
    'energy-kcal_100g': z.coerce.number().finite().optional(),
    energy_100g: z.coerce.number().finite().optional(),
    proteins_100g: z.coerce.number().finite().optional(),
    carbohydrates_100g: z.coerce.number().finite().optional(),
    fat_100g: z.coerce.number().finite().optional(),
  })
  .passthrough();

const productSchema = z
  .object({
    product_name: z.string().trim().min(1).optional(),
    quantity: z.string().trim().optional(),
    serving_size: z.string().trim().optional(),
    nutriments: nutrimentsSchema.optional(),
  })
  .passthrough();

const openFoodFactsResponseSchema = z.object({
  status: z.coerce.number(),
  product: productSchema.optional(),
});

export type BarcodeProduct = {
  barcode: string;
  productName: string;
  quantityLabel: string | null;
  servingSizeLabel: string | null;
  quantityGrams: number | null;
  servingSizeGrams: number | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  hasIncompleteMacros: boolean;
};

export class BarcodeProductNotFoundError extends Error {
  constructor(barcode: string) {
    super(`No product found for barcode ${barcode}.`);
    this.name = 'BarcodeProductNotFoundError';
  }
}

export class BarcodeNutrimentsMissingError extends Error {
  constructor(barcode: string) {
    super(`Product found for barcode ${barcode}, but no energy values are available.`);
    this.name = 'BarcodeNutrimentsMissingError';
  }
}

export class BarcodeLookupError extends Error {
  constructor(message = 'Barcode lookup failed due to a connection or server error.') {
    super(message);
    this.name = 'BarcodeLookupError';
  }
}

export class BarcodeLookupAbortedError extends Error {
  constructor() {
    super('Barcode lookup was cancelled.');
    this.name = 'BarcodeLookupAbortedError';
  }
}

export function parseGramsFromLabel(label: string | null | undefined): number | null {
  if (!label?.trim()) {
    return null;
  }

  const normalized = label.trim().toLowerCase().replace(/,/g, '.');

  const kgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kgMatch) {
    return Math.round(parseFloat(kgMatch[1]) * 1000);
  }

  const gMatch = normalized.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gMatch) {
    return Math.round(parseFloat(gMatch[1]));
  }

  const mlMatch = normalized.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) {
    return Math.round(parseFloat(mlMatch[1]));
  }

  const literMatch = normalized.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if (literMatch) {
    return Math.round(parseFloat(literMatch[1]) * 1000);
  }

  return null;
}

function resolveKcalPer100g(nutriments: z.infer<typeof nutrimentsSchema> | undefined): number | null {
  const kcal = nutriments?.['energy-kcal_100g'];
  if (kcal != null) {
    return kcal;
  }

  const energyKj = nutriments?.energy_100g;
  if (energyKj != null) {
    return Math.round((energyKj / KJ_TO_KCAL) * 10) / 10;
  }

  return null;
}

function mapToBarcodeProduct(barcode: string, product: z.infer<typeof productSchema>): BarcodeProduct {
  const nutriments = product.nutriments;
  const kcalPer100g = resolveKcalPer100g(nutriments);

  if (kcalPer100g == null) {
    throw new BarcodeNutrimentsMissingError(barcode);
  }

  const proteinMissing = nutriments?.proteins_100g == null;
  const carbsMissing = nutriments?.carbohydrates_100g == null;
  const fatMissing = nutriments?.fat_100g == null;

  const quantityLabel = product.quantity?.trim() || null;
  const servingSizeLabel = product.serving_size?.trim() || null;

  return {
    barcode,
    productName: product.product_name!.trim(),
    quantityLabel,
    servingSizeLabel,
    quantityGrams: parseGramsFromLabel(quantityLabel),
    servingSizeGrams: parseGramsFromLabel(servingSizeLabel),
    kcalPer100g,
    proteinPer100g: nutriments?.proteins_100g ?? 0,
    carbsPer100g: nutriments?.carbohydrates_100g ?? 0,
    fatPer100g: nutriments?.fat_100g ?? 0,
    hasIncompleteMacros: proteinMissing || carbsMissing || fatMissing,
  };
}

export async function fetchProductByBarcode(
  barcode: string,
  options?: { signal?: AbortSignal },
): Promise<BarcodeProduct> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) {
    throw new BarcodeProductNotFoundError(barcode);
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  function onExternalAbort() {
    timeoutController.abort();
  }

  options?.signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_BASE_URL}/${normalizedBarcode}.json`, {
      signal: timeoutController.signal,
      headers: {
        'User-Agent': OFF_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new BarcodeLookupError(`Open Food Facts request failed (${response.status}).`);
    }

    let jsonPayload: unknown;
    try {
      jsonPayload = await response.json();
    } catch {
      throw new BarcodeLookupError('Open Food Facts returned invalid JSON.');
    }

    const payload = openFoodFactsResponseSchema.safeParse(jsonPayload);
    if (!payload.success) {
      throw new BarcodeLookupError('Open Food Facts response could not be validated.');
    }

    if (payload.data.status !== 1 || !payload.data.product) {
      throw new BarcodeProductNotFoundError(normalizedBarcode);
    }

    const productName = payload.data.product.product_name?.trim();
    if (!productName) {
      throw new BarcodeProductNotFoundError(normalizedBarcode);
    }

    return mapToBarcodeProduct(normalizedBarcode, {
      ...payload.data.product,
      product_name: productName,
    });
  } catch (error) {
    if (options?.signal?.aborted) {
      throw new BarcodeLookupAbortedError();
    }

    if (
      error instanceof BarcodeProductNotFoundError ||
      error instanceof BarcodeNutrimentsMissingError ||
      error instanceof BarcodeLookupError
    ) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new BarcodeLookupError('Open Food Facts request timed out.');
    }

    throw new BarcodeLookupError(
      error instanceof Error ? error.message : 'Barcode lookup failed unexpectedly.',
    );
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export const OpenFoodFactsService = {
  fetchProductByBarcode,
  parseGramsFromLabel,
};
