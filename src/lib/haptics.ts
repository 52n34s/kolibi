import { requireOptionalNativeModule } from 'expo';

/**
 * Success haptic, or nothing.
 *
 * expo-haptics is loaded lazily and only when its native module is in the
 * binary: dev clients and store builds from before 1.4 lack it, and a static
 * import would throw at startup there.
 */
export function notifySuccessHaptic(): void {
  try {
    if (!requireOptionalNativeModule('ExpoHaptics')) {
      return;
    }
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      // Low Power Mode or disabled system haptics — nothing to do.
    });
  } catch {
    // Missing native code disables the feature.
  }
}

/** Light tick when a chart selection moves to another point, or nothing. */
export function selectionHaptic(): void {
  try {
    if (!requireOptionalNativeModule('ExpoHaptics')) {
      return;
    }
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    void Haptics.selectionAsync().catch(() => {
      // Low Power Mode or disabled system haptics — nothing to do.
    });
  } catch {
    // Missing native code disables the feature.
  }
}
