import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** Stickers are laid out at this width in points and exported at 1080 px. */
export const STICKER_LAYOUT_WIDTH = 360;
export const STICKER_EXPORT_WIDTH = 1080;
/** Story card: 1080 × 1920. */
export const STORY_LAYOUT_HEIGHT = 640;

export type SaveStickerResult = 'saved' | 'permission_denied';

function measure(view: View): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    view.measure((_x, _y, width, height) => resolve({ width, height }));
  });
}

/**
 * Renders the view to a PNG file with alpha, `width` pixels wide.
 *
 * view-shot takes the target size in points and multiplies it by the screen
 * scale, so the pixel width is divided by the pixel ratio first.
 * The captured view and everything inside it must stay without a background
 * colour, otherwise the sticker gets a box.
 */
export async function captureSticker(
  ref: RefObject<View | null>,
  { width }: { width: number },
): Promise<string> {
  const view = ref.current;
  if (!view) {
    throw new Error('Sticker view is not mounted');
  }
  const layout = await measure(view);
  if (!(layout.width > 0) || !(layout.height > 0)) {
    throw new Error('Sticker view has no size yet');
  }
  const ratio = PixelRatio.get();
  const targetWidth = width / ratio;
  return captureRef(ref, {
    format: 'png',
    result: 'tmpfile',
    width: targetWidth,
    height: (layout.height * targetWidth) / layout.width,
  });
}

/** Adds the PNG to Photos with add-only access (no read access to the library). */
export async function saveStickerToPhotos(fileUri: string): Promise<SaveStickerResult> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    return 'permission_denied';
  }
  await MediaLibrary.Asset.create(fileUri);
  return 'saved';
}

export async function copySticker(fileUri: string): Promise<void> {
  const base64 = await new File(fileUri).base64();
  await Clipboard.setImageAsync(base64);
}

export async function shareSticker(fileUri: string): Promise<void> {
  await Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png' });
}
