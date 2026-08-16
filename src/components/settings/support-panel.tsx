import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';

import * as Updates from 'expo-updates';

import { ExternalLink } from '@/components/external-link';
import { SettingsSection } from '@/components/settings/settings-section';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import {
  GLASS_SURFACE,
  SETTINGS_GLASS_DIVIDER_CLASS,
  getGlassCardStyle,
} from '@/components/ui/glass-styles';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';
import { LEGAL_LINKS } from '@/lib/legal-links';
import {
  clearPushPermissionAskedFlag,
  PUSH_PERMISSION_ASKED_KEY,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import {
  SUPPORT_MESSAGE_CATEGORIES,
  submitSupportMessage,
  type SupportMessageCategory,
} from '@/lib/support';

const debugSecureStore = createChunkedSecureStoreAdapter();

export function SupportPanel() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SupportMessageCategory>('question');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(__DEV__);
  const [isResettingPushFlag, setIsResettingPushFlag] = useState(false);
  const [isLoadingPushDebug, setIsLoadingPushDebug] = useState(false);
  const [pushPermissionAskedFlag, setPushPermissionAskedFlag] = useState<string | null>(null);
  const [pushPermissionsDump, setPushPermissionsDump] = useState<string>('…');

  useEffect(() => {
    if (__DEV__) {
      return;
    }

    let cancelled = false;
    void supabase
      .rpc('is_admin')
      .then(({ data, error }) => {
        if (cancelled || error) {
          return;
        }
        if (data === true) {
          setShowDebugTools(true);
        }
      })
      .catch(() => {
        // Non-admins / RPC unavailable — keep debug tools hidden.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPushDebug = useCallback(async () => {
    setIsLoadingPushDebug(true);
    try {
      const [stored, permissions] = await Promise.all([
        debugSecureStore.getItem(PUSH_PERMISSION_ASKED_KEY),
        Notifications.getPermissionsAsync(),
      ]);
      setPushPermissionAskedFlag(stored);
      setPushPermissionsDump(JSON.stringify(permissions, null, 2));
    } catch (error) {
      setPushPermissionsDump(
        error instanceof Error ? `Error: ${error.message}` : `Error: ${String(error)}`,
      );
    } finally {
      setIsLoadingPushDebug(false);
    }
  }, []);

  useEffect(() => {
    if (!showDebugTools) {
      return;
    }
    void refreshPushDebug();
  }, [showDebugTools, refreshPushDebug]);

  const categories = useMemo(
    () =>
      SUPPORT_MESSAGE_CATEGORIES.map((id) => ({
        id,
        label: t(`settings.support.categories.${id}`),
      })),
    [t],
  );

  async function handleSend() {
    if (!message.trim()) {
      Alert.alert(t('settings.errors.title'), t('settings.support.messageRequired'));
      return;
    }

    setIsSending(true);

    try {
      await submitSupportMessage({ category, message });
      Alert.alert(t('settings.support.sentTitle'), t('settings.support.sentMessage'));
      setMessage('');
    } catch (error) {
      console.warn('[Support] send failed:', error);
      // Keep message text so the user does not have to retype.
      Alert.alert(t('settings.errors.title'), t('settings.support.sendFailed'));
    } finally {
      setIsSending(false);
    }
  }

  async function handleResetPushPermissionFlag() {
    setIsResettingPushFlag(true);
    try {
      await clearPushPermissionAskedFlag();
      await refreshPushDebug();
      Alert.alert(
        'Push flag cleared',
        'push_permission_asked was removed. Save a meal to trigger the prompt again (if iOS still allows asking).',
      );
    } catch (error) {
      console.warn('[Support] clear push flag failed:', error);
      Alert.alert(t('settings.errors.title'), 'Could not clear push_permission_asked.');
    } finally {
      setIsResettingPushFlag(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 px-6"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Text className="mb-4 text-base text-gray-600">{t('settings.support.intro')}</Text>

      <SettingsSection title={t('settings.support.categorySectionTitle')}>
        <View className="flex-row flex-wrap gap-2 px-4 py-4">
          {categories.map((item) => {
            const isActive = category === item.id;

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.categoryChip,
                  isActive ? styles.categoryChipActive : styles.categoryChipIdle,
                ]}
                onPress={() => setCategory(item.id)}>
                <Text
                  className={`text-xs font-semibold ${
                    isActive ? 'text-white' : 'text-gray-600'
                  }`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings.support.messageSectionTitle')} unframed>
        <TextInput
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          placeholder={t('settings.support.messagePlaceholder')}
          value={message}
          onChangeText={setMessage}
          editable={!isSending}
          className="min-h-[140px] w-full self-stretch px-3 py-3 text-base text-gray-900"
          style={getGlassCardStyle({
            borderRadius: 12,
            minHeight: 140,
            width: '100%',
            alignSelf: 'stretch',
          })}
        />
      </SettingsSection>

      <Pressable
        className="mb-8 h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
        disabled={isSending}
        onPress={() => void handleSend()}>
        <Text className="text-base font-semibold text-white">
          {isSending ? t('settings.support.sending') : t('settings.support.send')}
        </Text>
      </Pressable>

      <SettingsSection title={t('settings.support.legalSectionTitle')}>
        <ExternalLink href={LEGAL_LINKS.privacyPolicy} asChild>
          <Pressable className={`border-b ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-base font-semibold text-[#4F46E5]">
              {t('settings.support.legal.privacyPolicy')}
            </Text>
          </Pressable>
        </ExternalLink>
        <ExternalLink href={LEGAL_LINKS.termsOfService} asChild>
          <Pressable className={`border-b ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-base font-semibold text-[#4F46E5]">
              {t('settings.support.legal.termsOfService')}
            </Text>
          </Pressable>
        </ExternalLink>
        <ExternalLink href={LEGAL_LINKS.imprint} asChild>
          <Pressable className="px-4 py-3.5">
            <Text className="text-base font-semibold text-[#4F46E5]">
              {t('settings.support.legal.imprint')}
            </Text>
          </Pressable>
        </ExternalLink>
      </SettingsSection>

      <Text selectable style={styles.updateDebug}>
        OTA {Updates.isEmbeddedLaunch || !Updates.updateId ? 'embedded' : Updates.updateId}
        {' · '}
        {Updates.channel || '—'}
      </Text>

      {showDebugTools ? (
        <SettingsSection title="Debug">
          <View className="px-4 py-4">
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-400">
              SecureStore push_permission_asked
            </Text>
            <Text className="mb-4 font-mono text-sm text-gray-900">
              {isLoadingPushDebug ? '…' : JSON.stringify(pushPermissionAskedFlag)}
            </Text>

            <Text className="mb-1 text-xs font-semibold uppercase text-gray-400">
              Notifications.getPermissionsAsync()
            </Text>
            <View
              className="mb-3 rounded-xl border border-gray-200 bg-white px-3 py-3"
              style={getGlassCardStyle({ borderRadius: 12 })}>
              <Text selectable className="font-mono text-xs leading-5 text-gray-900">
                {isLoadingPushDebug ? 'Loading…' : pushPermissionsDump}
              </Text>
            </View>

            <Pressable
              className="mb-3 h-10 items-center justify-center rounded-xl border border-gray-200 bg-white"
              disabled={isLoadingPushDebug}
              onPress={() => void refreshPushDebug()}>
              <Text className="text-sm font-semibold text-gray-700">
                {isLoadingPushDebug ? 'Refreshing…' : 'Permission-Status neu laden'}
              </Text>
            </Pressable>

            <Text className="mb-3 text-sm leading-5 text-gray-500">
              Clears SecureStore key push_permission_asked (survives reinstall via Keychain).
            </Text>
            <Pressable
              className="h-11 items-center justify-center rounded-xl border border-gray-200 bg-white"
              disabled={isResettingPushFlag}
              onPress={() => void handleResetPushPermissionFlag()}>
              <Text className="text-sm font-semibold text-[#4F46E5]">
                {isResettingPushFlag ? 'Resetting…' : 'Push-Permission zurücksetzen'}
              </Text>
            </Pressable>
          </View>
        </SettingsSection>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipIdle: {
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
  },
  categoryChipActive: {
    backgroundColor: ONBOARDING_ACCENT,
    borderColor: ONBOARDING_ACCENT,
  },
  updateDebug: {
    marginTop: 8,
    paddingHorizontal: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#9CA3AF',
  },
});
