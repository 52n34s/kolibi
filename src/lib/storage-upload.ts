import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { base64ToArrayBuffer } from '@/lib/base64';
import { supabase } from '@/lib/supabase';

/**
 * The one way images reach Supabase Storage.
 *
 * Both call sites used to `fetch(localUri).then((r) => r.blob())` and hand the
 * result to `storage.upload()`. In React Native that Blob is a handle into the
 * native blob store, not the bytes, so the request went out with an empty body
 * and Storage answered HTTP 400 — every exercise photo and every avatar failed,
 * and the bucket stayed empty. The manipulator hands us base64, which decodes
 * into an ArrayBuffer the Supabase client can actually send.
 */

export type UploadImageFormat = 'jpeg' | 'webp';

const CONTENT_TYPES: Record<UploadImageFormat, string> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const SAVE_FORMATS: Record<UploadImageFormat, ImageManipulator.SaveFormat> = {
  jpeg: ImageManipulator.SaveFormat.JPEG,
  webp: ImageManipulator.SaveFormat.WEBP,
};

function measure(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

export type UploadImageParams = {
  bucket: string;
  /** Must start with the user's id — the storage policies key off the folder. */
  objectPath: string;
  localUri: string;
  format: UploadImageFormat;
  maxEdgePx: number;
  /** 0–1, passed straight to the encoder. */
  quality: number;
};

export async function uploadImageToStorage(
  params: UploadImageParams,
): Promise<{ objectPath: string; byteLength: number }> {
  const { width, height } = await measure(params.localUri);

  const longEdge = Math.max(width, height);
  const scale = longEdge > params.maxEdgePx ? params.maxEdgePx / longEdge : 1;
  const actions =
    scale < 1
      ? [
          {
            resize: {
              width: Math.max(1, Math.round(width * scale)),
              height: Math.max(1, Math.round(height * scale)),
            },
          },
        ]
      : [];

  const manipulated = await ImageManipulator.manipulateAsync(params.localUri, actions, {
    compress: params.quality,
    format: SAVE_FORMATS[params.format],
    base64: true,
  });

  if (!manipulated.base64) {
    throw new Error('image_encode_failed');
  }

  const body = base64ToArrayBuffer(manipulated.base64);
  if (body.byteLength === 0) {
    // Exactly what the old Blob path did. Never let it reach the server again.
    throw new Error('image_encode_empty');
  }

  const { error } = await supabase.storage
    .from(params.bucket)
    .upload(params.objectPath, body, {
      upsert: true,
      contentType: CONTENT_TYPES[params.format],
    });

  if (error) {
    throw error;
  }

  return { objectPath: params.objectPath, byteLength: body.byteLength };
}
