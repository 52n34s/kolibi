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

/** Survives reinstall via iOS Keychain — ISO date; nag guard for undetermined only. */
export const PUSH_PERMISSION_ASKED_KEY = 'push_permission_asked';

const PUSH_NAG_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Legacy `'true'` and other non-ISO values → treat as never asked. */
function wasAskedWithinNagWindow(stored: string | null): boolean {
  if (!stored) {
    return false;
  }

  const parsed = Date.parse(stored);
  if (Number.isNaN(parsed)) {
    return false;
  }

  return Date.now() - parsed < PUSH_NAG_INTERVAL_MS;
}

export type PushRegistrationResult = {
  status: 'granted' | 'denied' | 'undetermined' | 'token_failed' | 'unavailable';
  /** True when requestPermissionsAsync ran (caller uses this for nag-date writes). */
  prompted: boolean;
};

async function registerPushToken(userId: string): Promise<'granted' | 'token_failed'> {
  try {
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

    if (deviceId) {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .neq('expo_push_token', expoPushToken);
    }

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

    return 'granted';
  } catch (error) {
    Sentry.captureException(error, { tags: { flow: 'push-registration' } });
    Sentry.captureMessage('push token registration failed', {
      level: 'warning',
      tags: { reason: 'push_token_registration_failed' },
    });
    console.error('[Notifications] token registration failed:', error);
    return 'token_failed';
  }
}

/**
 * Syncs OS permission + Expo push token with push_tokens.
 * iOS permission status is the source of truth.
 *
 * @param askIfUndetermined — false at cold start (no system dialog); true after first meal.
 */
export async function ensurePushRegistration(
  userId: string,
  options: { askIfUndetermined: boolean },
): Promise<PushRegistrationResult> {
  Sentry.addBreadcrumb({
    category: 'push-debug',
    message: 'ensurePushRegistration start',
    level: 'info',
    data: {
      userId,
      askIfUndetermined: options.askIfUndetermined,
      platform: Platform.OS,
      isDevice: Device.isDevice,
    },
  });

  if (!Device.isDevice) {
    return { status: 'unavailable', prompted: false };
  }

  const current = await Notifications.getPermissionsAsync();
  Sentry.addBreadcrumb({
    category: 'push-debug',
    message: 'permission status',
    level: 'info',
    data: {
      permissionStatus: current.status,
      granted: current.granted,
      canAskAgain: current.canAskAgain,
      iosStatus: current.ios?.status ?? null,
    },
  });

  let permissionStatus = current.status;
  let prompted = false;

  if (permissionStatus === 'denied') {
    return { status: 'denied', prompted: false };
  }

  if (permissionStatus === 'undetermined') {
    if (!options.askIfUndetermined) {
      return { status: 'undetermined', prompted: false };
    }

    const stored = await secureStore.getItem(PUSH_PERMISSION_ASKED_KEY);
    if (wasAskedWithinNagWindow(stored)) {
      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'skip ask: within 7-day nag window',
        level: 'info',
        data: { stored },
      });
      return { status: 'undetermined', prompted: false };
    }

    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'calling requestPermissionsAsync',
      level: 'info',
    });
    const requested = await Notifications.requestPermissionsAsync();
    prompted = true;
    permissionStatus = requested.status;

    Sentry.captureMessage('push: requestPermissionsAsync result', {
      level: 'info',
      tags: {
        push_flow: 'request_result',
        permission_status: requested.status,
      },
    });

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

    if (permissionStatus !== 'granted') {
      return { status: 'denied', prompted };
    }
  }

  if (permissionStatus !== 'granted') {
    return { status: 'denied', prompted };
  }

  const tokenStatus = await registerPushToken(userId);
  return { status: tokenStatus, prompted };
}

/** True when this user has at least one row in push_tokens (any device). */
export async function userHasPushToken(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    console.error('[Notifications] push_tokens lookup failed:', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
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
