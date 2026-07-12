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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCAN_TIMEOUT_MS = 15_000;

type BarcodeCameraViewProps = {
  visible: boolean;
  onCancel: () => void;
  onBarcodeScanned: (barcode: string) => void;
};

export function BarcodeCameraView({
  visible,
  onCancel,
  onBarcodeScanned,
}: BarcodeCameraViewProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanPaused, setScanPaused] = useState(false);
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const hasReportedScanRef = useRef(false);

  function resetSession() {
    setScanPaused(false);
    setScanTimedOut(false);
    hasReportedScanRef.current = false;
  }

  useEffect(() => {
    if (visible) {
      resetSession();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || scanPaused || scanTimedOut) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setScanPaused(true);
      setScanTimedOut(true);
    }, SCAN_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [scanPaused, scanTimedOut, visible]);

  function handleCancel() {
    resetSession();
    onCancel();
  }

  function handleRetryScan() {
    resetSession();
  }

  function handleBarcodeDetected(result: { data: string }) {
    if (hasReportedScanRef.current || scanPaused || scanTimedOut) {
      return;
    }

    const barcode = result.data?.trim();
    if (!barcode) {
      return;
    }

    hasReportedScanRef.current = true;
    setScanPaused(true);

    try {
      onBarcodeScanned(barcode);
    } catch (error) {
      console.error('[BarcodeCameraView] onBarcodeScanned failed:', error);
      resetSession();
    }
  }

  if (!visible) {
    return null;
  }

  if (!permission) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.centeredState}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.common.cancel')}
            style={[styles.permissionCloseButton, { top: insets.top + 8 }]}
            onPress={handleCancel}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.centeredState}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.common.cancel')}
            style={[styles.permissionCloseButton, { top: insets.top + 8 }]}
            onPress={handleCancel}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
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
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a'],
          }}
          onBarcodeScanned={handleBarcodeDetected}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.common.cancel')}
            style={styles.closeButton}
            onPress={handleCancel}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.progressSpacer} />
        </View>

        {scanTimedOut ? (
          <View style={[styles.timeoutOverlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={styles.timeoutTitle}>{t('home.scan.barcode.timeoutTitle')}</Text>
            <Text style={styles.timeoutMessage}>{t('home.scan.barcode.timeoutMessage')}</Text>
            <View style={styles.timeoutActions}>
              <Pressable style={styles.timeoutRetryButton} onPress={handleRetryScan}>
                <Text style={styles.timeoutRetryLabel}>{t('home.scan.barcode.retryScan')}</Text>
              </Pressable>
              <Pressable style={styles.timeoutCancelButton} onPress={handleCancel}>
                <Text style={styles.timeoutCancelLabel}>{t('settings.common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.guideOverlay} pointerEvents="none">
            <View style={styles.guideFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.guideText}>{t('home.scan.barcode.guide')}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const GUIDE_WIDTH = 280;
const GUIDE_HEIGHT = 160;
const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

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
  progressSpacer: {
    width: 40,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideFrame: {
    width: GUIDE_WIDTH,
    height: GUIDE_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: -1,
    right: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 16,
  },
  guideText: {
    marginTop: 18,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  timeoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  timeoutTitle: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timeoutMessage: {
    marginBottom: 24,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.82)',
    textAlign: 'center',
  },
  timeoutActions: {
    width: '100%',
    maxWidth: 280,
    gap: 10,
  },
  timeoutRetryButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  timeoutRetryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeoutCancelButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  timeoutCancelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
  },
  permissionCloseButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
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
