import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.24.2';

/** Placeholder model for meal-vision benchmark — swap here when benchmarking alternatives. */
const MEAL_VISION_MODEL = 'claude-haiku-4-5';

/**
 * USD per million tokens, keyed by scan_logs.model_version.
 * Last checked: 2026-08-25 against https://platform.claude.com/docs/en/about-claude/pricing
 * (Haiku 4.5: $1 / MTok input, $5 / MTok output). Re-check when swapping models or quarterly.
 */
const MODEL_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
};

function estimateCostUsd(
  modelVersion: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (inputTokens == null && outputTokens == null) return null;
  const rates = MODEL_USD_PER_MTOK[modelVersion];
  if (!rates) return null;
  const cost =
    ((inputTokens ?? 0) * rates.input + (outputTokens ?? 0) * rates.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

const ANTHROPIC_TIMEOUT_MS = 60_000;
const MAX_REQUESTS_PER_DAY = 20;
const RATE_LIMIT_WINDOW = '1 day';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SCAN_LOG_ERROR_CHARS = 500;
const AI_SCAN_FEATURE_FLAG_KEY = 'ai_scan_enabled';

const CLIENT_MESSAGES = {
  METHOD_NOT_ALLOWED: 'Only POST is supported.',
  SERVER_MISCONFIGURED: 'The meal analysis service is temporarily unavailable.',
  UNAUTHORIZED: 'Invalid or expired session.',
  SCAN_UNAVAILABLE: 'Scanning is temporarily unavailable.',
  RATE_LIMIT_CHECK_FAILED: 'Unable to process scan at this time.',
  RATE_LIMIT_EXCEEDED: 'Daily scan limit reached.',
  INVALID_REQUEST: 'The scan request was invalid.',
  IMAGE_REJECTED: 'One or more images could not be processed.',
  INVALID_JSON: 'The meal analysis response was invalid.',
  TIMEOUT: 'The meal analysis request timed out.',
  PROVIDER_ERROR: 'The meal analysis service failed.',
} as const;

const SYSTEM_PROMPT = `You are a nutrition assistant that analyzes meal photos and estimates visible food items with quantities and calories.
Respond with valid JSON only. Do not wrap the JSON in markdown code fences.`;

function buildUserPrompt(language: string): string {
  return `Analyze the meal photo(s) and list every visible food item.

Return a JSON object with this shape:
{
  "items": [
    {
      "name": "Human-readable food name in the requested language",
      "canonical_name": "snake_case_english_identifier",
      "estimated_grams": null,
      "estimated_count": null,
      "estimated_grams_per_unit": null,
      "estimated_kcal": 0,
      "protein_g": null,
      "carbs_g": null,
      "fat_g": null,
      "fiber_g": null,
      "confidence": "low"
    }
  ]
}

Rules:
- Each item must include name, canonical_name, estimated_kcal, and confidence ("low" | "medium" | "high").
- Write "name" in language code "${language}" (de = German, en = English, es = Spanish). This is the user-facing label.
- Always write "canonical_name" as English snake_case (matching key for the foods database). Never translate canonical_name.
- For weight-based foods: set estimated_grams (positive number), estimated_count: null, estimated_grams_per_unit: null.
- For countable foods, ALWAYS provide both estimated_count AND estimated_grams_per_unit (approximate weight of a single unit in grams). Set estimated_grams to null.
- Never set both estimated_grams and estimated_count on the same item.
- Quantity in grams must always be derivable, even for countable items (estimated_count × estimated_grams_per_unit).
- protein_g, carbs_g, fat_g, and fiber_g are grams for the estimated portion of THIS item (matching estimated_grams or estimated_count × estimated_grams_per_unit), not per 100 g. Use null when you cannot estimate a value — never 0 as a placeholder. 0 means the food genuinely contains none of that macro.
- Use visible reference objects (fork, phone, card) to improve portion estimates when present.
- When unsure about portion size, choose the conservative (smaller) estimate. Prefer underestimating over overestimating. Reference anchors: a typical bread slice is 40–50 g; one tablespoon of spread is about 15 g; a medium serving of cooked rice is about 150 g.

Example (German name, English canonical_name — always keep this split):
{
  "items": [
    {
      "name": "Banane",
      "canonical_name": "banana",
      "estimated_grams": null,
      "estimated_count": 1,
      "estimated_grams_per_unit": 120,
      "estimated_kcal": 105,
      "protein_g": 1.3,
      "carbs_g": 27,
      "fat_g": 0.3,
      "fiber_g": 3.1,
      "confidence": "medium"
    },
    {
      "name": "Gekochter Reis",
      "canonical_name": "cooked_rice",
      "estimated_grams": 150,
      "estimated_count": null,
      "estimated_grams_per_unit": null,
      "estimated_kcal": 195,
      "protein_g": 3.6,
      "carbs_g": 43,
      "fat_g": 0.3,
      "fiber_g": 0.5,
      "confidence": "medium"
    }
  ]
}`;
}

function buildLabelUserPrompt(language: string): string {
  return `You receive one or more photos. Before anything else, decide what they predominantly show.

Set "image_type" to "label" when the photo predominantly shows a printed nutrition table (nutrition facts panel, Nährwerttabelle, tabla nutricional) that has a readable "per 100 g" or "per 100 ml" column.
Set "image_type" to "meal" in every other case: a plate or bowl of food, loose ingredients, packaging photographed without a readable nutrition table, or a nutrition table that only lists per-serving values.

=== When image_type is "label" ===

Return a JSON object with this shape:
{
  "image_type": "label",
  "label": {
    "name": "Product name in the requested language",
    "canonical_name": "snake_case_english_identifier",
    "basis": "per_100g",
    "kcal_per_100": 0,
    "protein_per_100": null,
    "carbs_per_100": null,
    "fat_per_100": null,
    "fiber_per_100": null,
    "sugar_per_100": null,
    "package_grams": null,
    "serving_grams": null,
    "confidence": "low"
  }
}

Rules for the label case:
- Transcribe the "per 100 g" / "per 100 ml" column literally, exactly as printed. Do not estimate, do not calculate, do not convert to a portion, and never fill in a value from what you know about the product.
- Read only that column. Per-serving, per-piece and per-package columns must never end up in these fields.
- Any value that is not printed or not legible is null. null means "not readable"; 0 means the label actually prints a zero.
- "basis" is "per_100g" when the column header says 100 g and "per_100ml" when it says 100 ml. Match the printed header.
- "kcal_per_100" is the kilocalorie value (kcal), not the kilojoule value (kJ). If the column prints only kJ and no kcal, set "image_type" to "meal" instead.
- Every other *_per_100 value is grams per 100 g / 100 ml, exactly as printed.
- "package_grams" is the net content of the whole package in grams (or ml), "serving_grams" the printed serving size in grams (or ml). Both are null when the photo does not show them.
- Write "name" in language code "${language}" (de = German, en = English, es = Spanish) — the product name as it appears on the packaging.
- Always write "canonical_name" as English snake_case (matching key for the foods database). Never translate canonical_name.
- "confidence" ("low" | "medium" | "high") reflects how legible the table was.
- Return the "label" object only. Do not return an "items" array for a label photo.
- Any dietary or cuisine context appended below applies to meal photos only. Ignore it when transcribing a label.

=== When image_type is "meal" ===

Return a JSON object with "image_type": "meal" plus the "items" array described below, following these instructions exactly:

${buildUserPrompt(language)}`;
}

const PROMPT_VERSION = 'v4-localized';
const LABEL_PROMPT_VERSION = 'v5-label';
const LABEL_FEATURE = 'label';

function hasLabelFeature(features: string[] | undefined): boolean {
  return features?.includes(LABEL_FEATURE) ?? false;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const visionConfidenceSchema = z.enum(['low', 'medium', 'high']);

const boundedMacroSchema = z.number().min(0).max(1000).optional();

const visionFoodItemSchema = z
  .object({
    name: z.string().min(1),
    canonical_name: z.string().min(1),
    estimated_grams: z.number().min(0).max(5000).nullable(),
    estimated_count: z.number().positive().max(5000).nullable(),
    estimated_grams_per_unit: z.number().min(0).max(5000).nullable(),
    estimated_kcal: z.number().min(0).max(5000),
    protein_g: boundedMacroSchema,
    carbs_g: boundedMacroSchema,
    fat_g: boundedMacroSchema,
    fiber_g: boundedMacroSchema,
    confidence: visionConfidenceSchema,
  })
  .superRefine((item, ctx) => {
    const hasCount = item.estimated_count != null;
    const hasGrams = item.estimated_grams != null;

    if (hasCount && hasGrams) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either estimated_grams or estimated_count, not both.',
      });
    }

    if (!hasCount && !hasGrams) {
      ctx.addIssue({
        code: 'custom',
        message: 'Either estimated_grams or estimated_count must be provided.',
      });
    }

    if (hasCount && item.estimated_grams_per_unit == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'estimated_grams_per_unit is required when estimated_count is set.',
      });
    }

    if (!hasCount && item.estimated_grams_per_unit != null) {
      ctx.addIssue({
        code: 'custom',
        message: 'estimated_grams_per_unit must be null when estimated_count is not set.',
      });
    }

    if (hasCount && item.estimated_grams_per_unit != null) {
      const totalGrams = item.estimated_count! * item.estimated_grams_per_unit;
      if (totalGrams > 5000) {
        ctx.addIssue({
          code: 'custom',
          message: 'Derived quantity_grams exceeds 5000.',
        });
      }
    }
  });

const visionResponseSchema = z.object({
  items: z.array(visionFoodItemSchema).min(1).max(30),
});

/** Per-100 g/ml value copied off the label; null = not printed or not legible. */
const labelPer100Schema = z.number().min(0).max(1000).nullable().default(null);
const labelWeightSchema = z.number().min(0).max(100_000).nullable().default(null);

const visionLabelSchema = z.object({
  name: z.string().min(1),
  canonical_name: z.string().min(1),
  basis: z.enum(['per_100g', 'per_100ml']),
  kcal_per_100: z.number().min(0).max(2000),
  protein_per_100: labelPer100Schema,
  carbs_per_100: labelPer100Schema,
  fat_per_100: labelPer100Schema,
  fiber_per_100: labelPer100Schema,
  sugar_per_100: labelPer100Schema,
  package_grams: labelWeightSchema,
  serving_grams: labelWeightSchema,
  confidence: visionConfidenceSchema,
});

/**
 * Label-mode response. The model tags the photo via image_type; a missing tag
 * means 'meal', so the pre-label meal shape still validates unchanged.
 */
const labelModeResponseSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (record.image_type == null) {
    return { ...record, image_type: 'meal' };
  }

  return record;
}, z.discriminatedUnion('image_type', [
  z.object({
    image_type: z.literal('meal'),
    items: z.array(visionFoodItemSchema).min(1).max(30),
  }),
  z.object({
    image_type: z.literal('label'),
    label: visionLabelSchema,
  }),
]));

type VisionLabel = z.infer<typeof visionLabelSchema>;

type LabelPlausibility = {
  checked: boolean;
  expected_kcal_eu: number | null;
  expected_kcal_us: number | null;
  /** null when checked is false. */
  passed: boolean | null;
};

const PLAUSIBILITY_RELATIVE_TOLERANCE = 0.1;
const PLAUSIBILITY_MIN_TOLERANCE_KCAL = 15;
/** Pure fat tops out near 900 kcal/100 g; above this the transcription is wrong. */
const MAX_PLAUSIBLE_KCAL_PER_100 = 950;
/** No macro can exceed 100 g per 100 g / 100 ml. */
const MAX_PLAUSIBLE_MACRO_PER_100 = 100;

function roundKcal(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}

/**
 * Values the label cannot physically print. A hit means the column was misread
 * (per-serving numbers, a shifted row, kJ in the kcal slot) — fail outright,
 * the Atwater tolerance would let some of these through.
 */
function hasImpossibleLabelValues(label: VisionLabel): boolean {
  if (label.kcal_per_100 > MAX_PLAUSIBLE_KCAL_PER_100) {
    return true;
  }

  const perHundred = [
    label.protein_per_100,
    label.carbs_per_100,
    label.fat_per_100,
    label.fiber_per_100,
    label.sugar_per_100,
  ];
  if (perHundred.some((value) => value != null && value > MAX_PLAUSIBLE_MACRO_PER_100)) {
    return true;
  }

  // Sugar is a subset of carbohydrates, never more.
  if (
    label.sugar_per_100 != null &&
    label.carbs_per_100 != null &&
    label.sugar_per_100 > label.carbs_per_100
  ) {
    return true;
  }

  return false;
}

/**
 * Atwater cross-check against the printed kcal.
 * EU counts fibre at 2 kcal/g, the US factors leave it out. A missing macro
 * drops the formula that needs it; with no formula left, nothing is checked.
 */
function evaluateLabelPlausibility(label: VisionLabel): LabelPlausibility {
  const protein = label.protein_per_100;
  const carbs = label.carbs_per_100;
  const fat = label.fat_per_100;
  const fiber = label.fiber_per_100;

  const us =
    protein != null && carbs != null && fat != null
      ? 4 * protein + 4 * carbs + 9 * fat
      : null;
  const eu = us != null && fiber != null ? us + 2 * fiber : null;

  if (hasImpossibleLabelValues(label)) {
    return {
      checked: true,
      expected_kcal_eu: roundKcal(eu),
      expected_kcal_us: roundKcal(us),
      passed: false,
    };
  }

  if (us == null && eu == null) {
    return {
      checked: false,
      expected_kcal_eu: null,
      expected_kcal_us: null,
      passed: null,
    };
  }

  const tolerance = Math.max(
    label.kcal_per_100 * PLAUSIBILITY_RELATIVE_TOLERANCE,
    PLAUSIBILITY_MIN_TOLERANCE_KCAL,
  );
  const passed = [eu, us].some(
    (expected) => expected != null && Math.abs(expected - label.kcal_per_100) <= tolerance,
  );

  return {
    checked: true,
    expected_kcal_eu: roundKcal(eu),
    expected_kcal_us: roundKcal(us),
    passed,
  };
}

const requestSchema = z.object({
  images: z
    .array(
      z.object({
        mediaType: z.string().min(1),
        data: z.string().min(1),
      }),
    )
    .min(1)
    .max(3),
  /** Opt-in flags. Only 'label' is read today; absent = pre-label behaviour. */
  features: z.array(z.string()).max(8).optional(),
  language: z
    .string()
    .optional()
    .transform((value) => {
      const code = value?.trim().toLowerCase().split('-')[0];
      if (code === 'de' || code === 'es' || code === 'en') {
        return code;
      }
      return 'en';
    })
    .default('en'),
});

type ScanLogStatus =
  | 'success'
  | 'timeout'
  | 'provider_error'
  | 'invalid_json'
  | 'image_rejected';

type MealVisionImage = z.infer<typeof requestSchema>['images'][number];

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    type?: string;
    message?: string;
  };
};

type ImageValidationResult =
  | { ok: true; totalBytes: number }
  | { ok: false; reason: string };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getNextUtcMidnightIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  ).toISOString();
}

function estimateBase64DecodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function truncateScanLogMessage(message: string | null): string | null {
  if (!message) {
    return null;
  }

  let sanitized = message
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, '[redacted image]')
    .replace(/Bearer\s+\S+/gi, '[redacted token]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted token]');

  if (sanitized.length > MAX_SCAN_LOG_ERROR_CHARS) {
    sanitized = sanitized.slice(0, MAX_SCAN_LOG_ERROR_CHARS);
  }

  return sanitized;
}

function toScanLogMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return truncateScanLogMessage(message) ?? fallback;
}

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate);
}

async function isAiScanEnabled(
  serviceClient: ReturnType<typeof createClient>,
): Promise<boolean> {
  try {
    const { data, error } = await serviceClient
      .from('feature_flags')
      .select('enabled')
      .eq('key', AI_SCAN_FEATURE_FLAG_KEY)
      .maybeSingle();

    if (error) {
      console.error('feature_flags query failed; failing open:', error);
      return true;
    }

    if (!data) {
      return true;
    }

    return data.enabled !== false;
  } catch (error) {
    console.error('feature_flags query threw; failing open:', error);
    return true;
  }
}

function validateImages(images: MealVisionImage[]): ImageValidationResult {
  let totalBytes = 0;

  for (const image of images) {
    if (!ALLOWED_MIME_TYPES.has(image.mediaType)) {
      return {
        ok: false,
        reason: `Unsupported media type: ${image.mediaType}`,
      };
    }

    const bytes = estimateBase64DecodedBytes(image.data);
    if (bytes > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        reason: `Image exceeds per-image byte limit (${bytes} bytes).`,
      };
    }

    totalBytes += bytes;
  }

  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    return {
      ok: false,
      reason: `Total image payload exceeds byte limit (${totalBytes} bytes).`,
    };
  }

  return { ok: true, totalBytes };
}

const SCAN_LOG_ITEM_FIELDS = [
  'name',
  'canonical_name',
  'estimated_grams',
  'estimated_count',
  'estimated_grams_per_unit',
  'estimated_kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'confidence',
] as const;

const SCAN_LOG_LABEL_FIELDS = [
  'name',
  'canonical_name',
  'basis',
  'kcal_per_100',
  'protein_per_100',
  'carbs_per_100',
  'fat_per_100',
  'fiber_per_100',
  'sugar_per_100',
  'package_grams',
  'serving_grams',
  'confidence',
] as const;

type ScanLogRawResponse =
  | {
      items: Array<Record<string, unknown>>;
    }
  | {
      image_type: 'label';
      label: Record<string, unknown>;
      plausibility: LabelPlausibility | null;
    };

function sanitizeModelOutputForScanLog(
  parsed: unknown,
  plausibility: LabelPlausibility | null = null,
): ScanLogRawResponse | null {
  let candidate: unknown = parsed;

  if (Array.isArray(parsed)) {
    candidate = { items: parsed };
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;

  // Label photos log the transcribed table plus the server-side kcal check.
  const labelCandidate = record.label;
  if (
    record.image_type === 'label' &&
    !!labelCandidate &&
    typeof labelCandidate === 'object' &&
    !Array.isArray(labelCandidate)
  ) {
    const labelRecord = labelCandidate as Record<string, unknown>;
    const sanitizedLabel: Record<string, unknown> = {};
    for (const field of SCAN_LOG_LABEL_FIELDS) {
      if (field in labelRecord) {
        sanitizedLabel[field] = labelRecord[field];
      }
    }

    return { image_type: 'label', label: sanitizedLabel, plausibility };
  }

  if (!Array.isArray(record.items)) {
    return null;
  }

  const items = record.items
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item),
    )
    .map((item) => {
      const sanitized: Record<string, unknown> = {};
      for (const field of SCAN_LOG_ITEM_FIELDS) {
        if (field in item) {
          sanitized[field] = item[field];
        }
      }
      return sanitized;
    });

  return { items };
}

function trySalvageModelOutput(rawText: string): ScanLogRawResponse | null {
  const attempts = [
    rawText.trim(),
    rawText.trim().match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(),
    rawText.trim().match(/\{[\s\S]*\}/)?.[0],
  ].filter((value): value is string => !!value);

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      const sanitized = sanitizeModelOutputForScanLog(parsed);
      if (sanitized) {
        return sanitized;
      }
    } catch {
      // Try the next salvage candidate.
    }
  }

  return null;
}

async function writeScanLog(
  serviceClient: ReturnType<typeof createClient>,
  params: {
    userId: string;
    promptVersion: string;
    status: ScanLogStatus;
    errorMessage: string | null;
    latencyMs: number;
    numImages: number;
    inputTokens: number | null;
    outputTokens: number | null;
    rawResponse: ScanLogRawResponse | null;
  },
): Promise<void> {
  const { error } = await serviceClient.from('scan_logs').insert({
    user_id: params.userId,
    meal_id: null,
    provider: 'anthropic',
    model_version: MEAL_VISION_MODEL,
    prompt_version: params.promptVersion,
    num_images: params.numImages,
    latency_ms: params.latencyMs,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    estimated_cost_usd: estimateCostUsd(
      MEAL_VISION_MODEL,
      params.inputTokens,
      params.outputTokens,
    ),
    status: params.status,
    error_message: truncateScanLogMessage(params.errorMessage),
    raw_response: params.rawResponse,
  });

  if (error) {
    console.error('Failed to write scan_logs entry:', error);
  }
}

async function callAnthropic(
  apiKey: string,
  images: MealVisionImage[],
  userPromptText: string,
): Promise<AnthropicResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MEAL_VISION_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((image) => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mediaType,
                  data: image.data,
                },
              })),
              {
                type: 'text',
                text: userPromptText,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as AnthropicResponse;

    if (!response.ok) {
      const providerMessage = payload.error?.message ?? `Anthropic request failed (${response.status})`;
      console.error('Anthropic request failed:', {
        status: response.status,
        message: providerMessage,
      });

      if (response.status === 400 && /image/i.test(providerMessage)) {
        throw Object.assign(new Error(providerMessage), { scanStatus: 'image_rejected' as ScanLogStatus });
      }

      throw new Error(providerMessage);
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

const CUISINE_PROMPT_LABELS: Record<string, string> = {
  western: 'European/Western',
  mediterranean: 'Mediterranean and Middle Eastern',
  east_asian: 'East Asian',
  south_asian: 'South Asian',
  latin_american: 'Latin American',
  african: 'African',
};

type FoodContextProfile = {
  diet_preference: string | null;
  cuisine_context: string[] | null;
};

function buildFoodContextPromptBlock(profile: FoodContextProfile | null): string {
  if (!profile) {
    return '';
  }

  const blocks: string[] = [];
  const diet = profile.diet_preference;

  if (diet === 'vegan' || diet === 'vegetarian' || diet === 'pescatarian') {
    blocks.push(
      `Context: this user eats a ${diet} diet. When a component is visually ambiguous between an animal product and a plant-based alternative (e.g. minced meat vs. soy mince, chicken vs. tofu, dairy vs. plant milk), prefer the plant-based interpretation. This is a prior, not a rule — if the image clearly shows an animal product, identify it as such.`,
    );
  }

  const cuisines = Array.isArray(profile.cuisine_context)
    ? profile.cuisine_context.filter((value) => typeof value === 'string' && value.length > 0)
    : [];
  const isWesternOnly = cuisines.length === 1 && cuisines[0] === 'western';

  if (cuisines.length > 0 && !isWesternOnly) {
    const labels = cuisines
      .map((value) => CUISINE_PROMPT_LABELS[value] ?? value.replace(/_/g, ' '))
      .join(', ');
    blocks.push(
      `Context: this user commonly eats ${labels} cuisine. Use this to disambiguate visually similar staples (e.g. rice vs. couscous vs. bulgur, sauces, breads) and to choose more accurate dish names.`,
    );
  }

  return blocks.join('\n\n');
}

async function loadFoodContextPromptBlock(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  try {
    const { data: profile, error } = await serviceClient
      .from('profiles')
      .select('diet_preference, cuisine_context')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load food context profile for meal vision:', error);
      return '';
    }

    return buildFoodContextPromptBlock(profile as FoodContextProfile | null);
  } catch (error) {
    console.error('Food context profile query threw:', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: 'METHOD_NOT_ALLOWED', message: CLIENT_MESSAGES.METHOD_NOT_ALLOWED },
      405,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Supabase environment is not configured.');
    return jsonResponse(
      { error: 'SERVER_MISCONFIGURED', message: CLIENT_MESSAGES.SERVER_MISCONFIGURED },
      500,
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'UNAUTHORIZED', message: CLIENT_MESSAGES.UNAUTHORIZED }, 401);
  }

  const accessToken = authHeader.slice('Bearer '.length).trim();
  if (!accessToken) {
    return jsonResponse({ error: 'UNAUTHORIZED', message: CLIENT_MESSAGES.UNAUTHORIZED }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  if (userError || !user) {
    return jsonResponse({ error: 'UNAUTHORIZED', message: CLIENT_MESSAGES.UNAUTHORIZED }, 401);
  }

  const aiScanEnabled = await isAiScanEnabled(serviceClient);
  if (!aiScanEnabled) {
    return jsonResponse(
      { error: 'SCAN_UNAVAILABLE', message: CLIENT_MESSAGES.SCAN_UNAVAILABLE },
      503,
    );
  }

  const { data: rateLimitAllowed, error: rateLimitError } = await serviceClient.rpc(
    'check_scan_rate_limit',
    {
      p_user_id: user.id,
      p_max_requests: MAX_REQUESTS_PER_DAY,
      p_window: RATE_LIMIT_WINDOW,
    },
  );

  if (rateLimitError) {
    console.error('check_scan_rate_limit RPC failed:', rateLimitError);
    return jsonResponse(
      {
        error: 'RATE_LIMIT_CHECK_FAILED',
        message: CLIENT_MESSAGES.RATE_LIMIT_CHECK_FAILED,
      },
      500,
    );
  }

  if (!rateLimitAllowed) {
    return jsonResponse(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: CLIENT_MESSAGES.RATE_LIMIT_EXCEEDED,
        resetAt: getNextUtcMidnightIso(),
      },
      429,
    );
  }

  if (!anthropicApiKey) {
    console.error('Anthropic API key is not configured.');
    return jsonResponse(
      { error: 'PROVIDER_ERROR', message: CLIENT_MESSAGES.PROVIDER_ERROR },
      500,
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return jsonResponse({ error: 'INVALID_REQUEST', message: CLIENT_MESSAGES.INVALID_REQUEST }, 400);
  }

  const parsedRequest = requestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    console.error('Invalid meal-vision request body:', parsedRequest.error);
    return jsonResponse({ error: 'INVALID_REQUEST', message: CLIENT_MESSAGES.INVALID_REQUEST }, 400);
  }

  const images = parsedRequest.data.images;
  const language = parsedRequest.data.language;
  const labelMode = hasLabelFeature(parsedRequest.data.features);
  const promptVersion = labelMode ? LABEL_PROMPT_VERSION : PROMPT_VERSION;
  const imageValidation = validateImages(images);
  if (!imageValidation.ok) {
    console.error('Image validation rejected request:', imageValidation.reason);
    await writeScanLog(serviceClient, {
      userId: user.id,
      promptVersion,
      status: 'image_rejected',
      errorMessage: imageValidation.reason,
      latencyMs: 0,
      numImages: images.length,
      inputTokens: null,
      outputTokens: null,
      rawResponse: null,
    });

    return jsonResponse({ error: 'IMAGE_REJECTED', message: CLIENT_MESSAGES.IMAGE_REJECTED }, 400);
  }

  const startedAt = Date.now();
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  try {
    const foodContextBlock = await loadFoodContextPromptBlock(serviceClient, user.id);
    const userPromptBase = labelMode
      ? buildLabelUserPrompt(language)
      : buildUserPrompt(language);
    const userPromptText = foodContextBlock
      ? `${userPromptBase}\n\n${foodContextBlock}`
      : userPromptBase;

    const anthropicResponse = await callAnthropic(anthropicApiKey, images, userPromptText);
    const latencyMs = Date.now() - startedAt;
    inputTokens = anthropicResponse.usage?.input_tokens ?? null;
    outputTokens = anthropicResponse.usage?.output_tokens ?? null;

    const textBlock = anthropicResponse.content?.find((block) => block.type === 'text');
    const rawText = textBlock?.text?.trim();

    if (!rawText) {
      const errorMessage = 'Anthropic response did not include text content.';
      console.error(errorMessage);
      await writeScanLog(serviceClient, {
        userId: user.id,
        promptVersion,
        status: 'invalid_json',
        errorMessage,
        latencyMs,
        numImages: images.length,
        inputTokens,
        outputTokens,
        rawResponse: null,
      });

      return jsonResponse({ error: 'INVALID_JSON', message: CLIENT_MESSAGES.INVALID_JSON }, 422);
    }

    let parsedJson: unknown;
    try {
      parsedJson = extractJsonPayload(rawText);
    } catch (parseError) {
      const errorMessage = toScanLogMessage(parseError, 'Failed to parse JSON from model output.');
      console.error('Failed to parse JSON from model output:', parseError);
      await writeScanLog(serviceClient, {
        userId: user.id,
        promptVersion,
        status: 'invalid_json',
        errorMessage,
        latencyMs,
        numImages: images.length,
        inputTokens,
        outputTokens,
        rawResponse: trySalvageModelOutput(rawText),
      });

      return jsonResponse({ error: 'INVALID_JSON', message: CLIENT_MESSAGES.INVALID_JSON }, 422);
    }

    const rawResponse = sanitizeModelOutputForScanLog(parsedJson);

    const validated = labelMode
      ? labelModeResponseSchema.safeParse(parsedJson)
      : visionResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      const errorMessage = truncateScanLogMessage(validated.error.message) ?? 'Model output failed validation.';
      console.error('Model output failed validation:', validated.error);
      await writeScanLog(serviceClient, {
        userId: user.id,
        promptVersion,
        status: 'invalid_json',
        errorMessage,
        latencyMs,
        numImages: images.length,
        inputTokens,
        outputTokens,
        rawResponse,
      });

      return jsonResponse({ error: 'INVALID_JSON', message: CLIENT_MESSAGES.INVALID_JSON }, 422);
    }

    const validatedData = validated.data;

    if ('label' in validatedData) {
      const plausibility = evaluateLabelPlausibility(validatedData.label);

      await writeScanLog(serviceClient, {
        userId: user.id,
        promptVersion,
        status: 'success',
        errorMessage: null,
        latencyMs,
        numImages: images.length,
        inputTokens,
        outputTokens,
        rawResponse: sanitizeModelOutputForScanLog(validatedData, plausibility),
      });

      return jsonResponse(
        { image_type: 'label', label: validatedData.label, plausibility },
        200,
      );
    }

    await writeScanLog(serviceClient, {
      userId: user.id,
      promptVersion,
      status: 'success',
      errorMessage: null,
      latencyMs,
      numImages: images.length,
      inputTokens,
      outputTokens,
      rawResponse: sanitizeModelOutputForScanLog(validatedData),
    });

    // Without the label feature the payload stays exactly as it was.
    return jsonResponse(
      labelMode
        ? { image_type: 'meal', items: validatedData.items }
        : { items: validatedData.items },
      200,
    );
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const scanStatus: ScanLogStatus =
      error instanceof Error && error.name === 'AbortError'
        ? 'timeout'
        : typeof (error as { scanStatus?: ScanLogStatus }).scanStatus === 'string'
          ? ((error as { scanStatus: ScanLogStatus }).scanStatus)
          : 'provider_error';
    const errorMessage = toScanLogMessage(error, 'Meal vision provider failed.');
    console.error('Meal vision provider failed:', error);

    await writeScanLog(serviceClient, {
      userId: user.id,
      promptVersion,
      status: scanStatus,
      errorMessage,
      latencyMs,
      numImages: images.length,
      inputTokens,
      outputTokens,
      rawResponse: null,
    });

    if (scanStatus === 'timeout') {
      return jsonResponse({ error: 'TIMEOUT', message: CLIENT_MESSAGES.TIMEOUT }, 504);
    }

    if (scanStatus === 'image_rejected') {
      return jsonResponse({ error: 'IMAGE_REJECTED', message: CLIENT_MESSAGES.IMAGE_REJECTED }, 400);
    }

    return jsonResponse({ error: 'PROVIDER_ERROR', message: CLIENT_MESSAGES.PROVIDER_ERROR }, 502);
  }
});
