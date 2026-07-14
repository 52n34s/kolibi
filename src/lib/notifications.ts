import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';

const secureStore = createChunkedSecureStoreAdapter();

const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';

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
    if (!Device.isDevice) {
      return { status: 'error', token: null };
    }

    const currentStatus = await Notifications.getPermissionsAsync();
    let finalStatus = currentStatus.status;

    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus === 'denied') {
      return { status: 'denied', token: null };
    }

    if (finalStatus !== 'granted') {
      return { status: 'error', token: null };
    }

    const projectId = getExpoProjectId();
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const deviceId = await getDeviceId();
    const platform = 'ios';

    const expoPushToken = token.data;

    await supabase.from('push_tokens').upsert(
      {
        expo_push_token: expoPushToken,
        user_id: userId,
        device_id: deviceId,
        platform,
      },
      { onConflict: 'expo_push_token' },
    );

    await secureStore.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);

    return { status: 'granted', token: expoPushToken };
  } catch (error) {
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

