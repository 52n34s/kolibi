import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform, Pressable, Switch, Text, View } from 'react-native';

import { SettingsSection } from '@/components/settings/settings-section';
import { SETTINGS_GLASS_DIVIDER_CLASS } from '@/components/ui/glass-styles';
import { useCheckinSettings, useUpdateCheckinSettings } from '@/hooks/use-checkin';
import {
  CHECKIN_DEFAULT_REMINDER_TIME,
  formatReminderTime,
  parseReminderTime,
  reminderTimeLabel,
} from '@/lib/checkin/checkin-status';
import { ensureLocalNotificationPermission } from '@/lib/notifications-local';

function timeToDate(value: string | null): Date {
  const parsed = parseReminderTime(value ?? CHECKIN_DEFAULT_REMINDER_TIME) ?? { hour: 7, minute: 0 };
  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date;
}

function dateToTime(date: Date): string {
  return formatReminderTime(date.getHours(), date.getMinutes());
}

/**
 * Morning check-in: card on/off ("Nicht mehr anzeigen" switches it off) and
 * the optional daily reminder at wake-up time. Hidden until the migration ran.
 */
export function CheckinSettingsSection() {
  const { t } = useTranslation();
  const { data: settings } = useCheckinSettings();
  const mutation = useUpdateCheckinSettings();
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [permissionOff, setPermissionOff] = useState(false);
  /** iOS spinner value while turning; saved once it rests for a moment. */
  const [iosDraft, setIosDraft] = useState<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
      }
    },
    [],
  );

  if (!settings?.available) {
    return null;
  }

  const reminderOn = settings.enabled && settings.reminderTime != null;

  function update(patch: { enabled?: boolean; reminderTime?: string | null }) {
    mutation.mutate(patch, {
      onError: (error) => {
        console.error('[CheckinSettings] save failed:', error);
        Alert.alert(t('settings.errors.title'), t('checkin.settings.saveFailed'));
      },
    });
  }

  async function toggleReminder(next: boolean) {
    if (!next) {
      setShowIosPicker(false);
      update({ reminderTime: null });
      return;
    }
    await ensureLocalNotificationPermission();
    const current = await Notifications.getPermissionsAsync().catch(() => null);
    setPermissionOff(current?.status !== 'granted');
    update({ reminderTime: settings?.reminderTime ?? CHECKIN_DEFAULT_REMINDER_TIME });
  }

  function pickTime() {
    const value = timeToDate(settings?.reminderTime ?? null);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onChange: (_event: DateTimePickerEvent, selected?: Date) => {
          if (selected) {
            update({ reminderTime: dateToTime(selected) });
          }
        },
      });
      return;
    }
    setShowIosPicker((open) => !open);
  }

  return (
    <SettingsSection title={t('checkin.settings.sectionTitle')}>
      <View className="flex-row items-center justify-between px-4 py-3.5">
        <Text className="flex-1 text-base text-gray-900">{t('checkin.settings.show')}</Text>
        <Switch
          testID="settings.checkin.enabled"
          value={settings.enabled}
          disabled={mutation.isPending}
          onValueChange={(enabled) => {
            if (!enabled) {
              setShowIosPicker(false);
            }
            update({ enabled });
          }}
          trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {settings.enabled ? (
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS}`}>
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="flex-1 text-base text-gray-900">
              {t('checkin.settings.reminder')}
            </Text>
            <Switch
              testID="settings.checkin.reminder"
              value={reminderOn}
              disabled={mutation.isPending}
              onValueChange={(next) => void toggleReminder(next)}
              trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      ) : null}

      {reminderOn ? (
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS}`}>
          <Pressable
            testID="settings.checkin.time"
            accessibilityRole="button"
            onPress={pickTime}
            className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="flex-1 text-base text-gray-900">{t('checkin.settings.time')}</Text>
            <Text className="text-base font-medium text-[#4F46E5]">
              {reminderTimeLabel(iosDraft ?? settings.reminderTime)}
            </Text>
          </Pressable>
          {showIosPicker && Platform.OS === 'ios' ? (
            <DateTimePicker
              value={timeToDate(iosDraft ?? settings.reminderTime)}
              mode="time"
              display="spinner"
              onChange={(_event, selected) => {
                if (!selected) {
                  return;
                }
                const next = dateToTime(selected);
                setIosDraft(next);
                if (draftTimer.current) {
                  clearTimeout(draftTimer.current);
                }
                draftTimer.current = setTimeout(() => {
                  update({ reminderTime: next });
                  setIosDraft(null);
                }, 800);
              }}
            />
          ) : null}
        </View>
      ) : null}

      <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
        <Text className="text-sm text-gray-500">
          {reminderOn ? t('checkin.settings.reminderHint') : t('checkin.settings.hint')}
        </Text>
      </View>

      {reminderOn && permissionOff ? (
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
          <Text className="mb-3 text-sm text-amber-700">{t('checkin.settings.permissionOff')}</Text>
          <Pressable
            className="h-11 items-center justify-center rounded-xl bg-[#4F46E5]"
            onPress={() => void Linking.openSettings()}>
            <Text className="text-base font-semibold text-white">
              {t('checkin.settings.openSettings')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SettingsSection>
  );
}
