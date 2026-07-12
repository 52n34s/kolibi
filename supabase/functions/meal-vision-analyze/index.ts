import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.24.2';

/** Placeholder model for meal-vision benchmark — swap here when benchmarking alternatives. */
const MEAL_VISION_MODEL = 'claude-haiku-4-5';
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

const USER_PROMPT = `Analyze the meal photo(s) and list every visible food item.

Return a JSON object with this shape:
{
  "items": [
    {
      "name": "Human-readable food name",
      "canonical_name": "snake_case_english_identifier",
      "estimated_grams": null,
      "estimated_count": null,
      "estimated_grams_per_unit": null,
      "estimated_kcal": 0,
      "confidence": "low"
    }
  ]
}

Rules:
- Each item must include name, canonical_name, estimated_kcal, and confidence ("low" | "medium" | "high").
- For weight-based foods: set estimated_grams (positive number), estimated_count: null, estimated_grams_per_unit: null.
- For countable foods, ALWAYS provide both estimated_count AND estimated_grams_per_unit (approximate weight of a single unit in grams). Set estimated_grams to null.
- Never set both estimated_grams and estimated_count on the same item.
- Quantity in grams must always be derivable, even for countable items (estimated_count × estimated_grams_per_unit).
- Use visible reference objects (fork, phone, card) to improve portion estimates when present.

Example:
{
  "items": [
    {
      "name": "Banana",
      "canonical_name": "banana",
      "estimated_grams": null,
      "estimated_count": 1,
      "estimated_grams_per_unit": 120,
      "estimated_kcal": 105,
      "confidence": "medium"
    },
    {
      "name": "Cooked rice",
      "canonical_name": "rice_cooked",
      "estimated_grams": 180,
      "estimated_count": null,
      "estimated_grams_per_unit": null,
      "estimated_kcal": 234,
      "confidence": "medium"
    }
  ]
}`;

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
  'confidence',
] as const;

type ScanLogRawResponse = {
  items: Array<Record<string, unknown>>;
};

function sanitizeModelOutputForScanLog(parsed: unknown): ScanLogRawResponse | null {
  let candidate: unknown = parsed;

  if (Array.isArray(parsed)) {
    candidate = { items: parsed };
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
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
    num_images: params.numImages,
    latency_ms: params.latencyMs,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    status: params.status,
    error_message: truncateScanLogMessage(params.errorMessage),
    raw_response: params.rawResponse,
  });

  if (error) {
    console.error('Failed to write scan_logs entry:', error);
  }
}

async function callAnthropic(apiKey: string, images: MealVisionImage[]): Promise<AnthropicResponse> {
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
                text: USER_PROMPT,
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
  const imageValidation = validateImages(images);
  if (!imageValidation.ok) {
    console.error('Image validation rejected request:', imageValidation.reason);
    await writeScanLog(serviceClient, {
      userId: user.id,
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
    const anthropicResponse = await callAnthropic(anthropicApiKey, images);
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

    const validated = visionResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      const errorMessage = truncateScanLogMessage(validated.error.message) ?? 'Model output failed validation.';
      console.error('Model output failed validation:', validated.error);
      await writeScanLog(serviceClient, {
        userId: user.id,
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

    await writeScanLog(serviceClient, {
      userId: user.id,
      status: 'success',
      errorMessage: null,
      latencyMs,
      numImages: images.length,
      inputTokens,
      outputTokens,
      rawResponse: sanitizeModelOutputForScanLog(validated.data),
    });

    return jsonResponse({ items: validated.data.items }, 200);
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
