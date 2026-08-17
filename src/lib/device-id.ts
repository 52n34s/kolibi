import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';

const DEVICE_ID_STORAGE_KEY = 'kolibi_device_id';
const secureStore = createChunkedSecureStoreAdapter();

async function resolveNativeDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const idForVendor = await Application.getIosIdForVendorAsync();
      return idForVendor && idForVendor.length > 0 ? idForVendor : null;
    }

    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      return androidId.length > 0 ? androidId : null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getDeviceId(): Promise<string> {
  const cached = await secureStore.getItem(DEVICE_ID_STORAGE_KEY);
  if (cached && cached.length > 0) {
    return cached;
  }

  const deviceId = (await resolveNativeDeviceId()) ?? globalThis.crypto.randomUUID();
  await secureStore.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}
