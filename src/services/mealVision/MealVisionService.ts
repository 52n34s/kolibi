import { File } from 'expo-file-system';

import { prepareMealPhotoUri } from '@/lib/meal-photo';
import { supabase } from '@/lib/supabase';
import {
  visionResponseSchema,
  type VisionResponse,
} from '@/services/mealVision/types';

/** Placeholder model for meal-vision benchmark — swap here when benchmarking alternatives. */
export const MEAL_VISION_MODEL = 'claude-haiku-4-5';

// SYSTEM_PROMPT / USER_PROMPT (inkl. estimated_grams_per_unit) liegen serverseitig in
// supabase/functions/meal-vision-analyze/index.ts — der Client ruft nur die Edge Function auf.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

type MealVisionImagePayload = {
  mediaType: string;
  data: string;
};

export class MealVisionApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealVisionApiError';
  }
}

export class MealVisionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealVisionParseError';
  }
}

export class MealVisionRateLimitError extends Error {
  resetAt: string | null;

  constructor(message: string, resetAt?: string | null) {
    super(message);
    this.name = 'MealVisionRateLimitError';
    this.resetAt = resetAt ?? null;
  }
}

async function photoUriToBase64(uri: string): Promise<MealVisionImagePayload> {
  const preparedUri = await prepareMealPhotoUri(uri);
  const file = new File(preparedUri);
  const data = await file.base64();
  return {
    data,
    mediaType: 'image/jpeg',
  };
}

type EdgeFunctionSuccessPayload = {
  items: VisionResponse['items'];
};

type EdgeFunctionErrorPayload = {
  error?: string;
  message?: string;
  resetAt?: string;
};

export async function analyzeMealPhotos(photoUris: string[]): Promise<VisionResponse> {
  if (photoUris.length === 0) {
    throw new MealVisionApiError('At least one photo URI is required.');
  }

  if (!supabaseUrl) {
    throw new MealVisionApiError('Missing EXPO_PUBLIC_SUPABASE_URL environment variable.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new MealVisionApiError(sessionError.message);
  }

  if (!session?.access_token) {
    throw new MealVisionApiError('You must be signed in to scan a meal.');
  }

  const images = await Promise.all(photoUris.map((uri) => photoUriToBase64(uri)));

  const response = await fetch(`${supabaseUrl}/functions/v1/meal-vision-analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ images }),
  });

  const payload = (await response.json()) as EdgeFunctionSuccessPayload & EdgeFunctionErrorPayload;

  if (response.status === 429 || payload.error === 'RATE_LIMIT_EXCEEDED') {
    throw new MealVisionRateLimitError(
      payload.message ?? 'Daily scan limit reached.',
      payload.resetAt ?? null,
    );
  }

  if (!response.ok) {
    if (payload.error === 'INVALID_JSON') {
      throw new MealVisionParseError('The meal analysis response was invalid.');
    }

    if (payload.error === 'IMAGE_REJECTED') {
      throw new MealVisionApiError('One or more images could not be processed.');
    }

    if (payload.error === 'SCAN_UNAVAILABLE') {
      throw new MealVisionApiError('Scanning is temporarily unavailable.');
    }

    if (payload.error === 'PROVIDER_ERROR' || payload.error === 'TIMEOUT') {
      throw new MealVisionApiError('The meal analysis service failed.');
    }

    throw new MealVisionApiError('The meal analysis service failed.');
  }

  const validated = visionResponseSchema.safeParse({ items: payload.items });

  if (!validated.success) {
    throw new MealVisionParseError('The meal analysis response was invalid.');
  }

  return validated.data;
}

export const MealVisionService = {
  analyze: analyzeMealPhotos,
};
