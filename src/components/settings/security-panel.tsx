import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { getGlassCardStyle, SETTINGS_GLASS_DIVIDER_CLASS } from '@/components/ui/glass-styles';
import { useAccountDeletion } from '@/hooks/use-account-deletion';
import type { AuthProvider } from '@/lib/auth-provider';
import {
  fetchSecurityStatus,
  formatLastSignIn,
  type SecurityStatus,
} from '@/lib/security-status';

type SecurityPanelProps = {
  onOpenProfile?: () => void;
};

function providerLabel(provider: AuthProvider, t: (key: string) => string): string {
  switch (provider) {
    case 'apple':
      return t('settings.security.providers.apple');
    case 'google':
      return t('settings.security.providers.google');
    case 'email':
      return t('settings.security.providers.email');
    default:
      return t('settings.security.providers.unknown');
  }
}

function StatusRow({
  icon,
  title,
  description,
  positive = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  positive?: boolean;
}) {
  return (
    <View className="flex-row px-4 py-4">
      <View
        className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${
          positive ? 'bg-[#EEF2FF]' : 'bg-red-50'
        }`}>
        <Ionicons
          name={icon}
          size={20}
          color={positive ? ONBOARDING_ACCENT : '#DC2626'}
        />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900">{title}</Text>
        <Text className="mt-1 text-sm leading-5 text-gray-500">{description}</Text>
      </View>
    </View>
  );
}

export function SecurityPanel({ onOpenProfile }: SecurityPanelProps) {
  const { t, i18n } = useTranslation();
  const { confirmDeleteAccount } = useAccountDeletion();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);

  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const nextStatus = await fetchSecurityStatus();
      setStatus(nextStatus);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  return (
    <ScrollView
      className="flex-1 px-6"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <SettingsSection title={t('settings.security.statusSectionTitle')}>
        {isRefreshing && !status ? (
          <View className="items-center py-8">
            <ActivityIndicator color={ONBOARDING_ACCENT} />
          </View>
        ) : (
          <>
            <StatusRow
              icon={status?.cloudConnected ? 'cloud-done-outline' : 'cloud-offline-outline'}
              title={
                status?.cloudConnected
                  ? t('settings.security.cloud.connectedTitle')
                  : t('settings.security.cloud.disconnectedTitle')
              }
              description={
                status?.cloudConnected
                  ? t('settings.security.cloud.connectedDescription')
                  : t('settings.security.cloud.disconnectedDescription')
              }
              positive={status?.cloudConnected ?? false}
            />
            <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS}`}>
              <StatusRow
                icon="shield-checkmark-outline"
                title={t('settings.security.privacy.title')}
                description={t('settings.security.privacy.description')}
              />
            </View>
          </>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.security.accountSectionTitle')}>
        <View className="px-4 py-4">
          <Text className="text-sm font-medium text-gray-500">
            {t('settings.security.loginMethod')}
          </Text>
          <Text className="mt-1 text-base font-semibold text-gray-900">
            {providerLabel(status?.authProvider ?? 'unknown', t)}
          </Text>
          <Text className="mt-4 text-sm font-medium text-gray-500">
            {t('settings.security.lastSignIn')}
          </Text>
          <Text className="mt-1 text-base text-gray-900">
            {formatLastSignIn(status?.lastSignInAt ?? null, i18n.language)}
          </Text>
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings.security.dataRights.sectionTitle')}>
        <View className="px-4 py-4">
          <Text className="text-sm leading-5 text-gray-600">
            {t('settings.security.dataRights.description')}
          </Text>
        </View>
        <SettingsRow
          label={t('settings.security.dataRights.export')}
          value={t('settings.security.dataRights.comingSoon')}
          dimmed
          showChevron={false}
        />
        <SettingsRow
          label={t('settings.deleteAccount.action')}
          destructive
          isLast
          onPress={confirmDeleteAccount}
          showChevron={false}
        />
      </SettingsSection>

      {onOpenProfile ? (
        <Pressable className="mb-4" onPress={onOpenProfile}>
          <Text className="text-center text-sm text-[#4F46E5]">
            {t('settings.security.manageInProfile')}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={getGlassCardStyle({ minHeight: 48, alignItems: 'center', justifyContent: 'center' })}
        disabled={isRefreshing}
        onPress={() => void refreshStatus()}>
        {isRefreshing ? (
          <ActivityIndicator color={ONBOARDING_ACCENT} />
        ) : (
          <Text className="text-base font-semibold text-[#4F46E5]">
            {t('settings.security.refreshStatus')}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
