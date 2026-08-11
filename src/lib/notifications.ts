import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';
import { syncProfileTimezone } from '@/lib/profile-timezone';

const secureStore = createChunkedSecureStoreAdapter();

const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';

/** Survives reinstall via iOS Keychain — only set after user answers the system prompt. */
export const PUSH_PERMISSION_ASKED_KEY = 'push_permission_asked';

export async function clearPushPermissionAskedFlag(): Promise<void> {
  await secureStore.removeItem(PUSH_PERMISSION_ASKED_KEY);
}

Notifications.setNotificationHandler({
  handleNotification: (async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  })) as any,
});

function getExpoProjectId(): string | null {
  const anyConstants = Constants as any;
  return (
    anyConstants?.easConfig?.projectId ??
    anyConstants?.expoConfig?.extra?.eas?.projectId ??
    anyConstants?.manifest2?.extra?.eas?.projectId ??
    anyConstants?.manifest?.extra?.eas?.projectId ??
    null
  );
}

async function getDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const idForVendor = await Application.getIosIdForVendorAsync();
      return idForVendor ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

export type PushRegistrationResult = {
  status: 'granted' | 'denied' | 'error';
  token: string | null;
};

export async function registerForPushNotifications(
  userId: string,
): Promise<PushRegistrationResult> {
  try {
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'registerForPushNotifications start',
      level: 'info',
      data: {
        userId,
        platform: Platform.OS,
        isDevice: Device.isDevice,
      },
    });

    if (!Device.isDevice) {
      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'early exit: !Device.isDevice',
        level: 'warning',
        data: { isDevice: Device.isDevice },
      });
      return { status: 'error', token: null };
    }

    const currentStatus = await Notifications.getPermissionsAsync();
    let finalStatus = currentStatus.status;
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'raw permission status',
      level: 'info',
      data: { status: finalStatus, canAskAgain: currentStatus.canAskAgain },
    });
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'permission status before request',
      level: 'info',
      data: {
        permissionStatus: currentStatus.status,
        granted: currentStatus.granted,
        canAskAgain: currentStatus.canAskAgain,
        iosStatus: currentStatus.ios?.status ?? null,
      },
    });

    if (finalStatus !== 'granted') {
      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'calling requestPermissionsAsync',
        level: 'info',
      });
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'permission status after request',
        level: 'info',
        data: {
          permissionStatus: requested.status,
          granted: requested.granted,
          canAskAgain: requested.canAskAgain,
          iosStatus: requested.ios?.status ?? null,
        },
      });
    } else {
      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'skip requestPermissionsAsync (already granted)',
        level: 'info',
        data: { permissionStatus: finalStatus },
      });
    }

    if (finalStatus === 'denied') {
      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'early exit: permission denied',
        level: 'warning',
        data: { permissionStatus: finalStatus },
      });
      return { status: 'denied', token: null };
    }

    if (finalStatus !== 'granted') {
      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'early exit: permission not granted',
        level: 'warning',
        data: { permissionStatus: finalStatus },
      });
      return { status: 'error', token: null };
    }

    const projectId = getExpoProjectId();
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'fetching Expo push token',
      level: 'info',
      data: { projectId },
    });
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const deviceId = await getDeviceId();
    const platform = 'ios';

    const expoPushToken = token.data;
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'Expo push token fetched',
      level: 'info',
      data: {
        tokenPrefix: expoPushToken?.slice(0, 24) ?? null,
        deviceId,
      },
    });

    await supabase.from('push_tokens').upsert(
      {
        expo_push_token: expoPushToken,
        user_id: userId,
        device_id: deviceId,
        platform,
      },
      { onConflict: 'expo_push_token' },
    );
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'push_tokens upsert done',
      level: 'info',
    });

    await syncProfileTimezone(userId);

    await secureStore.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);

    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'register success: granted',
      level: 'info',
    });
    return { status: 'granted', token: expoPushToken };
  } catch (error) {
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'register failed (catch)',
      level: 'error',
      data: {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    console.error('[Notifications] register failed:', error);
    return { status: 'error', token: null };
  }
}

export async function unregisterPushToken(userId: string) {
  try {
    const token = await secureStore.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (!token) {
      return;
    }

    await supabase
      .from('push_tokens')
      .delete()
      .eq('expo_push_token', token)
      .eq('user_id', userId);

    await secureStore.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('[Notifications] unregister failed:', error);
  }
}
