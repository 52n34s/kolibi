import { z } from 'zod';

const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const OPEN_FOOD_FACTS_SEARCH_PATH = '/cgi/search.pl';
const REQUEST_TIMEOUT_MS = 8_000;
const OFF_USER_AGENT = 'Kolibi/1.0 (kontakt@kolibi.app)';
const KJ_TO_KCAL = 4.184;
const SEARCH_PAGE_SIZE = 15;
const UNKNOWN_BARCODE_PRODUCT_NAME = 'Unknown product';

/** OFF often sends empty strings; treat them as missing instead of failing validation. */
const optionalOffString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const REGION_TO_OFF_COUNTRY_TAG: Record<string, string> = {
  AT: 'en:austria',
  CH: 'en:switzerland',
  DE: 'en:germany',
  US: 'en:united-states',
};

const DACH_REGIONS = new Set(['AT', 'CH', 'DE']);

const nutrimentsSchema = z
  .object({
    'energy-kcal_100g': z.coerce.number().finite().optional(),
    energy_100g: z.coerce.number().finite().optional(),
    proteins_100g: z.coerce.number().finite().optional(),
    carbohydrates_100g: z.coerce.number().finite().optional(),
    fat_100g: z.coerce.number().finite().optional(),
    fiber_100g: z.coerce.number().finite().optional(),
    sugars_100g: z.coerce.number().finite().optional(),
    sodium_100g: z.coerce.number().finite().optional(),
  })
  .passthrough();

const productSchema = z
  .object({
    product_name: optionalOffString,
    brands: optionalOffString,
    quantity: optionalOffString,
    serving_size: optionalOffString,
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

export class OpenFoodFactsRateLimitError extends Error {
  constructor() {
    super('Open Food Facts rate limit reached.');
    this.name = 'OpenFoodFactsRateLimitError';
  }
}

export class OpenFoodFactsSearchUnavailableError extends Error {
  constructor() {
    super('Open Food Facts search is temporarily unavailable.');
    this.name = 'OpenFoodFactsSearchUnavailableError';
  }
}

export type FoodSearchProduct = {
  offId: string;
  foodId?: string;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  sugarPer100g: number | null;
  sodiumPer100g: number | null;
  servingSizeGrams: number | null;
  servingSizeLabel: string | null;
  category: string | null;
};

export type OpenFoodFactsSearchLocale = {
  languageCode: string;
  regionCode: string | null;
  host: string;
  countryTag: string | null;
};

const searchProductSchema = z
  .object({
    code: z.union([z.string(), z.number()]).optional(),
    product_name: z.string().trim().optional(),
    brands: z.string().trim().optional(),
    serving_size: z.string().trim().optional(),
    categories: z.string().trim().optional(),
    nutriments: nutrimentsSchema.optional(),
  })
  .passthrough();

const searchResponseSchema = z.object({
  products: z.array(searchProductSchema).optional(),
});

export function parseGramsFromLabel(label: string | null | undefined): number | null {
  if (!label?.trim()) {
    return null;
  }

  const normalized = label.trim().toLowerCase().replace(/,/g, '.');

  function toPositiveGrams(value: number): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }

    const grams = Math.round(value);
    return grams > 0 ? grams : null;
  }

  const kgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kgMatch) {
    return toPositiveGrams(parseFloat(kgMatch[1]) * 1000);
  }

  const gMatch = normalized.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gMatch) {
    return toPositiveGrams(parseFloat(gMatch[1]));
  }

  const mlMatch = normalized.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) {
    return toPositiveGrams(parseFloat(mlMatch[1]));
  }

  const literMatch = normalized.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if (literMatch) {
    return toPositiveGrams(parseFloat(literMatch[1]) * 1000);
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

export function resolveOpenFoodFactsSearchLocale(params: {
  languageCode?: string | null;
  regionCode?: string | null;
}): OpenFoodFactsSearchLocale {
  const languageCode = params.languageCode?.trim().toLowerCase() || 'en';
  const regionCode = params.regionCode?.trim().toUpperCase() || null;
  const host =
    regionCode && DACH_REGIONS.has(regionCode)
      ? 'de.openfoodfacts.org'
      : 'world.openfoodfacts.org';
  const countryTag = regionCode ? (REGION_TO_OFF_COUNTRY_TAG[regionCode] ?? null) : null;

  return {
    languageCode,
    regionCode,
    host,
    countryTag,
  };
}

function macroOrZero(value: number | undefined): number {
  return value != null && Number.isFinite(value) ? value : 0;
}

function optionalMacro(value: number | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function resolveCategoryLabel(categories: string | undefined): string | null {
  const first = categories?.split(',')[0]?.trim();
  return first || null;
}

function mapToFoodSearchProduct(product: z.infer<typeof searchProductSchema>): FoodSearchProduct | null {
  const name = product.product_name?.trim();
  const offIdRaw = product.code;
  const offId =
    typeof offIdRaw === 'number'
      ? String(offIdRaw)
      : typeof offIdRaw === 'string'
        ? offIdRaw.trim()
        : '';

  if (!name || !offId) {
    return null;
  }

  const kcalPer100g = resolveKcalPer100g(product.nutriments);
  if (kcalPer100g == null || !Number.isFinite(kcalPer100g) || kcalPer100g <= 0) {
    return null;
  }

  const brand = product.brands?.split(',')[0]?.trim() || null;
  const servingSizeLabel = product.serving_size?.trim() || null;
  const servingSizeGrams = parseGramsFromLabel(servingSizeLabel);
  const nutriments = product.nutriments;

  return {
    offId,
    name,
    brand,
    kcalPer100g,
    proteinPer100g: macroOrZero(nutriments?.proteins_100g),
    carbsPer100g: macroOrZero(nutriments?.carbohydrates_100g),
    fatPer100g: macroOrZero(nutriments?.fat_100g),
    fiberPer100g: optionalMacro(nutriments?.fiber_100g),
    sugarPer100g: optionalMacro(nutriments?.sugars_100g),
    sodiumPer100g: optionalMacro(nutriments?.sodium_100g),
    servingSizeGrams,
    servingSizeLabel,
    category: resolveCategoryLabel(product.categories),
  };
}

export async function searchProductsByName(
  query: string,
  locale: OpenFoodFactsSearchLocale,
  options?: { signal?: AbortSignal },
): Promise<FoodSearchProduct[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 3) {
    return [];
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  function onExternalAbort() {
    timeoutController.abort();
  }

  options?.signal?.addEventListener('abort', onExternalAbort);

  try {
    const params = new URLSearchParams({
      search_terms: normalizedQuery,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: String(SEARCH_PAGE_SIZE),
      fields: 'code,product_name,brands,nutriments,serving_size,categories',
      lc: locale.languageCode,
    });

    if (locale.countryTag) {
      params.set('tagtype_0', 'countries');
      params.set('tag_contains_0', 'contains');
      params.set('tag_0', locale.countryTag);
    }

    const offRequestUrl = `https://${locale.host}${OPEN_FOOD_FACTS_SEARCH_PATH}?${params.toString()}`;

    const response = await fetch(offRequestUrl, {
      signal: timeoutController.signal,
      headers: {
        'User-Agent': OFF_USER_AGENT,
      },
    });

    if (response.status === 429) {
      throw new OpenFoodFactsRateLimitError();
    }

    if (!response.ok) {
      throw new OpenFoodFactsSearchUnavailableError();
    }

    let jsonPayload: unknown;
    try {
      jsonPayload = await response.json();
    } catch {
      throw new OpenFoodFactsSearchUnavailableError();
    }

    const payload = searchResponseSchema.safeParse(jsonPayload);
    if (!payload.success) {
      throw new OpenFoodFactsSearchUnavailableError();
    }

    return (payload.data.products ?? [])
      .map((product) => mapToFoodSearchProduct(product))
      .filter((product): product is FoodSearchProduct => product != null);
  } catch (error) {
    if (options?.signal?.aborted) {
      throw new BarcodeLookupAbortedError();
    }

    if (
      error instanceof OpenFoodFactsRateLimitError ||
      error instanceof OpenFoodFactsSearchUnavailableError ||
      error instanceof BarcodeLookupAbortedError
    ) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenFoodFactsSearchUnavailableError();
    }

    throw new OpenFoodFactsSearchUnavailableError();
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener('abort', onExternalAbort);
  }
}

function resolveBarcodeProductName(product: {
  product_name?: string;
  brands?: string;
  quantity?: string;
}): string {
  if (product.product_name) {
    return product.product_name;
  }

  const brand = product.brands?.split(',')[0]?.trim();
  const quantity = product.quantity?.trim();

  if (brand && quantity) {
    return `${brand}, ${quantity}`;
  }

  if (brand) {
    return brand;
  }

  if (quantity) {
    return quantity;
  }

  return UNKNOWN_BARCODE_PRODUCT_NAME;
}

function mapToBarcodeProduct(barcode: string, product: z.infer<typeof productSchema>): BarcodeProduct {
  const nutriments = product.nutriments;
  const kcalPer100g = resolveKcalPer100g(nutriments);

  if (kcalPer100g == null || !Number.isFinite(kcalPer100g) || kcalPer100g <= 0) {
    throw new BarcodeNutrimentsMissingError(barcode);
  }

  const proteinMissing = nutriments?.proteins_100g == null;
  const carbsMissing = nutriments?.carbohydrates_100g == null;
  const fatMissing = nutriments?.fat_100g == null;

  const quantityLabel = product.quantity?.trim() || null;
  const servingSizeLabel = product.serving_size?.trim() || null;
  const quantityGrams = parseGramsFromLabel(quantityLabel);
  const servingSizeGrams = parseGramsFromLabel(servingSizeLabel);

  return {
    barcode,
    productName: resolveBarcodeProductName(product),
    quantityLabel,
    servingSizeLabel,
    quantityGrams,
    servingSizeGrams,
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

    return mapToBarcodeProduct(normalizedBarcode, payload.data.product);
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
  searchProductsByName,
  resolveOpenFoodFactsSearchLocale,
  parseGramsFromLabel,
};
