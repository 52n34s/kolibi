import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { prepareMealPhotoUri } from '@/lib/meal-photo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MultiPhotoCameraFlowProps = {
  visible: boolean;
  photoCount: number;
  onCancel: () => void;
  onComplete: (photoUris: string[]) => void;
};

export function MultiPhotoCameraFlow({
  visible,
  photoCount,
  onCancel,
  onComplete,
}: MultiPhotoCameraFlowProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedUris, setCapturedUris] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCaptureError, setShowCaptureError] = useState(false);

  function resetSession() {
    setCurrentIndex(0);
    setCapturedUris([]);
    setIsCameraReady(false);
    setIsCapturing(false);
    setShowCaptureError(false);
  }

  useEffect(() => {
    if (visible) {
      resetSession();
    }
  }, [visible, photoCount]);

  function handleCancel() {
    resetSession();
    onCancel();
  }

  async function handleCapturePress() {
    if (!cameraRef.current || !isCameraReady || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setShowCaptureError(false);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setShowCaptureError(true);
        return;
      }

      const preparedUri = await prepareMealPhotoUri(photo.uri);
      const nextUris = [...capturedUris, preparedUri];
      const isLastPhoto = currentIndex >= photoCount - 1;

      if (isLastPhoto) {
        resetSession();
        onComplete(nextUris);
        return;
      }

      setCapturedUris(nextUris);
      setCurrentIndex((index) => index + 1);
    } catch {
      setShowCaptureError(true);
    } finally {
      setIsCapturing(false);
    }
  }

  if (!visible) {
    return null;
  }

  if (!permission) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.centeredState}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.centeredState}>
          <Text style={styles.permissionTitle}>{t('home.scan.camera.permissionTitle')}</Text>
          <Text style={styles.permissionBody}>{t('home.scan.camera.permissionBody')}</Text>
          <Pressable style={styles.permissionButton} onPress={() => void requestPermission()}>
            <Text style={styles.permissionButtonLabel}>
              {t('home.scan.camera.permissionAction')}
            </Text>
          </Pressable>
          <Pressable style={styles.cancelTextButton} onPress={handleCancel}>
            <Text style={styles.cancelTextLabel}>{t('settings.common.cancel')}</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setIsCameraReady(true)}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.common.cancel')}
            style={styles.closeButton}
            onPress={handleCancel}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>

          {photoCount > 1 ? (
            <View style={styles.progressPill}>
              <Text style={styles.progressText}>
                {t('home.scan.camera.progress', {
                  current: currentIndex + 1,
                  total: photoCount,
                })}
              </Text>
            </View>
          ) : (
            <View style={styles.progressSpacer} />
          )}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {showCaptureError ? (
            <Text style={styles.captureErrorText}>{t('home.scan.camera.captureFailed')}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.scan.options.captureCta')}
            disabled={!isCameraReady || isCapturing}
            style={[styles.shutterOuter, (!isCameraReady || isCapturing) && styles.shutterDisabled]}
            onPress={() => void handleCapturePress()}>
            {isCapturing ? (
              <ActivityIndicator color="#4F46E5" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  progressPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressSpacer: {
    width: 40,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  captureErrorText: {
    marginBottom: 14,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  shutterDisabled: {
    opacity: 0.55,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
  },
  permissionTitle: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionBody: {
    marginBottom: 20,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.78)',
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
  },
  permissionButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelTextButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelTextLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.82)',
  },
});
