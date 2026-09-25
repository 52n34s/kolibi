const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Stickers only add photos, they never read the library.
 *
 * expo-media-library's config plugin declares READ_EXTERNAL_STORAGE and
 * WRITE_EXTERNAL_STORAGE app-wide without an upper bound. Capping both at
 * API 32 matches what expo-image-picker and expo-media-library already declare
 * in their own manifests: the existing gallery picker still gets its legacy
 * storage access on Android 12 and older, and nothing reads storage on 13+.
 * READ_MEDIA_* and READ_MEDIA_VISUAL_USER_SELECTED are removed through
 * `android.blockedPermissions` in app.json.
 */
const LEGACY_STORAGE = new Set([
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]);
const MAX_SDK = '32';

function withAddOnlyMediaPermissions(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const permissions = manifestConfig.modResults.manifest['uses-permission'] ?? [];
    for (const entry of permissions) {
      if (LEGACY_STORAGE.has(entry.$['android:name'])) {
        entry.$['android:maxSdkVersion'] = MAX_SDK;
      }
    }
    return manifestConfig;
  });
}

module.exports = withAddOnlyMediaPermissions;
