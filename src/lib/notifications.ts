import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';
import { syncProfileTimezone } from '@/lib/profile-timezone';
import { savePushToken, type PushTokenBackend } from '@/lib/push-token-store';

const secureStore = createChunkedSecureStoreAdapter();

const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';

/** Survives reinstall via iOS Keychain — ISO date; nag guard for undetermined only. */
export const PUSH_PERMISSION_ASKED_KEY = 'push_permission_asked';

const PUSH_NAG_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export async function clearPushPermissionAskedFlag(): Promise<void> {
  await secureStore.removeItem(PUSH_PERMISSION_ASKED_KEY);
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { kind?: unknown } | undefined;
    if (data?.kind === 'rest-timer') {
      return {
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
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

const pushTokenBackend: PushTokenBackend = {
  async registerViaRpc({ token, platform, deviceId }) {
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: platform,
      p_device_id: deviceId,
    });
    return { error };
  },
  async upsertDirect({ userId, token, platform, deviceId }) {
    // Same device, new token: drop this user's old row for the device first.
    if (deviceId) {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .neq('expo_push_token', token);
      if (error) {
        return { error, rowCount: null };
      }
    }

    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        { expo_push_token: token, user_id: userId, device_id: deviceId, platform },
        { onConflict: 'expo_push_token' },
      )
      .select('expo_push_token');
    return { error, rowCount: error ? null : (data?.length ?? 0) };
  },
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

    const saved = await savePushToken(pushTokenBackend, {
      userId,
      token: expoPushToken,
      platform,
      deviceId,
    });

    if (!saved.ok) {
      Sentry.captureMessage('push token save failed', {
        level: 'warning',
        tags: {
          reason: 'push_token_registration_failed',
          push_token_via: saved.via,
          push_token_failure: saved.reason,
          db_error_code: saved.error?.code ?? 'none',
        },
      });
      console.error('[Notifications] push token save failed:', saved.reason, saved.error);
      return 'token_failed';
    }

    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'push token saved',
      level: 'info',
      data: { via: saved.via },
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

/**
 * Releases this device's token from the user who is signing out, so the next
 * account on the device can claim it. Must run while that user's session is
 * still active (RLS). The next sign-in registers the token again.
 */
export async function unregisterPushToken(userId: string) {
  try {
    const token = await secureStore.getItem(PUSH_TOKEN_STORAGE_KEY);
    const deviceId = token ? null : await getDeviceId();
    if (!token && !deviceId) {
      return;
    }

    const query = supabase.from('push_tokens').delete().eq('user_id', userId);
    const { error } = token
      ? await query.eq('expo_push_token', token)
      : await query.eq('device_id', deviceId!);

    if (error) {
      Sentry.captureMessage('push token release failed', {
        level: 'warning',
        tags: { reason: 'push_token_release_failed', db_error_code: error.code ?? 'none' },
      });
      console.error('[Notifications] unregister failed:', error);
      return;
    }

    await secureStore.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('[Notifications] unregister failed:', error);
  }
}
