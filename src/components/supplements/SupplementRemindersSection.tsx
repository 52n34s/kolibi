import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';
import {
  ensurePushRegistration,
  PUSH_PERMISSION_ASKED_KEY,
} from '@/lib/notifications';
import {
  createSupplementReminder,
  deleteSupplementReminder,
  fetchSupplementReminders,
  formatRemindAtLabel,
  MAX_SUPPLEMENT_REMINDERS,
  normalizeRemindAt,
  setSupplementReminderEnabled,
  SupplementReminderLimitError,
  updateSupplementReminder,
  type Supplement,
  type SupplementReminderWithItems,
  type SupplementReminderWriteInput,
} from '@/lib/supplements';

const secureStore = createChunkedSecureStoreAdapter();

type PermissionUiStatus = 'undetermined' | 'denied' | 'granted' | 'unavailable' | 'loading';

type ReminderDraft = {
  label: string;
  remindAt: string;
  isEnabled: boolean;
  supplementIds: string[];
};

function emptyReminderDraft(supplements: Supplement[]): ReminderDraft {
  return {
    label: '',
    remindAt: '08:00:00',
    isEnabled: true,
    supplementIds: supplements.map((item) => item.id),
  };
}

function draftFromReminder(reminder: SupplementReminderWithItems): ReminderDraft {
  return {
    label: reminder.label ?? '',
    remindAt: normalizeRemindAt(reminder.remind_at),
    isEnabled: reminder.is_enabled,
    supplementIds: [...reminder.supplement_ids],
  };
}

function remindAtToDate(value: string): Date {
  const normalized = normalizeRemindAt(value);
  const [hours, minutes] = normalized.split(':').map(Number);
  const date = new Date();
  date.setHours(hours ?? 8, minutes ?? 0, 0, 0);
  return date;
}

function dateToRemindAt(date: Date): string {
  return normalizeRemindAt(
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`,
  );
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

type SupplementRemindersSectionProps = {
  userId: string;
  supplements: Supplement[];
};

export function SupplementRemindersSection({
  userId,
  supplements,
}: SupplementRemindersSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const remindersQueryKey = useMemo(
    () => ['supplements', 'reminders', userId] as const,
    [userId],
  );

  const [permissionStatus, setPermissionStatus] = useState<PermissionUiStatus>('loading');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SupplementReminderWithItems | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<ReminderDraft>(() => emptyReminderDraft(supplements));
  const [showIosTimePicker, setShowIosTimePicker] = useState(false);
  /** Covers the async gap before saveMutation takes over the pending state. */
  const [isPreparingSave, setIsPreparingSave] = useState(false);

  const { data: reminders = [], isLoading, isError } = useQuery({
    queryKey: remindersQueryKey,
    queryFn: () => fetchSupplementReminders(userId),
  });

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      setPermissionStatus(mapPermissionStatus(current.status));
    } catch {
      setPermissionStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  /**
   * User-initiated system dialog. PUSH_PERMISSION_ASKED_KEY only after OS answered.
   */
  async function requestPermissionFromUser(): Promise<'granted' | 'denied'> {
    const requested = await Notifications.requestPermissionsAsync();
    await secureStore.setItem(PUSH_PERMISSION_ASKED_KEY, new Date().toISOString());
    const next = mapPermissionStatus(requested.status);
    setPermissionStatus(next === 'undetermined' ? 'denied' : next);
    return requested.status === 'granted' ? 'granted' : 'denied';
  }

  function openIosSettings() {
    void Linking.openSettings();
  }

  /** Permission is off: say so and offer the way to the iOS settings. */
  function showPermissionOffHint(savedAsOff: boolean) {
    Alert.alert(
      savedAsOff
        ? t('supplements.reminders.permissionOff.savedTitle')
        : t('supplements.reminders.permissionOff.title'),
      t('supplements.reminders.permissionOff.message'),
      [
        { text: t('supplements.reminders.permissionOff.later'), style: 'cancel' },
        { text: t('supplements.reminders.permissionOff.openSettings'), onPress: openIosSettings },
      ],
    );
  }

  /**
   * 'denied' leaves the hint to the caller, which knows whether the reminder
   * was saved switched off.
   */
  async function ensureCanEnablePush(): Promise<'allowed' | 'denied' | 'failed'> {
    let status = permissionStatus;

    if (status === 'loading' || status === 'unavailable') {
      await refreshPermissionStatus();
      const current = await Notifications.getPermissionsAsync();
      status = mapPermissionStatus(current.status);
      setPermissionStatus(status);
    }

    if (status === 'undetermined') {
      try {
        status = await requestPermissionFromUser();
      } catch (error) {
        console.error('[SupplementReminders] permission request failed:', error);
        Alert.alert(t('settings.errors.title'), t('supplements.reminders.errors.saveFailed'));
        return 'failed';
      }
    }

    if (status === 'denied') {
      return 'denied';
    }

    if (status !== 'granted') {
      return 'failed';
    }

    try {
      const result = await ensurePushRegistration(userId, { askIfUndetermined: false });
      if (result.status !== 'granted') {
        if (result.status !== 'token_failed') {
          reportTokenRegistrationFailed();
        }
        Alert.alert(
          t('settings.errors.title'),
          t('settings.notifications.tokenRegistrationFailed'),
        );
        return 'failed';
      }
      return 'allowed';
    } catch (error) {
      console.error('[SupplementReminders] token sync failed:', error);
      reportTokenRegistrationFailed();
      Alert.alert(
        t('settings.errors.title'),
        t('settings.notifications.tokenRegistrationFailed'),
      );
      return 'failed';
    }
  }

  const invalidateReminders = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: remindersQueryKey });
  }, [queryClient, remindersQueryKey]);

  const saveMutation = useMutation({
    mutationFn: async (input: SupplementReminderWriteInput & { permissionOff?: boolean }) => {
      const { permissionOff: _permissionOff, ...write } = input;
      if (isNew || editing == null) {
        return createSupplementReminder(userId, write);
      }
      return updateSupplementReminder(editing.id, write);
    },
    onSuccess: async (_data, input) => {
      if (input.permissionOff) {
        // Wanted on, saved off: the hint explains why and links to the settings.
        showPermissionOffHint(true);
      }
      await invalidateReminders();
      setEditorOpen(false);
      setEditing(null);
      setShowIosTimePicker(false);
    },
    onError: async (error) => {
      // At the limit the add button is already disabled and the hint below it
      // explains why — an alert on top of that says nothing new.
      if (error instanceof SupplementReminderLimitError) {
        await invalidateReminders();
        setEditorOpen(false);
        setEditing(null);
        setShowIosTimePicker(false);
        return;
      }
      console.error('[SupplementReminders] save failed:', error);
      Alert.alert(t('settings.errors.title'), t('supplements.reminders.errors.saveFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteSupplementReminder(id);
    },
    onSuccess: async () => {
      await invalidateReminders();
      setEditorOpen(false);
      setEditing(null);
    },
    onError: (error) => {
      console.error('[SupplementReminders] delete failed:', error);
      Alert.alert(t('settings.errors.title'), t('supplements.reminders.errors.deleteFailed'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      if (enabled) {
        const permission = await ensureCanEnablePush();
        if (permission === 'denied') {
          showPermissionOffHint(false);
        }
        if (permission !== 'allowed') {
          throw new Error('PUSH_NOT_ALLOWED');
        }
      }
      await setSupplementReminderEnabled(id, enabled);
    },
    onSuccess: async () => {
      await invalidateReminders();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'PUSH_NOT_ALLOWED') {
        return;
      }
      console.error('[SupplementReminders] toggle failed:', error);
      Alert.alert(t('settings.errors.title'), t('supplements.reminders.errors.saveFailed'));
    },
  });

  function openCreate() {
    if (reminders.length >= MAX_SUPPLEMENT_REMINDERS) {
      return;
    }

    setIsNew(true);
    setEditing(null);
    setDraft(emptyReminderDraft(supplements));
    setShowIosTimePicker(false);
    setEditorOpen(true);
  }

  function openEdit(reminder: SupplementReminderWithItems) {
    setIsNew(false);
    setEditing(reminder);
    setDraft(draftFromReminder(reminder));
    setShowIosTimePicker(false);
    setEditorOpen(true);
  }

  function pickTime() {
    const value = remindAtToDate(draft.remindAt);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onChange: (_event: DateTimePickerEvent, selected?: Date) => {
          if (selected) {
            setDraft((current) => ({ ...current, remindAt: dateToRemindAt(selected) }));
          }
        },
      });
      return;
    }
    setShowIosTimePicker((open) => !open);
  }

  function toggleSupplement(id: string) {
    setDraft((current) => {
      const has = current.supplementIds.includes(id);
      return {
        ...current,
        supplementIds: has
          ? current.supplementIds.filter((entry) => entry !== id)
          : [...current.supplementIds, id],
      };
    });
  }

  async function handleSave() {
    if (draft.supplementIds.length === 0) {
      Alert.alert(
        t('settings.errors.title'),
        t('supplements.reminders.errors.needSupplements'),
      );
      return;
    }

    // Push registration below is a network round trip, and saveMutation.isPending
    // only turns true after it. Without this the button stays live the whole time
    // and a second tap inserts a second reminder.
    if (isPreparingSave) {
      return;
    }
    setIsPreparingSave(true);

    try {
      let isEnabled = draft.isEnabled;
      let permissionOff = false;
      if (isEnabled) {
        const permission = await ensureCanEnablePush();
        if (permission === 'failed') {
          // Registration hiccup, already explained: keep the editor as it is.
          return;
        }
        if (permission === 'denied') {
          // Save the reminder switched off so it exists; the hint follows.
          isEnabled = false;
          permissionOff = true;
          setDraft((current) => ({ ...current, isEnabled: false }));
        }
      }

      saveMutation.mutate({
        label: draft.label.trim() ? draft.label.trim() : null,
        remind_at: draft.remindAt,
        is_enabled: isEnabled,
        supplement_ids: draft.supplementIds,
        permissionOff,
      });
    } finally {
      setIsPreparingSave(false);
    }
  }

  const atLimit = reminders.length >= MAX_SUPPLEMENT_REMINDERS;
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of supplements) {
      map.set(item.id, item.name);
    }
    return map;
  }, [supplements]);

  return (
    <View className="mt-10">
      <Text className="mb-2 text-lg font-semibold text-gray-900">
        {t('supplements.reminders.sectionTitle')}
      </Text>
      <Text className="mb-4 text-sm text-gray-500">
        {t('supplements.reminders.sectionSubtitle')}
      </Text>

      {isLoading ? (
        <View className="items-center py-6">
          <ActivityIndicator color={ONBOARDING_ACCENT} />
        </View>
      ) : isError ? (
        <Text className="mb-3 text-sm text-gray-600">
          {t('supplements.reminders.errors.loadFailed')}
        </Text>
      ) : reminders.length === 0 ? (
        <Text className="mb-3 text-sm text-gray-500">
          {t('supplements.reminders.empty')}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {reminders.map((reminder) => {
            const names = reminder.supplement_ids
              .map((id) => nameById.get(id))
              .filter(Boolean) as string[];
            return (
              <View
                key={reminder.id}
                style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
                <Pressable onPress={() => openEdit(reminder)} className="px-4 pt-3 pb-2">
                  {reminder.label?.trim() ? (
                    <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                      {reminder.label.trim()}
                    </Text>
                  ) : null}
                  <Text
                    className={`text-sm text-gray-500 ${reminder.label?.trim() ? 'mt-1' : ''}`}>
                    {formatRemindAtLabel(reminder.remind_at)}
                    {names.length > 0 ? ` · ${names.join(', ')}` : ''}
                  </Text>
                </Pressable>
                <View className="flex-row items-center justify-between border-t border-gray-200/70 px-4 py-2.5">
                  <Text className="text-sm text-gray-600">
                    {t('supplements.reminders.enabled')}
                  </Text>
                  <Switch
                    value={reminder.is_enabled}
                    disabled={toggleMutation.isPending}
                    onValueChange={(enabled) =>
                      toggleMutation.mutate({ id: reminder.id, enabled })
                    }
                    trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        disabled={atLimit}
        onPress={openCreate}
        className={`mt-4 h-12 items-center justify-center rounded-xl ${
          atLimit ? 'bg-indigo-200' : 'bg-[#4F46E5]'
        }`}>
        <Text className="text-base font-semibold text-white">
          {t('supplements.reminders.add')}
        </Text>
      </Pressable>
      {atLimit ? (
        <Text className="mt-2 text-sm text-gray-500">
          {t('supplements.reminders.maxHint')}
        </Text>
      ) : null}

      {editorOpen ? (
        <View
          style={[
            getOnboardingIdleCardStyle(),
            { borderRadius: ONBOARDING_CARD_RADIUS, marginTop: 16 },
          ]}
          className="px-4 py-4">
          <Text className="mb-3 text-base font-semibold text-gray-900">
            {isNew
              ? t('supplements.reminders.editor.createTitle')
              : t('supplements.reminders.editor.editTitle')}
          </Text>

          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t('supplements.reminders.editor.label')}
          </Text>
          <TextInput
            value={draft.label}
            onChangeText={(label) => setDraft((current) => ({ ...current, label }))}
            placeholder={t('supplements.reminders.editor.labelPlaceholder')}
            placeholderTextColor="#9CA3AF"
            className="mb-4 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-base text-gray-900"
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t('supplements.reminders.editor.time')}
          </Text>
          <Pressable
            onPress={pickTime}
            className="mb-4 rounded-xl border border-gray-200 bg-white/70 px-4 py-3">
            <Text className="text-base font-medium text-gray-900">
              {formatRemindAtLabel(draft.remindAt)}
            </Text>
          </Pressable>
          {showIosTimePicker && Platform.OS === 'ios' ? (
            <DateTimePicker
              value={remindAtToDate(draft.remindAt)}
              mode="time"
              display="spinner"
              onChange={(_event, selected) => {
                if (selected) {
                  setDraft((current) => ({
                    ...current,
                    remindAt: dateToRemindAt(selected),
                  }));
                }
              }}
            />
          ) : null}

          <Text className="mb-2 text-sm font-medium text-gray-700">
            {t('supplements.reminders.editor.supplements')}
          </Text>
          {supplements.length === 0 ? (
            <Text className="mb-4 text-sm text-gray-500">
              {t('supplements.reminders.editor.noSupplements')}
            </Text>
          ) : (
            <View className="mb-4" style={{ gap: 8 }}>
              {supplements.map((item) => {
                const active = draft.supplementIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleSupplement(item.id)}
                    className={`rounded-xl border px-4 py-3 ${
                      active
                        ? 'border-[#4F46E5] bg-[#4F46E5]/10'
                        : 'border-gray-200 bg-white/70'
                    }`}>
                    <Text
                      className={`text-base ${
                        active ? 'font-semibold text-[#4F46E5]' : 'text-gray-800'
                      }`}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="flex-1 text-sm font-medium text-gray-700">
              {t('supplements.reminders.enabled')}
            </Text>
            <Switch
              value={draft.isEnabled}
              onValueChange={(isEnabled) => setDraft((current) => ({ ...current, isEnabled }))}
              trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {!isNew && editing ? (
            <Pressable
              onPress={() => {
                Alert.alert(
                  t('supplements.reminders.editor.deleteTitle'),
                  t('supplements.reminders.editor.deleteMessage'),
                  [
                    { text: t('settings.common.cancel'), style: 'cancel' },
                    {
                      text: t('supplements.reminders.editor.delete'),
                      style: 'destructive',
                      onPress: () => deleteMutation.mutate(editing.id),
                    },
                  ],
                );
              }}
              className="mb-3 items-center rounded-xl py-3"
              style={{ backgroundColor: 'rgba(220,38,38,0.06)' }}>
              <Text className="text-sm font-semibold text-red-600">
                {t('supplements.reminders.editor.delete')}
              </Text>
            </Pressable>
          ) : null}

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setEditorOpen(false);
                setEditing(null);
                setShowIosTimePicker(false);
              }}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-white/80">
              <Text className="text-base font-semibold text-gray-700">
                {t('settings.common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              disabled={isPreparingSave || saveMutation.isPending || deleteMutation.isPending}
              onPress={() => void handleSave()}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-[#4F46E5]">
              {isPreparingSave || saveMutation.isPending || deleteMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {t('settings.common.save')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
