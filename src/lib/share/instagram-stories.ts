/**
 * Instagram Stories sharing — pure helpers.
 *
 * Meta requires a Facebook App ID as `source_application`. It comes from the
 * EAS environment variable EXPO_PUBLIC_FACEBOOK_APP_ID (inlined at bundle
 * time); without it the Instagram button stays hidden.
 */
import type { StickerFormat, StickerVariant } from '@/lib/share/sticker-data';

export const INSTAGRAM_STORIES_URL = 'instagram-stories://share';

/** A Facebook App ID is numeric; anything else counts as not configured. */
export function instagramAppIdFrom(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  return /^\d{5,20}$/.test(value) ? value : null;
}

/** Backdrop behind a transparent sticker, matching the sheet preview. */
const STICKER_BACKDROP: Record<StickerVariant, { top: string; bottom: string }> = {
  light: { top: '#2B2E36', bottom: '#15171C' },
  dark: { top: '#ECEBF6', bottom: '#D9D6F0' },
};

/**
 * The story card is a full 1080 × 1920 image and goes in as the background;
 * the transparent sticker goes in as a movable sticker on a brand backdrop.
 */
export function instagramStoryItems(
  fileUri: string,
  format: StickerFormat,
  variant: StickerVariant,
): {
  stickerUri?: string;
  backgroundUri?: string;
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
} {
  if (format === 'story') {
    return { backgroundUri: fileUri };
  }
  const backdrop = STICKER_BACKDROP[variant];
  return {
    stickerUri: fileUri,
    backgroundTopColor: backdrop.top,
    backgroundBottomColor: backdrop.bottom,
  };
}
