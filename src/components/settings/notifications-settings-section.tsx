import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
  userHasPushToken,
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

function anyReminderEnabled(prefs: MealReminderPreferences): boolean {
  return prefs.breakfastEnabled || prefs.lunchEnabled || prefs.dinnerEnabled;
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

function mapPermissionStatus(
  status: Notifications.PermissionStatus,
): Exclude<PermissionUiStatus, 'loading'> {
  if (status === 'granted' || status === 'denied' || status === 'undetermined') {
    return status;
  }
  return 'unavailable';
}

function reportTokenRegistrationFailed() {
  Sentry.captureMessage('push token registration failed', {
    level: 'warning',
    tags: { reason: 'push_token_registration_failed' },
  });
}

export function NotificationsSettingsSection({ userId }: NotificationsSettingsSectionProps) {
  const { t } = useTranslation();
  const [permissionStatus, setPermissionStatus] = useState<PermissionUiStatus>('loading');
  const [prefs, setPrefs] = useState<MealReminderPreferences>(DEFAULT_MEAL_REMINDER_PREFERENCES);
  const [isBusy, setIsBusy] = useState(false);
  const [tokenRegistrationFailed, setTokenRegistrationFailed] = useState(false);
  const tokenBackfillAttemptedRef = useRef(false);

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      setPermissionStatus(mapPermissionStatus(current.status));
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
      return { ...loaded, locale: getAppLanguage() };
    } catch (error) {
      console.error('[NotificationsSettings] preference load failed:', error);
      return null;
    }
  }, [userId]);

  /**
   * If OS permission is granted and reminders are on but push_tokens has no row,
   * try registration once per focus. Without a token, send-meal-reminders cannot deliver.
   */
  const maybeBackfillPushToken = useCallback(
    async (nextPermission: PermissionUiStatus, nextPrefs: MealReminderPreferences) => {
      if (!userId || tokenBackfillAttemptedRef.current) {
        return;
      }
      if (nextPermission !== 'granted' || !anyReminderEnabled(nextPrefs)) {
        return;
      }

      tokenBackfillAttemptedRef.current = true;

      try {
        const hasToken = await userHasPushToken(userId);
        if (hasToken) {
          setTokenRegistrationFailed(false);
          return;
        }

        const result = await ensurePushRegistration(userId, { askIfUndetermined: false });
        if (result.status === 'granted') {
          setTokenRegistrationFailed(false);
          return;
        }

        if (result.status === 'token_failed' || result.status === 'unavailable') {
          if (result.status !== 'token_failed') {
            reportTokenRegistrationFailed();
          }
          setTokenRegistrationFailed(true);
        }
      } catch (error) {
        console.error('[NotificationsSettings] token backfill failed:', error);
        reportTokenRegistrationFailed();
        setTokenRegistrationFailed(true);
      }
    },
    [userId],
  );

  // Re-read OS permission whenever this screen is focused (and when returning from Settings).
  useFocusEffect(
    useCallback(() => {
      tokenBackfillAttemptedRef.current = false;

      void (async () => {
        await refreshPermissionStatus();
        const loaded = await refreshPreferences();
        const current = await Notifications.getPermissionsAsync();
        const permission = mapPermissionStatus(current.status);
        if (loaded) {
          await maybeBackfillPushToken(permission, loaded);
        }
      })();
    }, [maybeBackfillPushToken, refreshPermissionStatus, refreshPreferences]),
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

  /**
   * User-initiated system dialog. Always asks when undetermined (no nag skip).
   * PUSH_PERMISSION_ASKED_KEY is written only after the OS returns granted/denied.
   */
  async function requestPermissionFromUser(): Promise<'granted' | 'denied'> {
    const requested = await Notifications.requestPermissionsAsync();
    await secureStore.setItem(PUSH_PERMISSION_ASKED_KEY, new Date().toISOString());
    const next = mapPermissionStatus(requested.status);
    setPermissionStatus(next === 'undetermined' ? 'denied' : next);
    return requested.status === 'granted' ? 'granted' : 'denied';
  }

  async function handleToggle(bucket: MealReminderBucket, nextValue: boolean) {
    if (!userId || isBusy || permissionStatus === 'denied' || permissionStatus === 'loading') {
      return;
    }

    // Turning off never needs permission or a push token.
    if (!nextValue) {
      setTokenRegistrationFailed(false);
      await persistPrefs(withBucketEnabled(prefs, bucket, false));
      return;
    }

    let status = permissionStatus;

    if (status === 'undetermined') {
      setIsBusy(true);
      try {
        status = await requestPermissionFromUser();
      } catch (error) {
        console.error('[NotificationsSettings] permission request failed:', error);
        Alert.alert(t('settings.errors.title'), t('settings.notifications.saveFailed'));
        return;
      } finally {
        setIsBusy(false);
      }

      if (status !== 'granted') {
        // Toggle stays off — never persist enabled without a grant.
        return;
      }
    }

    if (status !== 'granted') {
      return;
    }

    setIsBusy(true);
    try {
      const result = await ensurePushRegistration(userId, { askIfUndetermined: false });
      if (result.status !== 'granted') {
        // token_failed is already reported inside registerPushToken.
        if (result.status !== 'token_failed') {
          reportTokenRegistrationFailed();
        }
        setTokenRegistrationFailed(true);
        // Toggle stays off — send-meal-reminders cannot deliver without push_tokens.
        return;
      }
      setTokenRegistrationFailed(false);
    } catch (error) {
      console.error('[NotificationsSettings] token sync failed:', error);
      reportTokenRegistrationFailed();
      setTokenRegistrationFailed(true);
      return;
    } finally {
      setIsBusy(false);
    }

    await persistPrefs(withBucketEnabled(prefs, bucket, true));
  }

  if (permissionStatus === 'loading' || permissionStatus === 'unavailable') {
    return null;
  }

  const togglesDisabled = isBusy || permissionStatus === 'denied';

  return (
    <SettingsSection title={t('settings.notifications.remindersSectionTitle')}>
      {BUCKETS.map((bucket, index) => {
        const storedEnabled = enabledForBucket(prefs, bucket);
        // Only show ON when OS permission is actually granted.
        const displayEnabled = permissionStatus === 'granted' && storedEnabled;

        return (
          <View
            key={bucket}
            className={index === 0 ? '' : `border-t ${SETTINGS_GLASS_DIVIDER_CLASS}`}>
            <View className="flex-row items-center justify-between px-4 py-3.5">
              <Text
                className={`flex-1 text-base ${
                  permissionStatus === 'denied' ? 'text-gray-400' : 'text-gray-900'
                }`}>
                {t(`settings.notifications.meals.${bucket}`)}
              </Text>
              <Switch
                value={displayEnabled}
                disabled={togglesDisabled}
                onValueChange={(value) => void handleToggle(bucket, value)}
                trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        );
      })}

      {permissionStatus === 'undetermined' ? (
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
          <Text className="text-sm text-gray-500">
            {t('settings.notifications.undeterminedHint')}
          </Text>
        </View>
      ) : null}

      {permissionStatus === 'denied' ? (
        <>
          <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-sm text-gray-500">
              {t('settings.notifications.deniedHint')}
            </Text>
          </View>
          <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Pressable
              className="h-11 items-center justify-center rounded-xl bg-[#4F46E5]"
              onPress={() => void Linking.openSettings()}>
              <Text className="text-base font-semibold text-white">
                {t('settings.notifications.openIosSettings')}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {permissionStatus === 'granted' && tokenRegistrationFailed ? (
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
          <Text className="text-sm text-amber-700">
            {t('settings.notifications.tokenRegistrationFailed')}
          </Text>
        </View>
      ) : null}

      {permissionStatus === 'granted' && !tokenRegistrationFailed ? (
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
          <Text className="text-sm text-gray-500">
            {t('settings.notifications.learningHint')}
          </Text>
        </View>
      ) : null}
    </SettingsSection>
  );
}
