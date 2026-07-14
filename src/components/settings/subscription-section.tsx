import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { SettingsSection } from '@/components/settings/settings-section';
import { SETTINGS_GLASS_DIVIDER_CLASS } from '@/components/ui/glass-styles';
import { useTrialStatus } from '@/hooks/use-premium-access';
import { LEGAL_LINKS } from '@/lib/legal-links';
import type { SubscriptionRow } from '@/lib/profile';
import {
  APPLE_SUBSCRIPTIONS_URL,
  formatSubscriptionStatusDate,
} from '@/lib/subscription';

type SubscriptionSectionProps = {
  userId: string | undefined;
  trialEndsAt: string | null;
  subscription: SubscriptionRow | null;
};

type SubscriptionUiMode = 'trial' | 'no_subscription' | 'paid' | 'override';

function openAppleSubscriptions() {
  void Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
}

function hasActiveAccessOverride(subscription: SubscriptionRow | null): boolean {
  return (
    subscription?.access_override === 'free_forever' ||
    (subscription?.access_override === 'free_until' &&
      subscription.access_override_until != null &&
      new Date(subscription.access_override_until) > new Date())
  );
}

function resolveSubscriptionUiMode(params: {
  isInTrial: boolean;
  subscription: SubscriptionRow | null;
}): SubscriptionUiMode {
  const { isInTrial, subscription } = params;

  if (subscription?.is_active === true) {
    return 'paid';
  }

  if (hasActiveAccessOverride(subscription)) {
    return 'override';
  }

  if (isInTrial) {
    return 'trial';
  }

  return 'no_subscription';
}

export function SubscriptionSection({
  userId,
  trialEndsAt,
  subscription,
}: SubscriptionSectionProps) {
  const { t, i18n } = useTranslation();
  const [showPaywall, setShowPaywall] = useState(false);
  const { isInTrial, daysLeft: trialDaysLeft } = useTrialStatus(userId);

  const uiMode = resolveSubscriptionUiMode({
    isInTrial,
    subscription,
  });

  const renewalDate =
    subscription?.current_period_end != null
      ? formatSubscriptionStatusDate(subscription.current_period_end, i18n.language)
      : null;

  function showPlaceholderAlert(messageKey: string) {
    Alert.alert(t('settings.subscription.placeholderTitle'), t(messageKey));
  }

  function renderStatus() {
    if (uiMode === 'trial') {
      return (
        <Text className="text-sm text-gray-500">
          {t('settings.subscription.statusTrialDays', { count: trialDaysLeft })}
        </Text>
      );
    }

    if (uiMode === 'no_subscription') {
      return (
        <Text className="text-sm text-gray-500">{t('settings.subscription.statusNone')}</Text>
      );
    }

    return (
      <>
        <Text className="text-sm text-gray-500">
          {t('settings.subscription.statusActivePaid')}
        </Text>
        {uiMode === 'paid' && renewalDate ? (
          <Text className="mt-1 text-sm text-gray-500">
            {t('settings.subscription.renewsOn', { date: renewalDate })}
          </Text>
        ) : null}
      </>
    );
  }

  function renderGetPremiumButton() {
    return (
      <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3`}>
        <Pressable
          className="h-11 items-center justify-center rounded-xl bg-[#4F46E5]"
          onPress={() => setShowPaywall(true)}>
          <Text className="text-base font-semibold text-white">
            {t('settings.subscription.getPremium')}
          </Text>
        </Pressable>
      </View>
    );
  }

  function renderPaidContractActions() {
    return (
      <>
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3`}>
          <Pressable
            className="h-11 items-center justify-center rounded-xl bg-[#4F46E5]"
            onPress={openAppleSubscriptions}>
            <Text className="text-base font-semibold text-white">
              {t('settings.subscription.manage')}
            </Text>
          </Pressable>
        </View>

        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3`}>
          <Pressable
            className="h-11 items-center justify-center rounded-xl border border-[#4F46E5]"
            onPress={openAppleSubscriptions}>
            <Text className="text-base font-semibold text-[#4F46E5]">
              {t('settings.subscription.cancel')}
            </Text>
          </Pressable>
          <Text className="mt-2 text-xs leading-5 text-gray-500">
            {t('settings.subscription.cancelHint')}
          </Text>
        </View>

        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3`}>
          <Pressable
            className="min-h-11 items-center justify-center rounded-xl border border-white/70 py-2"
            onPress={() => {
              // TODO(launch): Must trigger an actual withdrawal flow per §356a BGB, not just link to terms.
              void Linking.openURL(LEGAL_LINKS.termsOfService).catch(() => {
                showPlaceholderAlert('settings.subscription.withdrawPlaceholder');
              });
            }}>
            <Text className="text-base font-semibold text-gray-900">
              {t('settings.subscription.withdraw')}
            </Text>
          </Pressable>
          <Text className="mt-2 text-xs leading-5 text-gray-500">
            {t('settings.subscription.withdrawHint')}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <SettingsSection title={t('settings.subscription.sectionTitle')}>
        <View className="px-4 py-4">
          {renderStatus()}
          {uiMode === 'trial' || uiMode === 'no_subscription' ? (
            <Text className="mt-2 text-base font-semibold text-gray-900">
              {t('settings.subscription.price')}
            </Text>
          ) : null}
        </View>

        {uiMode === 'trial' || uiMode === 'no_subscription' ? renderGetPremiumButton() : null}
        {uiMode === 'paid' ? renderPaidContractActions() : null}
      </SettingsSection>

      <PaywallSheet
        visible={showPaywall}
        userId={userId}
        onClose={() => setShowPaywall(false)}
      />
    </>
  );
}
