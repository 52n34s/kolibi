import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import type { PermissionResponse } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingMeshBackground } from '@/components/onboarding/onboarding-background';
import { getGlassCardStyle } from '@/components/ui/glass-styles';

type CameraPermissionGateProps = {
  permission: PermissionResponse | null;
  requestPermission: () => Promise<PermissionResponse>;
  onClose: () => void;
  title: string;
  body: string;
  openSettingsLabel: string;
  closeAccessibilityLabel: string;
};

/**
 * Shared camera-permission UX for photo + barcode capture.
 * - undetermined: auto-request once, mesh only (no skip)
 * - denied / !canAskAgain: settings CTA + navigational close
 */
export function CameraPermissionGate({
  permission,
  requestPermission,
  onClose,
  title,
  body,
  openSettingsLabel,
  closeAccessibilityLabel,
}: CameraPermissionGateProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hasRequestedRef = useRef(false);
  const requestPermissionRef = useRef(requestPermission);
  requestPermissionRef.current = requestPermission;

  const permissionStatus = permission?.status;
  const canAskAgain = permission?.canAskAgain;
  const isGranted = permission?.granted === true;
  const isBlocked =
    permission != null &&
    !isGranted &&
    (permissionStatus === 'denied' || canAskAgain === false);

  useEffect(() => {
    // Only auto-prompt while OS still considers the status undetermined.
    if (permissionStatus !== 'undetermined') {
      return;
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    void requestPermissionRef.current();
  }, [permissionStatus]);

  async function handleOpenSettings() {
    try {
      await Linking.openSettings();
    } catch {
      // Expected iOS edge case: openSettings can reject during the
      // inactive→background transition it itself triggers (KOLIBI-8).
      Sentry.addBreadcrumb({
        category: 'linking',
        message: 'Linking.openSettings failed',
        level: 'info',
        data: { source: 'CameraPermissionGate' },
      });
      Alert.alert(
        t('home.scan.camera.openSettingsFailedTitle'),
        t('home.scan.camera.openSettingsFailedMessage'),
        [{ text: t('settings.common.ok') }],
      );
    }
  }

  if (isBlocked) {
    return (
      <View style={styles.root}>
        <OnboardingMeshBackground />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeAccessibilityLabel}
          hitSlop={12}
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={onClose}>
          <Ionicons name="close" size={24} color="#111827" />
        </Pressable>

        <View style={styles.centered}>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={openSettingsLabel}
              style={styles.primaryButton}
              onPress={() => void handleOpenSettings()}>
              <Text style={styles.primaryButtonLabel}>{openSettingsLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <OnboardingMeshBackground />
      <View style={styles.centered}>
        <ActivityIndicator color="#4F46E5" size="large" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  card: {
    ...getGlassCardStyle({ padding: 24, width: '100%', maxWidth: 360 }),
  },
  title: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  body: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
