import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { SettingsSection } from '@/components/settings/settings-section';
import { WithdrawalSheet } from '@/components/settings/WithdrawalSheet';
import { SETTINGS_GLASS_DIVIDER_CLASS } from '@/components/ui/glass-styles';
import { useTrialStatus } from '@/hooks/use-premium-access';
import { useRevenueCatPremiumEntitlement } from '@/hooks/use-revenuecat-premium-entitlement';
import { useWithdrawalStatus } from '@/hooks/use-withdrawal-status';
import type { SubscriptionRow } from '@/lib/profile';
import {
  APPLE_SUBSCRIPTIONS_URL,
  formatSubscriptionStatusDate,
} from '@/lib/subscription';
import { useAuthStore } from '@/stores/auth-store';

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
  isPremiumEntitlementActive: boolean;
}): SubscriptionUiMode {
  const { isInTrial, subscription, isPremiumEntitlementActive } = params;

  if (isPremiumEntitlementActive || subscription?.is_active === true) {
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

function hasPaidAppleSubscription(
  subscription: SubscriptionRow | null,
  isPremiumEntitlementActive: boolean,
): boolean {
  if (hasActiveAccessOverride(subscription)) {
    return false;
  }

  if (isPremiumEntitlementActive) {
    return subscription?.status !== 'trialing';
  }

  if (!subscription || subscription.is_active !== true) {
    return false;
  }

  if (subscription.status === 'trialing') {
    return false;
  }

  return true;
}

export function SubscriptionSection({
  userId,
  trialEndsAt,
  subscription,
}: SubscriptionSectionProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showWithdrawalSheet, setShowWithdrawalSheet] = useState(false);
  const { isInTrial, daysLeft: trialDaysLeft } = useTrialStatus(userId);
  const { isPremiumEntitlementActive, entitlementExpirationDate } =
    useRevenueCatPremiumEntitlement();

  const uiMode = resolveSubscriptionUiMode({
    isInTrial,
    subscription,
    isPremiumEntitlementActive,
  });

  const showPaidContractActions = hasPaidAppleSubscription(
    subscription,
    isPremiumEntitlementActive,
  );
  const { data: activeWithdrawal } = useWithdrawalStatus(userId, showPaidContractActions);

  const renewalSource =
    subscription?.current_period_end ?? entitlementExpirationDate ?? null;
  const renewalDate =
    renewalSource != null
      ? formatSubscriptionStatusDate(renewalSource, i18n.language)
      : null;

  const withdrawalSubmittedDate =
    activeWithdrawal?.submitted_at != null
      ? formatSubscriptionStatusDate(activeWithdrawal.submitted_at, i18n.language)
      : null;

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

  function renderWithdrawalSection() {
    if (activeWithdrawal && withdrawalSubmittedDate) {
      return (
        <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3`}>
          <Text className="text-sm leading-5 text-gray-600">
            {t('settings.withdrawal.alreadySubmitted', { date: withdrawalSubmittedDate })}
          </Text>
        </View>
      );
    }

    return (
      <View className={`border-t ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3`}>
        <Pressable
          className="min-h-11 items-center justify-center rounded-xl border border-white/70 py-2"
          onPress={() => setShowWithdrawalSheet(true)}>
          <Text className="text-base font-semibold text-gray-900">
            {t('settings.subscription.withdraw')}
          </Text>
        </Pressable>
        <Text className="mt-2 text-xs leading-5 text-gray-500">
          {t('settings.subscription.withdrawHint')}
        </Text>
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

        {renderWithdrawalSection()}
      </>
    );
  }

  return (
    <>
      <SettingsSection title={t('settings.subscription.sectionTitle')}>
        <View className="px-4 py-4">
          {renderStatus()}
        </View>

        {uiMode === 'trial' || uiMode === 'no_subscription' ? renderGetPremiumButton() : null}
        {showPaidContractActions ? renderPaidContractActions() : null}
      </SettingsSection>

      <PaywallSheet
        visible={showPaywall}
        userId={userId}
        onClose={() => setShowPaywall(false)}
      />

      {userId && session?.user?.email ? (
        <WithdrawalSheet
          visible={showWithdrawalSheet}
          userId={userId}
          userEmail={session.user.email}
          onClose={() => setShowWithdrawalSheet(false)}
          onSubmitted={() => {
            void queryClient.invalidateQueries({ queryKey: ['withdrawal-status', userId] });
          }}
        />
      ) : null}
    </>
  );
}
