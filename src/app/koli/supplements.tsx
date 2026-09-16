import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Href, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { SupplementRemindersSection } from '@/components/supplements/SupplementRemindersSection';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import {
  getNumberInputAccessoryProps,
} from '@/components/ui/keyboard-accessory';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { formatAppDate } from '@/lib/onboarding';
import {
  createSupplement,
  cyclePauseStartDate,
  deleteSupplement,
  describeSchedule,
  DOSE_UNITS,
  fetchSupplements,
  formatDoseLabel,
  type DoseUnit,
  type ScheduleKind,
  type Supplement,
  type SupplementWriteInput,
  updateSupplement,
} from '@/lib/supplements';
import { useAuthStore } from '@/stores/auth-store';

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type ScheduleSegment = ScheduleKind;

type EditorDraft = {
  name: string;
  doseAmount: string;
  doseUnit: DoseUnit;
  scheduleKind: ScheduleSegment;
  intervalDays: number;
  weekdays: number[];
  startDate: string;
  cycleEnabled: boolean;
  cycleWeeksOn: string;
  cycleWeeksOff: string;
  cycleAnchorDate: string;
  isActive: boolean;
};

function emptyDraft(): EditorDraft {
  const today = localDateKey();
  return {
    name: '',
    doseAmount: '',
    doseUnit: 'mg',
    scheduleKind: 'daily',
    intervalDays: 2,
    weekdays: [1, 2, 3, 4, 5],
    startDate: today,
    cycleEnabled: false,
    cycleWeeksOn: '12',
    cycleWeeksOff: '4',
    cycleAnchorDate: today,
    isActive: true,
  };
}

function draftFromSupplement(s: Supplement): EditorDraft {
  return {
    name: s.name,
    doseAmount: s.dose_amount == null ? '' : String(s.dose_amount),
    doseUnit: (DOSE_UNITS.includes(s.dose_unit as DoseUnit)
      ? s.dose_unit
      : s.dose_unit === 'Kapsel'
        ? 'capsule'
        : s.dose_unit === 'Tablette'
          ? 'tablet'
          : 'mg') as DoseUnit,
    scheduleKind: s.schedule_kind,
    intervalDays: Math.min(30, Math.max(2, s.interval_days ?? 2)),
    weekdays: s.weekdays?.length ? [...s.weekdays] : [1, 2, 3, 4, 5],
    startDate: s.start_date,
    cycleEnabled: s.cycle_on_days != null && s.cycle_off_days != null,
    cycleWeeksOn:
      s.cycle_on_days != null ? String(Math.max(1, Math.round(s.cycle_on_days / 7))) : '12',
    cycleWeeksOff:
      s.cycle_off_days != null ? String(Math.max(1, Math.round(s.cycle_off_days / 7))) : '4',
    cycleAnchorDate: s.cycle_anchor_date ?? s.start_date,
    isActive: s.is_active,
  };
}

function draftToWriteInput(draft: EditorDraft): SupplementWriteInput | null {
  const name = draft.name.trim();
  if (!name) {
    return null;
  }

  const parsedDose =
    draft.doseAmount.trim() === '' ? null : Number(draft.doseAmount.replace(',', '.'));
  if (parsedDose != null && (!Number.isFinite(parsedDose) || parsedDose < 0)) {
    return null;
  }

  const weeksOn = Number(draft.cycleWeeksOn);
  const weeksOff = Number(draft.cycleWeeksOff);
  const cycleEnabled = draft.cycleEnabled;

  if (cycleEnabled) {
    if (!Number.isFinite(weeksOn) || weeksOn < 1 || !Number.isFinite(weeksOff) || weeksOff < 1) {
      return null;
    }
  }

  if (draft.scheduleKind === 'weekdays' && draft.weekdays.length === 0) {
    return null;
  }

  return {
    name,
    dose_amount: parsedDose,
    dose_unit: parsedDose == null ? null : draft.doseUnit,
    schedule_kind: draft.scheduleKind,
    interval_days: draft.scheduleKind === 'interval' ? draft.intervalDays : null,
    weekdays: draft.scheduleKind === 'weekdays' ? [...draft.weekdays].sort((a, b) => a - b) : null,
    start_date: draft.startDate,
    cycle_on_days: cycleEnabled ? Math.round(weeksOn) * 7 : null,
    cycle_off_days: cycleEnabled ? Math.round(weeksOff) * 7 : null,
    cycle_anchor_date: cycleEnabled ? draft.cycleAnchorDate : null,
    is_active: draft.isActive,
  };
}

function openDatePicker(options: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  if (Platform.OS === 'android') {
    DateTimePickerAndroid.open({
      value: options.value,
      mode: 'date',
      onChange: (_event: DateTimePickerEvent, selected?: Date) => {
        if (selected) {
          options.onChange(selected);
        }
      },
    });
    return;
  }
}

type SupplementEditorSheetProps = {
  visible: boolean;
  supplement: Supplement | null;
  isNew: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: SupplementWriteInput) => void;
  onDelete?: () => void;
};

function SupplementEditorSheet({
  visible,
  supplement,
  isNew,
  isSaving,
  onClose,
  onSave,
  onDelete,
}: SupplementEditorSheetProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<EditorDraft>(emptyDraft);
  const [showIosStartPicker, setShowIosStartPicker] = useState(false);
  const [showIosCyclePicker, setShowIosCyclePicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDraft(supplement ? draftFromSupplement(supplement) : emptyDraft());
    setShowIosStartPicker(false);
    setShowIosCyclePicker(false);
  }, [visible, supplement]);

  const pausePreview = useMemo(() => {
    if (!draft.cycleEnabled) {
      return null;
    }
    const weeksOn = Number(draft.cycleWeeksOn);
    if (!Number.isFinite(weeksOn) || weeksOn < 1) {
      return null;
    }
    const pause = cyclePauseStartDate({
      cycle_on_days: Math.round(weeksOn) * 7,
      cycle_anchor_date: draft.cycleAnchorDate,
    });
    if (pause == null) {
      return null;
    }
    return t('supplements.editor.cyclePausePreview', {
      date: pause.toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    });
  }, [draft.cycleAnchorDate, draft.cycleEnabled, draft.cycleWeeksOn, i18n.language, t]);

  const canSave = draftToWriteInput(draft) != null && !isSaving;

  function toggleWeekday(day: number) {
    setDraft((current) => {
      const has = current.weekdays.includes(day);
      const next = has
        ? current.weekdays.filter((entry) => entry !== day)
        : [...current.weekdays, day];
      return { ...current, weekdays: next };
    });
  }

  function pickStartDate() {
    const value = parseDateOnly(draft.startDate);
    if (Platform.OS === 'android') {
      openDatePicker({
        value,
        onChange: (date) => setDraft((current) => ({ ...current, startDate: localDateKey(date) })),
      });
      return;
    }
    setShowIosStartPicker((open) => !open);
    setShowIosCyclePicker(false);
  }

  function pickCycleAnchor() {
    const value = parseDateOnly(draft.cycleAnchorDate);
    if (Platform.OS === 'android') {
      openDatePicker({
        value,
        onChange: (date) =>
          setDraft((current) => ({ ...current, cycleAnchorDate: localDateKey(date) })),
      });
      return;
    }
    setShowIosCyclePicker((open) => !open);
    setShowIosStartPicker(false);
  }

  return (
    <GlassBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} numberInputAccessory>
      <View className="px-5 pb-6 pt-2">
        <Text className="mb-4 text-xl font-bold text-gray-900">
          {isNew ? t('supplements.editor.createTitle') : t('supplements.editor.editTitle')}
        </Text>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 520 }}>
          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t('supplements.editor.nameLabel')}
          </Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
            placeholder={t('supplements.editor.namePlaceholder')}
            placeholderTextColor="#9CA3AF"
            className="mb-4 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-base text-gray-900"
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t('supplements.editor.doseLabel')}
          </Text>
          <View className="mb-2 flex-row gap-2">
            <TextInput
              value={draft.doseAmount}
              onChangeText={(doseAmount) => setDraft((current) => ({ ...current, doseAmount }))}
              keyboardType="decimal-pad"
              {...getNumberInputAccessoryProps('decimal-pad')}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              className="w-28 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-base text-gray-900"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
              <View className="flex-row gap-2">
                {DOSE_UNITS.map((unit) => {
                  const active = draft.doseUnit === unit;
                  return (
                    <Pressable
                      key={unit}
                      onPress={() => setDraft((current) => ({ ...current, doseUnit: unit }))}
                      className={`rounded-full px-3 py-2 ${active ? 'bg-[#4F46E5]' : 'bg-white/70'}`}>
                      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>
                        {unit === 'capsule' || unit === 'tablet'
                          ? t(`supplements.units.${unit}`)
                          : unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <Text className="mb-2 mt-2 text-sm font-medium text-gray-700">
            {t('supplements.editor.scheduleLabel')}
          </Text>
          <View className="mb-3">
            <PillSegmentSwitcher
              compact
              value={draft.scheduleKind}
              onChange={(scheduleKind) => setDraft((current) => ({ ...current, scheduleKind }))}
              segments={[
                { id: 'daily', label: t('supplements.schedule.daily') },
                { id: 'interval', label: t('supplements.schedule.intervalSegment') },
                { id: 'weekdays', label: t('supplements.schedule.weekdaysSegment') },
              ]}
            />
          </View>

          {draft.scheduleKind === 'interval' ? (
            <View className="mb-3">
              <Text className="mb-2 text-sm text-gray-500">
                {t('supplements.editor.intervalHint')}
              </Text>
              <View className="mb-3 flex-row items-center gap-3">
                <Pressable
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      intervalDays: Math.max(2, current.intervalDays - 1),
                    }))
                  }
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/80">
                  <Text className="text-xl font-semibold text-[#4F46E5]">−</Text>
                </Pressable>
                <Text className="min-w-[72px] text-center text-base font-semibold text-gray-900">
                  {t('supplements.schedule.everyNDays', { count: draft.intervalDays })}
                </Text>
                <Pressable
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      intervalDays: Math.min(30, current.intervalDays + 1),
                    }))
                  }
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/80">
                  <Text className="text-xl font-semibold text-[#4F46E5]">+</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={pickStartDate}
                className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3">
                <Text className="text-sm text-gray-500">{t('supplements.editor.startDate')}</Text>
                <Text className="mt-1 text-base font-medium text-gray-900">
                  {formatAppDate(parseDateOnly(draft.startDate), i18n.language)}
                </Text>
              </Pressable>
              {showIosStartPicker && Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={parseDateOnly(draft.startDate)}
                  mode="date"
                  display="spinner"
                  onChange={(_event, selected) => {
                    if (selected) {
                      setDraft((current) => ({
                        ...current,
                        startDate: localDateKey(selected),
                      }));
                    }
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {draft.scheduleKind === 'weekdays' ? (
            <View className="mb-3 flex-row justify-between">
              {ISO_WEEKDAYS.map((day) => {
                const active = draft.weekdays.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => toggleWeekday(day)}
                    className={`h-10 w-10 items-center justify-center rounded-full ${
                      active ? 'bg-[#4F46E5]' : 'bg-white/70'
                    }`}>
                    <Text
                      className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
                      {t(`supplements.schedule.weekdayDot.${day}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View className="mb-2 mt-2 flex-row items-center justify-between">
            <Text className="flex-1 text-sm font-medium text-gray-700">
              {t('supplements.editor.cycleToggle')}
            </Text>
            <Switch
              value={draft.cycleEnabled}
              onValueChange={(cycleEnabled) =>
                setDraft((current) => ({ ...current, cycleEnabled }))
              }
              trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {draft.cycleEnabled ? (
            <View className="mb-3">
              <View className="mb-2 flex-row gap-2">
                <View className="flex-1">
                  <Text className="mb-1 text-xs text-gray-500">
                    {t('supplements.editor.cycleWeeksOn')}
                  </Text>
                  <TextInput
                    value={draft.cycleWeeksOn}
                    onChangeText={(cycleWeeksOn) =>
                      setDraft((current) => ({ ...current, cycleWeeksOn }))
                    }
                    keyboardType="number-pad"
                    {...getNumberInputAccessoryProps('number-pad')}
                    className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2.5 text-base text-gray-900"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-xs text-gray-500">
                    {t('supplements.editor.cycleWeeksOff')}
                  </Text>
                  <TextInput
                    value={draft.cycleWeeksOff}
                    onChangeText={(cycleWeeksOff) =>
                      setDraft((current) => ({ ...current, cycleWeeksOff }))
                    }
                    keyboardType="number-pad"
                    {...getNumberInputAccessoryProps('number-pad')}
                    className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2.5 text-base text-gray-900"
                  />
                </View>
              </View>
              <Pressable
                onPress={pickCycleAnchor}
                className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3">
                <Text className="text-sm text-gray-500">
                  {t('supplements.editor.cycleAnchor')}
                </Text>
                <Text className="mt-1 text-base font-medium text-gray-900">
                  {formatAppDate(parseDateOnly(draft.cycleAnchorDate), i18n.language)}
                </Text>
              </Pressable>
              {showIosCyclePicker && Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={parseDateOnly(draft.cycleAnchorDate)}
                  mode="date"
                  display="spinner"
                  onChange={(_event, selected) => {
                    if (selected) {
                      setDraft((current) => ({
                        ...current,
                        cycleAnchorDate: localDateKey(selected),
                      }));
                    }
                  }}
                />
              ) : null}
              {pausePreview ? (
                <Text className="mt-2 text-sm text-gray-500">{pausePreview}</Text>
              ) : null}
            </View>
          ) : null}

          <View className="mb-4 mt-2 flex-row items-center justify-between">
            <Text className="flex-1 text-sm font-medium text-gray-700">
              {t('supplements.editor.active')}
            </Text>
            <Switch
              value={draft.isActive}
              onValueChange={(isActive) => setDraft((current) => ({ ...current, isActive }))}
              trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {!isNew && onDelete ? (
            <Pressable
              onPress={onDelete}
              className="mb-4 items-center rounded-xl py-3"
              style={({ pressed }) => [
                { backgroundColor: pressed ? 'rgba(220,38,38,0.12)' : 'rgba(220,38,38,0.06)' },
              ]}>
              <Text className="text-sm font-semibold text-red-600">
                {t('supplements.editor.delete')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <Pressable
          disabled={!canSave}
          onPress={() => {
            const input = draftToWriteInput(draft);
            if (input) {
              onSave(input);
            }
          }}
          className={`mt-2 h-12 items-center justify-center rounded-xl ${
            canSave ? 'bg-[#4F46E5]' : 'bg-indigo-300'
          }`}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">{t('settings.common.save')}</Text>
          )}
        </Pressable>
      </View>
    </GlassBottomSheet>
  );
}

export default function SupplementsScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [isNew, setIsNew] = useState(false);

  const listQueryKey = useMemo(() => ['supplements', 'list', userId] as const, [userId]);

  const { data: supplements, isLoading, isError, error } = useQuery({
    queryKey: listQueryKey,
    enabled: Boolean(userId),
    queryFn: () => fetchSupplements(userId!),
  });

  useEffect(() => {
    if (isError && error) {
      console.error('[Supplements] load failed:', error);
    }
  }, [error, isError]);

  const invalidateList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['supplements'] });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (input: SupplementWriteInput) => {
      if (!userId) {
        throw new Error('Missing user id');
      }
      if (isNew || editing == null) {
        return createSupplement(userId, input);
      }
      return updateSupplement(editing.id, input);
    },
    onSuccess: async () => {
      await invalidateList();
      setSheetOpen(false);
      setEditing(null);
    },
    onError: (saveError) => {
      console.error('[Supplements] save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('supplements.errors.saveFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editing) {
        throw new Error('Nothing to delete');
      }
      await deleteSupplement(editing.id);
    },
    onSuccess: async () => {
      await invalidateList();
      setSheetOpen(false);
      setEditing(null);
    },
    onError: (deleteError) => {
      console.error('[Supplements] delete failed:', deleteError);
      Alert.alert(t('settings.errors.title'), t('supplements.errors.deleteFailed'));
    },
  });

  function openCreate() {
    setIsNew(true);
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(item: Supplement) {
    setIsNew(false);
    setEditing(item);
    setSheetOpen(true);
  }

  function confirmDelete() {
    Alert.alert(t('supplements.editor.deleteTitle'), t('supplements.editor.deleteMessage'), [
      { text: t('settings.common.cancel'), style: 'cancel' },
      {
        text: t('supplements.editor.delete'),
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <SettingsBackButton
          label={t('settings.subSegments.profile')}
          href={
            {
              pathname: '/koli',
              params: { segment: 'settings', settingsSubSegment: 'profile' },
            } as Href
          }
        />
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        <Text className="mb-2 text-2xl font-bold text-gray-900">
          {t('supplements.screenTitle')}
        </Text>
        <Text className="mb-6 text-base text-gray-500">{t('supplements.subtitle')}</Text>

        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator color={ONBOARDING_ACCENT} />
          </View>
        ) : isError ? (
          <Text className="text-center text-base text-gray-600">
            {t('supplements.errors.loadFailed')}
          </Text>
        ) : (supplements?.length ?? 0) === 0 ? (
          <View
            style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}
            className="items-center px-6 py-10">
            <Text className="text-center text-base font-semibold text-gray-900">
              {t('supplements.emptyTitle')}
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              {t('supplements.emptySubtitle')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {supplements?.map((item) => {
              const dose = formatDoseLabel(item.dose_amount, item.dose_unit, t);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => openEdit(item)}
                  style={({ pressed }) => [
                    getOnboardingIdleCardStyle(),
                    {
                      borderRadius: ONBOARDING_CARD_RADIUS,
                      opacity: item.is_active ? 1 : 0.55,
                      backgroundColor: pressed
                        ? GLASS_SURFACE_PRESSED.backgroundColor
                        : undefined,
                    },
                  ]}>
                  <View className="px-4 py-3">
                    <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {dose ? (
                      <Text className="mt-1 text-sm text-gray-500">{dose}</Text>
                    ) : null}
                    <Text className="mt-1 text-sm text-gray-500">
                      {describeSchedule(item, t)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={openCreate}
          className="mt-6 h-12 items-center justify-center rounded-xl bg-[#4F46E5]">
          <Text className="text-base font-semibold text-white">
            {t('supplements.add')}
          </Text>
        </Pressable>

        {userId ? (
          <SupplementRemindersSection
            userId={userId}
            supplements={supplements ?? []}
          />
        ) : null}
      </ScrollView>

      <SupplementEditorSheet
        visible={sheetOpen}
        supplement={editing}
        isNew={isNew}
        isSaving={saveMutation.isPending || deleteMutation.isPending}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSave={(input) => saveMutation.mutate(input)}
        onDelete={isNew ? undefined : confirmDelete}
      />
    </HomeLayout>
  );
}
