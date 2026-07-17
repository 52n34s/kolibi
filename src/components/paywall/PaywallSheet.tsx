import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { ExternalLink } from '@/components/external-link';
import { OnboardingMeshBackground } from '@/components/onboarding/onboarding-background';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { LEGAL_LINKS } from '@/lib/legal-links';
import {
  invalidatePremiumAccessQueries,
} from '@/lib/premium-query-sync';
import {
  getDefaultMonthlyPackage,
  purchasePremiumPackage,
  restorePremiumPurchases,
} from '@/lib/purchases';

type PurchaseFlowPhase = 'idle' | 'purchasing';

type PaywallCompletion =
  | { kind: 'purchase-success' }
  | { kind: 'purchase-pending' }
  | { kind: 'restore-success' }
  | { kind: 'restore-empty' };

type PaywallSheetProps = {
  visible: boolean;
  userId: string | undefined;
  onClose: () => void;
  onDismissed?: () => void;
};

export function PaywallSheet({ visible, userId, onClose, onDismissed }: PaywallSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const purchaseAbortRef = useRef<AbortController | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [isLoadingOffering, setIsLoadingOffering] = useState(false);
  const [purchaseFlowPhase, setPurchaseFlowPhase] = useState<PurchaseFlowPhase>('idle');
  const [isRestoring, setIsRestoring] = useState(false);
  const [completion, setCompletion] = useState<PaywallCompletion | null>(null);

  const isPurchasing = purchaseFlowPhase === 'purchasing';
  const isPurchaseFlowBusy = purchaseFlowPhase !== 'idle';
  const showCompletion = completion != null;

  function beginPurchaseFlowSignal(): AbortSignal {
    purchaseAbortRef.current?.abort();
    const controller = new AbortController();
    purchaseAbortRef.current = controller;
    return controller.signal;
  }

  function abortPurchaseFlow() {
    purchaseAbortRef.current?.abort();
    purchaseAbortRef.current = null;
  }

  function resetPaywallState() {
    abortPurchaseFlow();
    setPurchaseFlowPhase('idle');
    setIsRestoring(false);
    setCompletion(null);
  }

  useEffect(() => {
    if (!visible) {
      resetPaywallState();
      return;
    }

    let cancelled = false;

    async function loadOffering() {
      setIsLoadingOffering(true);
      try {
        const pkg = await getDefaultMonthlyPackage();
        if (!cancelled) {
          setMonthlyPackage(pkg);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOffering(false);
        }
      }
    }

    void loadOffering();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    return () => {
      abortPurchaseFlow();
    };
  }, []);

  async function refreshPremiumAccessAfterCustomerInfoUpdate(userId: string | undefined) {
    if (!userId) {
      return;
    }

    await invalidatePremiumAccessQueries(queryClient, userId);
  }

  async function handlePurchase() {
    if (!monthlyPackage) {
      Alert.alert(t('settings.errors.title'), t('paywall.priceUnavailable'));
      return;
    }

    const signal = beginPurchaseFlowSignal();
    setPurchaseFlowPhase('purchasing');

    try {
      await purchasePremiumPackage(monthlyPackage);

      if (signal.aborted) {
        return;
      }

      await refreshPremiumAccessAfterCustomerInfoUpdate(userId);
      if (signal.aborted) {
        return;
      }

      setPurchaseFlowPhase('idle');
      setCompletion({ kind: 'purchase-success' });
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      const userCancelled =
        error &&
        typeof error === 'object' &&
        'userCancelled' in error &&
        (error as { userCancelled?: boolean }).userCancelled;

      if (!userCancelled) {
        console.error('[Paywall] purchase failed:', error);
        Alert.alert(t('settings.errors.title'), t('paywall.purchaseError'));
      }

      setPurchaseFlowPhase('idle');
    }
  }

  async function handleRestore() {
    const signal = beginPurchaseFlowSignal();
    setIsRestoring(true);

    try {
      const customerInfo = await restorePremiumPurchases();

      if (signal.aborted) {
        return;
      }

      await refreshPremiumAccessAfterCustomerInfoUpdate(userId);
      if (signal.aborted) {
        return;
      }

      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      setCompletion({ kind: hasActiveEntitlement ? 'restore-success' : 'restore-empty' });
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      console.error('[Paywall] restore failed:', error);
      Alert.alert(t('settings.errors.title'), t('paywall.restoreError'));
    } finally {
      if (!signal.aborted) {
        setIsRestoring(false);
      }
    }
  }

  function renderCompletionContent() {
    if (!completion) {
      return null;
    }

    switch (completion.kind) {
      case 'purchase-success':
        return (
          <>
            <Text className="text-center text-2xl font-bold text-gray-900">
              {t('paywall.purchaseSuccessTitle')}
            </Text>
            <Text className="mt-3 text-center text-base leading-6 text-gray-600">
              {t('paywall.purchaseSuccessMessage')}
            </Text>
          </>
        );
      case 'purchase-pending':
        return (
          <>
            <Text className="text-center text-2xl font-bold text-gray-900">
              {t('paywall.purchasePendingActivationTitle')}
            </Text>
            <Text className="mt-3 text-center text-base leading-6 text-gray-600">
              {t('paywall.purchasePendingActivationMessage')}
            </Text>
          </>
        );
      case 'restore-success':
        return (
          <>
            <Text className="text-center text-2xl font-bold text-gray-900">
              {t('paywall.restoreSuccessTitle')}
            </Text>
            <Text className="mt-3 text-center text-base leading-6 text-gray-600">
              {t('paywall.restoreSuccessMessage')}
            </Text>
          </>
        );
      case 'restore-empty':
        return (
          <>
            <Text className="text-center text-2xl font-bold text-gray-900">
              {t('settings.errors.title')}
            </Text>
            <Text className="mt-3 text-center text-base leading-6 text-gray-600">
              {t('paywall.restoreEmpty')}
            </Text>
          </>
        );
    }
  }

  const priceString = monthlyPackage?.product.priceString;
  const showPriceSkeleton = isLoadingOffering || !priceString;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={isPurchaseFlowBusy ? undefined : onClose}
      onDismiss={onDismissed}>
      <View className="flex-1">
        <OnboardingMeshBackground />
        <View className="flex-1" style={{ paddingTop: insets.top }}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 40), paddingTop: 16 }}
            showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('paywall.dismiss')}
              className="mb-4 min-h-11 min-w-11 items-center justify-center self-end"
              disabled={isPurchaseFlowBusy}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={onClose}>
              <Text className="text-base text-gray-500">{t('paywall.dismiss')}</Text>
            </Pressable>

            <View className="items-center">
              <Image
                source={require('@/assets/images/koli-confident.png')}
                style={{ width: 160, height: 160 }}
                contentFit="contain"
              />
            </View>

            <View className="mt-4" style={getGlassCardStyle({ padding: 24 })}>
              {showCompletion ? (
                <>
                  {renderCompletionContent()}
                  <Pressable
                    accessibilityRole="button"
                    className="mt-8 overflow-hidden rounded-xl"
                    onPress={onClose}>
                    <LinearGradient
                      colors={['#4F46E5', '#7CE7C7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                      <Text className="text-base font-semibold text-white">
                        {t('paywall.close')}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text className="text-center text-2xl font-bold text-gray-900">
                    {t('paywall.title')}
                  </Text>
                  <Text className="mt-3 text-center text-base leading-6 text-gray-600">
                    {t('paywall.description')}
                  </Text>

                  <View className="mt-6 items-center">
                    {showPriceSkeleton ? (
                      <View style={styles.priceSkeleton} />
                    ) : (
                      <Text className="text-3xl font-bold text-[#4F46E5]">{priceString}</Text>
                    )}
                  </View>

                  <Text className="mt-4 text-center text-xs leading-5 text-gray-500">
                    {t('paywall.autoRenew')}
                  </Text>

                  <Pressable
                    className="mt-6 h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
                    disabled={
                      isPurchasing || isRestoring || isLoadingOffering || !monthlyPackage
                    }
                    onPress={() => void handlePurchase()}>
                    {isPurchasing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-base font-semibold text-white">
                        {t('paywall.subscribe')}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    className="mt-4 items-center py-2"
                    disabled={isPurchasing || isRestoring}
                    onPress={() => void handleRestore()}>
                    {isRestoring ? (
                      <ActivityIndicator color={ONBOARDING_ACCENT} />
                    ) : (
                      <Text className="text-base font-medium text-[#4F46E5]">
                        {t('paywall.restore')}
                      </Text>
                    )}
                  </Pressable>

                  <View className="mt-6 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    <ExternalLink href={LEGAL_LINKS.privacyPolicy}>
                      <Text className="text-sm text-[#4F46E5]">{t('paywall.privacy')}</Text>
                    </ExternalLink>
                    <ExternalLink href={LEGAL_LINKS.termsOfService}>
                      <Text className="text-sm text-[#4F46E5]">{t('paywall.terms')}</Text>
                    </ExternalLink>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  priceSkeleton: {
    width: 128,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(156, 163, 175, 0.35)',
  },
});
