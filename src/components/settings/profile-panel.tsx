import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import { GlassCard } from '@/components/ui/glass-card';
import { ProfileHeader } from '@/components/settings/profile-header';
import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { SubscriptionSection } from '@/components/settings/subscription-section';
import { SETTINGS_GLASS_DIVIDER_CLASS } from '@/components/ui/glass-styles';
import { UnitSystemToggle } from '@/components/onboarding/unit-system-toggle';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { requestHealthPermissions } from '@/lib/health';
import { recalculateCalorieGoalForHealthKitChange } from '@/lib/recalculate-calorie-goal-for-health';
import {
  getUserPreference,
  HEALTH_CONNECTED_PREFERENCE_KEY,
  setUserPreference,
} from '@/lib/user-preferences';
import { SUPPORTED_LANGUAGES, setAppLanguage, type SupportedLanguage } from '@/i18n';
import { isEmailPasswordUser } from '@/lib/auth-provider';
import { resolveDisplayName } from '@/lib/home';
import { useAccountDeletion } from '@/hooks/use-account-deletion';
import {
  changePassword,
  updateDisplayName,
  uploadAvatar,
} from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

export function ProfilePanel() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const userId = session?.user?.id;

  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const setUnitSystem = useOnboardingStore((state) => state.setUnitSystem);

  const { data, isLoading, isError, error, refetch } = useProfileSettings(userId);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [isUpdatingHealthConnection, setIsUpdatingHealthConnection] = useState(false);
  const { confirmDeleteAccount } = useAccountDeletion();

  const displayName = useMemo(
    () =>
      resolveDisplayName({
        fullName: session?.user?.user_metadata?.full_name,
        name: session?.user?.user_metadata?.name,
        email: session?.user?.email,
      }) ?? t('settings.profile.unnamed'),
    [session?.user, t],
  );

  const email = session?.user?.email ?? '';
  const showPasswordSection = isEmailPasswordUser(session);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  useEffect(() => {
    if (isError && error) {
      console.error('[ProfilePanel] load failed:', error);
    }
  }, [error, isError]);

  useEffect(() => {
    if (!userId) {
      setHealthConnected(false);
      return;
    }

    void getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY)
      .then(setHealthConnected)
      .catch((loadError) => {
        console.error('[ProfilePanel] health preference load failed:', loadError);
      });
  }, [userId]);

  async function refreshProfile() {
    await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
    await queryClient.invalidateQueries({ queryKey: ['health-connected-preference', userId] });
    await refetch();
  }

  async function handleHealthConnectionChange(nextValue: boolean) {
    if (!userId || isUpdatingHealthConnection) {
      return;
    }

    if (nextValue) {
      Alert.alert(
        t('settings.health.connectConfirmTitle'),
        t('settings.health.connectConfirmMessage'),
        [
          { text: t('settings.health.connectConfirmCancel'), style: 'cancel' },
          {
            text: t('settings.health.connectConfirmAction'),
            onPress: () => void connectHealth(),
          },
        ],
      );
      return;
    }

    Alert.alert(
      t('settings.health.disconnectConfirmTitle'),
      t('settings.health.disconnectConfirmMessage'),
      [
        { text: t('settings.health.disconnectConfirmCancel'), style: 'cancel' },
        {
          text: t('settings.health.disconnectConfirmAction'),
          onPress: () => void disconnectHealth(),
        },
      ],
    );
  }

  async function connectHealth() {
    if (!userId || isUpdatingHealthConnection) {
      return;
    }

    setIsUpdatingHealthConnection(true);

    try {
      const granted = await requestHealthPermissions();
      if (!granted) {
        Alert.alert(t('settings.errors.title'), t('settings.health.permissionDenied'));
        return;
      }

      await setUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY, true);
      await recalculateCalorieGoalForHealthKitChange(userId, true);
      setHealthConnected(true);
      await queryClient.invalidateQueries({
        queryKey: ['health-connected-preference', userId],
      });
      await queryClient.invalidateQueries({ queryKey: ['active-energy-burned-today'] });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
    } catch (saveError) {
      console.error('[ProfilePanel] health connect failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('settings.health.saveFailed'));
    } finally {
      setIsUpdatingHealthConnection(false);
    }
  }

  async function disconnectHealth() {
    if (!userId || isUpdatingHealthConnection) {
      return;
    }

    setIsUpdatingHealthConnection(true);

    try {
      await setUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY, false);
      await recalculateCalorieGoalForHealthKitChange(userId, false);
      setHealthConnected(false);
      await queryClient.invalidateQueries({
        queryKey: ['health-connected-preference', userId],
      });
      await queryClient.invalidateQueries({ queryKey: ['active-energy-burned-today'] });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
    } catch (saveError) {
      console.error('[ProfilePanel] health disconnect failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('settings.health.saveFailed'));
    } finally {
      setIsUpdatingHealthConnection(false);
    }
  }

  function openNameEditor() {
    setNameDraft(displayName === t('settings.profile.unnamed') ? '' : displayName);
    setShowNameModal(true);
  }

  async function saveName() {
    setIsSavingName(true);
    try {
      await updateDisplayName(nameDraft);
      setShowNameModal(false);
      await refreshProfile();
    } catch (saveError) {
      console.error('[ProfilePanel] name save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('settings.profile.nameSaveFailed'));
    } finally {
      setIsSavingName(false);
    }
  }

  function openAvatarPicker() {
    Alert.alert(t('settings.profile.avatarTitle'), t('settings.profile.avatarMessage'), [
      { text: t('settings.profile.avatarCamera'), onPress: () => void pickAvatar('camera') },
      { text: t('settings.profile.avatarLibrary'), onPress: () => void pickAvatar('library') },
      { text: t('settings.common.cancel'), style: 'cancel' },
    ]);
  }

  async function pickAvatar(source: 'camera' | 'library') {
    if (!userId) {
      return;
    }

    const ImagePicker = await import('expo-image-picker');

    const permissionResult =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t('settings.errors.title'), t('settings.profile.avatarPermissionDenied'));
      return;
    }

    const pickerResult =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });

    if (pickerResult.canceled || !pickerResult.assets[0]) {
      return;
    }

    const asset = pickerResult.assets[0];
    setIsUploadingAvatar(true);

    try {
      await uploadAvatar({
        userId,
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
      await refreshProfile();
    } catch (uploadError) {
      console.error('[ProfilePanel] avatar upload failed:', uploadError);
      Alert.alert(t('settings.errors.title'), t('settings.profile.avatarUploadFailed'));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleChangePassword() {
    if (!email) {
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('settings.errors.title'), t('settings.password.allFieldsRequired'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('settings.errors.title'), t('settings.password.tooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('settings.errors.title'), t('settings.password.mismatch'));
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword({ email, currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      Alert.alert(t('settings.password.successTitle'), t('settings.password.successMessage'));
    } catch (passwordError) {
      console.error('[ProfilePanel] password change failed:', passwordError);
      Alert.alert(t('settings.errors.title'), t('settings.password.changeFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(t('settings.signOut.title'), t('settings.signOut.message'), [
      { text: t('settings.common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut.confirm'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login' as Href);
        },
      },
    ]);
  }

  const calorieGoalLabel =
    data?.profile.daily_calorie_goal != null
      ? t('settings.calorieGoal.value', { calories: data.profile.daily_calorie_goal })
      : t('settings.calorieGoal.notSet');

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={ONBOARDING_ACCENT} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-base text-gray-600">
          {t('settings.errors.loadFailed')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        <ProfileHeader
          displayName={displayName}
          email={email}
          avatarSignedUrl={data?.avatarSignedUrl ?? null}
          isUploadingAvatar={isUploadingAvatar}
          onPressAvatar={openAvatarPicker}
          onPressName={openNameEditor}
        />

        <SettingsSection title={t('settings.language.sectionTitle')} unframed>
          <CompactSegmentToggle
            variant="language"
            value={i18n.language as SupportedLanguage}
            segments={SUPPORTED_LANGUAGES.map((language) => ({
              id: language,
              label: language.toUpperCase(),
            }))}
            onChange={setAppLanguage}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.units.sectionTitle')} unframed>
          <UnitSystemToggle
              unitSystem={unitSystem}
              metricLabel={t('onboarding.units.cm')}
              imperialLabel={t('onboarding.units.ftIn')}
            onChange={setUnitSystem}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.health.sectionTitle')}>
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="flex-1 text-base text-gray-900">{t('settings.health.toggleLabel')}</Text>
            <Switch
              value={healthConnected}
              disabled={isUpdatingHealthConnection}
              onValueChange={(value) => void handleHealthConnectionChange(value)}
              trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-sm text-gray-500">
              {healthConnected
                ? t('settings.health.connectedHint')
                : t('settings.health.disconnectedHint')}
            </Text>
            {healthConnected ? (
              <>
                <Text className="mt-2 text-sm text-gray-500">
                  {t('settings.health.disconnectHint')}
                </Text>
                <Text className="mt-2 text-sm text-gray-500">{t('settings.health.revokeHint')}</Text>
              </>
            ) : null}
          </View>
        </SettingsSection>

        <SettingsSection title={t('settings.calorieGoal.sectionTitle')}>
          <SettingsRow
            label={t('settings.calorieGoal.current')}
            value={calorieGoalLabel}
            onPress={() => router.push('/koli/calorie-goal' as Href)}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.onboardingReview.sectionTitle')}>
          <SettingsRow
            label={t('settings.onboardingReview.action')}
            onPress={() =>
              router.push({ pathname: '/onboarding', params: { mode: 'review' } } as Href)
            }
          />
        </SettingsSection>

        <SubscriptionSection
          userId={userId}
          trialEndsAt={data?.profile.trial_ends_at ?? null}
          subscription={data?.subscription ?? null}
        />

        {showPasswordSection ? (
          <SettingsSection title={t('settings.password.sectionTitle')}>
            <SettingsRow
              label={t('settings.password.change')}
              onPress={() => setShowPasswordForm((current) => !current)}
              showChevron={false}
              accessory={
                <Ionicons
                  name={showPasswordForm ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#9CA3AF"
                />
              }
            />
            {showPasswordForm ? (
              <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-4`}>
                <TextInput
                  secureTextEntry
                  placeholder={t('settings.password.current')}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  className="mb-2 h-11 w-full self-stretch rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900"
                />
                <TextInput
                  secureTextEntry
                  placeholder={t('settings.password.new')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  className="mb-2 h-11 w-full self-stretch rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900"
                />
                <TextInput
                  secureTextEntry
                  placeholder={t('settings.password.confirm')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  className="mb-3 h-11 w-full self-stretch rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900"
                />
                <Pressable
                  className="h-11 items-center justify-center rounded-xl bg-[#4F46E5]"
                  disabled={isChangingPassword}
                  onPress={() => void handleChangePassword()}>
                  {isChangingPassword ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-base font-semibold text-white">
                      {t('settings.password.save')}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </SettingsSection>
        ) : null}

        <SettingsSection>
          <SettingsRow label={t('settings.signOut.action')} onPress={confirmSignOut} />
          <SettingsRow
            label={t('settings.deleteAccount.action')}
            destructive
            isLast
            onPress={confirmDeleteAccount}
            showChevron={false}
          />
        </SettingsSection>

      </ScrollView>

      <Modal transparent visible={showNameModal} animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <Pressable className="flex-1 justify-center bg-black/40 px-6" onPress={() => setShowNameModal(false)}>
          <Pressable className="w-full self-stretch" onPress={(event) => event.stopPropagation()}>
            <GlassCard className="p-5">
            <Text className="mb-3 text-lg font-semibold text-gray-900">
              {t('settings.profile.editNameTitle')}
            </Text>
            <TextInput
              autoFocus
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t('settings.profile.editNamePlaceholder')}
              className="mb-4 h-11 w-full self-stretch rounded-xl border border-gray-200 px-3 text-base text-gray-900"
            />
            <View className="flex-row justify-end gap-3">
              <Pressable className="px-3 py-2" onPress={() => setShowNameModal(false)}>
                <Text className="text-base text-gray-500">{t('settings.common.cancel')}</Text>
              </Pressable>
              <Pressable
                className="rounded-lg bg-[#4F46E5] px-4 py-2"
                disabled={isSavingName}
                onPress={() => void saveName()}>
                {isSavingName ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">{t('settings.common.save')}</Text>
                )}
              </Pressable>
            </View>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
