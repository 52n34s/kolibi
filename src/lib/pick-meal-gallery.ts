import * as Sentry from '@sentry/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import { prepareMealPhotoUri } from '@/lib/meal-photo';

export type PickMealGalleryResult =
  | { status: 'success'; uris: string[] }
  | { status: 'canceled' }
  | { status: 'permission_denied' };

type PickMealGalleryParams = {
  selectionLimit: number;
  permissionDeniedTitle: string;
  permissionDeniedMessage: string;
  openSettingsLabel: string;
  openSettingsFailedTitle: string;
  openSettingsFailedMessage: string;
  cancelLabel: string;
  okLabel: string;
  /** Called after a non-canceled picker result, before prepareMealPhotoUri. */
  onPhotosSelected?: () => void;
};

async function openAppSettingsOrExplain(params: {
  failedTitle: string;
  failedMessage: string;
  okLabel: string;
}): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Expected iOS edge case: openSettings can reject during the
    // inactive→background transition it itself triggers (KOLIBI-8).
    Sentry.addBreadcrumb({
      category: 'linking',
      message: 'Linking.openSettings failed',
      level: 'info',
      data: { source: 'pickMealPhotosFromGallery' },
    });
    Alert.alert(params.failedTitle, params.failedMessage, [{ text: params.okLabel }]);
  }
}

export async function pickMealPhotosFromGallery(
  params: PickMealGalleryParams,
): Promise<PickMealGalleryResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return new Promise((resolve) => {
      Alert.alert(params.permissionDeniedTitle, params.permissionDeniedMessage, [
        {
          text: params.cancelLabel,
          style: 'cancel',
          onPress: () => resolve({ status: 'permission_denied' }),
        },
        {
          text: params.openSettingsLabel,
          onPress: () => {
            resolve({ status: 'permission_denied' });
            void openAppSettingsOrExplain({
              failedTitle: params.openSettingsFailedTitle,
              failedMessage: params.openSettingsFailedMessage,
              okLabel: params.okLabel,
            });
          },
        },
      ]);
    });
  }

  const pickerResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: params.selectionLimit > 1,
    selectionLimit: params.selectionLimit,
    quality: 1,
  });

  if (pickerResult.canceled || pickerResult.assets.length === 0) {
    return { status: 'canceled' };
  }

  params.onPhotosSelected?.();

  const uris = await Promise.all(
    pickerResult.assets.map((asset) => prepareMealPhotoUri(asset.uri)),
  );

  return { status: 'success', uris };
}
