import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type InstagramStoryItems = {
  /** file:// PNG shown as a movable sticker. */
  stickerUri?: string;
  /** file:// full-screen 9:16 background image. */
  backgroundUri?: string;
  /** #RRGGBB behind a sticker that has no background image. */
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
};

type InstagramStoriesNativeModule = {
  share(appId: string, items: InstagramStoryItems): Promise<boolean>;
};

/** Null on Android, web and in binaries built before the module existed. */
const native: InstagramStoriesNativeModule | null =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<InstagramStoriesNativeModule>('InstagramStories')
    : null;

export function isInstagramStoriesModuleAvailable(): boolean {
  return native != null;
}

/** Pasteboard items + instagram-stories:// — false when Instagram did not open. */
export async function shareToInstagramStory(
  appId: string,
  items: InstagramStoryItems,
): Promise<boolean> {
  if (!native) {
    return false;
  }
  return native.share(appId, items);
}
