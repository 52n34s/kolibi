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
  ensurePurchasesIdentified,
  getDefaultOfferingPlans,
  purchasePremiumPackage,
  restorePremiumPurchases,
  type DefaultOfferingPlan,
} from '@/lib/purchases';
import { refreshRevenueCatCustomerInfo } from '@/lib/revenuecat-customer-info';

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

function formatProductCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

function savingsPercentAgainstMonthly(
  planPrice: number,
  monthsCount: number,
  monthlyPrice: number,
): number | null {
  if (monthsCount <= 1 || monthlyPrice <= 0 || planPrice <= 0) {
    return null;
  }

  const fullPrice = monthlyPrice * monthsCount;
  const percent = Math.round((1 - planPrice / fullPrice) * 100);
  return percent > 0 ? percent : null;
}

function planLabelKey(plan: DefaultOfferingPlan): string {
  if (plan.monthsCount === 3) {
    return 'paywall.planQuarterly';
  }

  if (plan.monthsCount === 12) {
    return 'paywall.planAnnual';
  }

  return 'paywall.planMonthly';
}

function autoRenewKey(plan: DefaultOfferingPlan): string {
  if (plan.monthsCount === 3) {
    return 'paywall.autoRenewQuarterly';
  }

  if (plan.monthsCount === 12) {
    return 'paywall.autoRenewAnnual';
  }

  return 'paywall.autoRenewMonthly';
}

function defaultSelectedPlanId(plans: DefaultOfferingPlan[]): string | null {
  const annual = plans.find((plan) => plan.monthsCount === 12);
  const chosen = annual ?? plans[0];
  return chosen?.pkg.identifier ?? null;
}

export function PaywallSheet({ visible, userId, onClose, onDismissed }: PaywallSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const purchaseAbortRef = useRef<AbortController | null>(null);
  const [plans, setPlans] = useState<DefaultOfferingPlan[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [isLoadingOffering, setIsLoadingOffering] = useState(false);
  const [purchaseFlowPhase, setPurchaseFlowPhase] = useState<PurchaseFlowPhase>('idle');
  const [isRestoring, setIsRestoring] = useState(false);
  const [completion, setCompletion] = useState<PaywallCompletion | null>(null);

  const isPurchasing = purchaseFlowPhase === 'purchasing';
  const isPurchaseFlowBusy = purchaseFlowPhase !== 'idle';
  const showCompletion = completion != null;
  const selectedPlan = plans.find((plan) => plan.pkg.identifier === selectedPackageId) ?? null;
  const selectedPackage = selectedPlan?.pkg ?? null;
  const monthlyPlan = plans.find((plan) => plan.monthsCount === 1) ?? null;
  const monthlyPrice = monthlyPlan?.pkg.product.price ?? null;
  const canSelectPlan = plans.length > 1;

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
    setPlans([]);
    setSelectedPackageId(null);
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
        // Never fetch offerings / purchase on $RCAnonymousID — wait for Supabase user logIn.
        if (userId) {
          await ensurePurchasesIdentified(userId);
        }

        if (cancelled) {
          return;
        }

        const nextPlans = await getDefaultOfferingPlans();
        if (!cancelled) {
          setPlans(nextPlans);
          setSelectedPackageId(defaultSelectedPlanId(nextPlans));
        }
      } catch (error) {
        console.error('[Paywall] identify/offerings failed:', error);
        if (!cancelled) {
          setPlans([]);
          setSelectedPackageId(null);
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
  }, [visible, userId]);

  useEffect(() => {
    return () => {
      abortPurchaseFlow();
    };
  }, []);

  async function refreshPremiumAccessAfterCustomerInfoUpdate(userId: string | undefined) {
    // Refresh entitlement store first so home gate / subscription card see premium immediately.
    await refreshRevenueCatCustomerInfo();

    if (!userId) {
      return;
    }

    await invalidatePremiumAccessQueries(queryClient, userId);
    await queryClient.invalidateQueries({ queryKey: ['has-premium-access', userId] });
  }

  async function handlePurchase() {
    if (!selectedPackage) {
      Alert.alert(t('settings.errors.title'), t('paywall.priceUnavailable'));
      return;
    }

    if (!userId) {
      Alert.alert(t('settings.errors.title'), t('paywall.purchaseError'));
      return;
    }

    const signal = beginPurchaseFlowSignal();
    setPurchaseFlowPhase('purchasing');

    try {
      await ensurePurchasesIdentified(userId);
      if (signal.aborted) {
        return;
      }

      await purchasePremiumPackage(selectedPackage);

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
    if (!userId) {
      Alert.alert(t('settings.errors.title'), t('paywall.restoreError'));
      return;
    }

    const signal = beginPurchaseFlowSignal();
    setIsRestoring(true);

    try {
      await ensurePurchasesIdentified(userId);
      if (signal.aborted) {
        return;
      }

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

                  <View className="mt-6 flex-row items-end justify-center gap-2">
                    {isLoadingOffering ? (
                      <>
                        <View style={[styles.planSkeleton, styles.planSkeletonFlank]} />
                        <View style={[styles.planSkeleton, styles.planSkeletonFeatured]} />
                        <View style={[styles.planSkeleton, styles.planSkeletonFlank]} />
                      </>
                    ) : plans.length === 0 ? (
                      <View style={styles.priceSkeleton} />
                    ) : (
                      plans.map((plan) => {
                        const isSelected = selectedPackageId === plan.pkg.identifier;
                        const isFeatured = plan.monthsCount === 12;
                        const perMonthLabel = formatProductCurrency(
                          plan.pkg.product.price / plan.monthsCount,
                          plan.pkg.product.currencyCode,
                        );
                        const savePercent =
                          monthlyPrice == null
                            ? null
                            : savingsPercentAgainstMonthly(
                                plan.pkg.product.price,
                                plan.monthsCount,
                                monthlyPrice,
                              );

                        return (
                          <Pressable
                            key={plan.pkg.identifier}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={t(planLabelKey(plan))}
                            className="min-w-0"
                            style={[
                              getGlassCardStyle({
                                flex: isFeatured ? 1.22 : 1,
                                paddingHorizontal: 8,
                                paddingTop: isFeatured ? 16 : 12,
                                paddingBottom: isFeatured ? 16 : 12,
                                borderRadius: 14,
                                borderWidth: isFeatured || isSelected ? 2 : 1,
                                borderColor: isFeatured
                                  ? '#4F46E5'
                                  : isSelected
                                    ? 'rgba(79, 70, 229, 0.45)'
                                    : undefined,
                                backgroundColor: isSelected
                                  ? 'rgba(79, 70, 229, 0.12)'
                                  : undefined,
                              }),
                            ]}
                            disabled={isPurchasing || isRestoring || !canSelectPlan}
                            onPress={() => setSelectedPackageId(plan.pkg.identifier)}>
                            {isFeatured ? (
                              <Text className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#4F46E5]">
                                {t('paywall.bestValue')}
                              </Text>
                            ) : (
                              <View style={styles.bestValueSpacer} />
                            )}
                            {savePercent != null ? (
                              <View
                                style={
                                  isFeatured ? styles.saveBadgeFeatured : styles.saveBadgeQuiet
                                }>
                                <Text
                                  className={`font-semibold ${
                                    isFeatured
                                      ? 'text-xs text-[#2C2C2A]'
                                      : 'text-[10px] text-gray-600'
                                  }`}>
                                  {t('paywall.savePercent', { percent: savePercent })}
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.saveBadgeSpacer} />
                            )}
                            <Text
                              className={`text-center font-semibold text-gray-700 ${
                                isFeatured ? 'text-sm' : 'text-xs'
                              }`}
                              numberOfLines={1}>
                              {t(planLabelKey(plan))}
                            </Text>
                            <Text
                              className={`mt-1 text-center font-bold text-gray-900 ${
                                isFeatured ? 'text-xl' : 'text-base'
                              }`}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}>
                              {plan.pkg.product.priceString}
                            </Text>
                            <Text
                              className="mt-1 text-center text-[11px] text-gray-500"
                              numberOfLines={1}>
                              {t('paywall.perMonth', { price: perMonthLabel })}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>

                  <Text className="mt-4 text-center text-xs leading-5 text-gray-500">
                    {selectedPlan ? t(autoRenewKey(selectedPlan)) : t('paywall.autoRenew')}
                  </Text>

                  <Pressable
                    className="mt-6 h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
                    disabled={
                      isPurchasing || isRestoring || isLoadingOffering || !selectedPackage
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
  planSkeleton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(156, 163, 175, 0.35)',
  },
  planSkeletonFlank: {
    height: 112,
  },
  planSkeletonFeatured: {
    flex: 1.22,
    height: 156,
  },
  bestValueSpacer: {
    height: 16,
    marginBottom: 4,
  },
  saveBadgeQuiet: {
    alignSelf: 'center',
    marginBottom: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 231, 199, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveBadgeFeatured: {
    alignSelf: 'center',
    marginBottom: 8,
    borderRadius: 999,
    backgroundColor: '#7CE7C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  saveBadgeSpacer: {
    height: 22,
    marginBottom: 6,
  },
});
