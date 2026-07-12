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
  cancelLabel: string;
};

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
            void Linking.openSettings();
            resolve({ status: 'permission_denied' });
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

  const uris = await Promise.all(
    pickerResult.assets.map((asset) => prepareMealPhotoUri(asset.uri)),
  );

  return { status: 'success', uris };
}
