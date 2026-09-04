import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { SettingsSection } from '@/components/settings/settings-section';
import { SETTINGS_GLASS_DIVIDER_CLASS } from '@/components/ui/glass-styles';
import {
  getMealRemindersEnabled,
  setMealRemindersEnabled,
} from '@/lib/notification-preferences';
import {
  ensurePushRegistration,
  PUSH_PERMISSION_ASKED_KEY,
} from '@/lib/notifications';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';

type PermissionUiStatus = 'undetermined' | 'denied' | 'granted' | 'unavailable' | 'loading';

type NotificationsSettingsSectionProps = {
  userId: string | undefined;
};

const secureStore = createChunkedSecureStoreAdapter();

export function NotificationsSettingsSection({ userId }: NotificationsSettingsSectionProps) {
  const { t } = useTranslation();
  const [permissionStatus, setPermissionStatus] = useState<PermissionUiStatus>('loading');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.status === 'granted' || current.status === 'denied' || current.status === 'undetermined') {
        setPermissionStatus(current.status);
      } else {
        setPermissionStatus('unavailable');
      }
    } catch {
      setPermissionStatus('unavailable');
    }
  }, []);

  const refreshReminderPreference = useCallback(async () => {
    if (!userId) {
      return;
    }
    try {
      const enabled = await getMealRemindersEnabled(userId);
      setRemindersEnabled(enabled);
    } catch (error) {
      console.error('[NotificationsSettings] preference load failed:', error);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refreshPermissionStatus();
      void refreshReminderPreference();
    }, [refreshPermissionStatus, refreshReminderPreference]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshPermissionStatus();
      }
    });
    return () => sub.remove();
  }, [refreshPermissionStatus]);

  async function handleActivate() {
    if (!userId || isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await ensurePushRegistration(userId, { askIfUndetermined: true });

      // Same nag-date rule as ensurePushOnMealSave — local to this UI entry point.
      if (result.status === 'denied' || (result.status === 'granted' && result.prompted)) {
        await secureStore.setItem(PUSH_PERMISSION_ASKED_KEY, new Date().toISOString());
      }

      await refreshPermissionStatus();
      if (result.status === 'granted') {
        await refreshReminderPreference();
      }
    } catch (error) {
      console.error('[NotificationsSettings] activate failed:', error);
      Alert.alert(t('settings.errors.title'), t('settings.notifications.saveFailed'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemindersToggle(nextValue: boolean) {
    if (!userId || isBusy) {
      return;
    }

    const previous = remindersEnabled;
    setRemindersEnabled(nextValue);
    setIsBusy(true);

    try {
      await setMealRemindersEnabled(userId, nextValue);
    } catch (error) {
      console.error('[NotificationsSettings] preference save failed:', error);
      setRemindersEnabled(previous);
      Alert.alert(t('settings.errors.title'), t('settings.notifications.saveFailed'));
    } finally {
      setIsBusy(false);
    }
  }

  if (permissionStatus === 'loading' || permissionStatus === 'unavailable') {
    return null;
  }

  return (
    <SettingsSection title={t('settings.notifications.sectionTitle')}>
      {permissionStatus === 'undetermined' ? (
        <>
          <View className="px-4 py-3.5">
            <Pressable
              className="h-11 items-center justify-center rounded-xl bg-[#4F46E5]"
              disabled={isBusy}
              onPress={() => void handleActivate()}>
              {isBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {t('settings.notifications.activate')}
                </Text>
              )}
            </Pressable>
          </View>
          <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-sm text-gray-500">
              {t('settings.notifications.undeterminedHint')}
            </Text>
          </View>
        </>
      ) : null}

      {permissionStatus === 'denied' ? (
        <>
          <View className="px-4 py-3.5">
            <Pressable
              className="h-11 items-center justify-center rounded-xl bg-[#4F46E5]"
              onPress={() => void Linking.openSettings()}>
              <Text className="text-base font-semibold text-white">
                {t('settings.notifications.openIosSettings')}
              </Text>
            </Pressable>
          </View>
          <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-sm text-gray-500">
              {t('settings.notifications.deniedHint')}
            </Text>
          </View>
        </>
      ) : null}

      {permissionStatus === 'granted' ? (
        <>
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="flex-1 text-base text-gray-900">
              {t('settings.notifications.toggleLabel')}
            </Text>
            <Switch
              value={remindersEnabled}
              disabled={isBusy}
              onValueChange={(value) => void handleRemindersToggle(value)}
              trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </>
      ) : null}
    </SettingsSection>
  );
}
