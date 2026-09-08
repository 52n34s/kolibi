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
import { getAppLanguage } from '@/i18n';
import {
  DEFAULT_MEAL_REMINDER_PREFERENCES,
  getMealReminderPreferences,
  type MealReminderBucket,
  type MealReminderPreferences,
  upsertMealReminderPreferences,
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

const BUCKETS: MealReminderBucket[] = ['breakfast', 'lunch', 'dinner'];

function enabledForBucket(prefs: MealReminderPreferences, bucket: MealReminderBucket): boolean {
  if (bucket === 'breakfast') {
    return prefs.breakfastEnabled;
  }
  if (bucket === 'lunch') {
    return prefs.lunchEnabled;
  }
  return prefs.dinnerEnabled;
}

function withBucketEnabled(
  prefs: MealReminderPreferences,
  bucket: MealReminderBucket,
  enabled: boolean,
): MealReminderPreferences {
  if (bucket === 'breakfast') {
    return { ...prefs, breakfastEnabled: enabled };
  }
  if (bucket === 'lunch') {
    return { ...prefs, lunchEnabled: enabled };
  }
  return { ...prefs, dinnerEnabled: enabled };
}

export function NotificationsSettingsSection({ userId }: NotificationsSettingsSectionProps) {
  const { t } = useTranslation();
  const [permissionStatus, setPermissionStatus] = useState<PermissionUiStatus>('loading');
  const [prefs, setPrefs] = useState<MealReminderPreferences>(DEFAULT_MEAL_REMINDER_PREFERENCES);
  const [isBusy, setIsBusy] = useState(false);

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      if (
        current.status === 'granted' ||
        current.status === 'denied' ||
        current.status === 'undetermined'
      ) {
        setPermissionStatus(current.status);
      } else {
        setPermissionStatus('unavailable');
      }
    } catch {
      setPermissionStatus('unavailable');
    }
  }, []);

  const refreshPreferences = useCallback(async () => {
    if (!userId) {
      return;
    }
    try {
      const loaded = await getMealReminderPreferences(userId);
      setPrefs({ ...loaded, locale: getAppLanguage() });
    } catch (error) {
      console.error('[NotificationsSettings] preference load failed:', error);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refreshPermissionStatus();
      void refreshPreferences();
    }, [refreshPermissionStatus, refreshPreferences]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshPermissionStatus();
      }
    });
    return () => sub.remove();
  }, [refreshPermissionStatus]);

  async function persistPrefs(next: MealReminderPreferences) {
    if (!userId) {
      return;
    }

    const withLocale = { ...next, locale: getAppLanguage() };
    setPrefs(withLocale);
    setIsBusy(true);
    try {
      await upsertMealReminderPreferences(userId, withLocale);
    } catch (error) {
      console.error('[NotificationsSettings] preference save failed:', error);
      await refreshPreferences();
      Alert.alert(t('settings.errors.title'), t('settings.notifications.saveFailed'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleActivate() {
    if (!userId || isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await ensurePushRegistration(userId, { askIfUndetermined: true });

      if (result.status === 'denied' || (result.status === 'granted' && result.prompted)) {
        await secureStore.setItem(PUSH_PERMISSION_ASKED_KEY, new Date().toISOString());
      }

      await refreshPermissionStatus();
      if (result.status === 'granted') {
        await refreshPreferences();
      }
    } catch (error) {
      console.error('[NotificationsSettings] activate failed:', error);
      Alert.alert(t('settings.errors.title'), t('settings.notifications.saveFailed'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggle(bucket: MealReminderBucket, nextValue: boolean) {
    if (!userId || isBusy) {
      return;
    }

    if (nextValue && permissionStatus === 'granted') {
      try {
        await ensurePushRegistration(userId, { askIfUndetermined: false });
      } catch (error) {
        console.error('[NotificationsSettings] token sync failed:', error);
      }
    }

    await persistPrefs(withBucketEnabled(prefs, bucket, nextValue));
  }

  if (permissionStatus === 'loading' || permissionStatus === 'unavailable') {
    return null;
  }

  return (
    <SettingsSection title={t('settings.notifications.remindersSectionTitle')}>
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
          {BUCKETS.map((bucket, index) => {
            const enabled = enabledForBucket(prefs, bucket);
            return (
              <View
                key={bucket}
                className={index === 0 ? '' : `border-t ${SETTINGS_GLASS_DIVIDER_CLASS}`}>
                <View className="flex-row items-center justify-between px-4 py-3.5">
                  <Text className="flex-1 text-base text-gray-900">
                    {t(`settings.notifications.meals.${bucket}`)}
                  </Text>
                  <Switch
                    value={enabled}
                    disabled={isBusy}
                    onValueChange={(value) => void handleToggle(bucket, value)}
                    trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            );
          })}
          <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-sm text-gray-500">
              {t('settings.notifications.learningHint')}
            </Text>
          </View>
        </>
      ) : null}
    </SettingsSection>
  );
}
