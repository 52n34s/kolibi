import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export const MEAL_PHOTO_MAX_EDGE_PX = 1568;
export const MEAL_PHOTO_JPEG_QUALITY = 0.7;

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

function getResizeDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } | null {
  const longEdge = Math.max(width, height);

  if (longEdge <= maxEdge) {
    return null;
  }

  const scale = maxEdge / longEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareMealPhotoUri(
  uri: string,
  options?: {
    maxEdgePx?: number;
    jpegQuality?: number;
  },
): Promise<string> {
  const maxEdgePx = options?.maxEdgePx ?? MEAL_PHOTO_MAX_EDGE_PX;
  const jpegQuality = options?.jpegQuality ?? MEAL_PHOTO_JPEG_QUALITY;
  const { width, height } = await getImageDimensions(uri);
  const resize = getResizeDimensions(width, height, maxEdgePx);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    resize ? [{ resize }] : [],
    {
      compress: jpegQuality,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return result.uri;
}
