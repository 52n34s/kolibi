import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { ExternalLink } from '@/components/external-link';
import { OnboardingMeshBackground } from '@/components/onboarding/onboarding-background';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { LEGAL_LINKS } from '@/lib/legal-links';
import {
  getDefaultMonthlyPackage,
  purchasePremiumPackage,
  restorePremiumPurchases,
} from '@/lib/purchases';
import { fetchHasPremiumAccess } from '@/lib/subscription';

type PaywallSheetProps = {
  visible: boolean;
  userId: string | undefined;
  onClose: () => void;
};

export function PaywallSheet({ visible, userId, onClose }: PaywallSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [isLoadingOffering, setIsLoadingOffering] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!visible) {
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

  async function handlePurchaseSuccess() {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: ['has-premium-access', userId] });
      await queryClient.invalidateQueries({ queryKey: ['trial-status', userId] });
    }

    onClose();
    Alert.alert(t('paywall.purchaseSuccessTitle'), t('paywall.purchaseSuccessMessage'));
  }

  async function handlePurchase() {
    if (!monthlyPackage) {
      Alert.alert(t('settings.errors.title'), t('paywall.priceUnavailable'));
      return;
    }

    setIsPurchasing(true);
    try {
      await purchasePremiumPackage(monthlyPackage);
      await handlePurchaseSuccess();
    } catch (error) {
      const userCancelled =
        error &&
        typeof error === 'object' &&
        'userCancelled' in error &&
        (error as { userCancelled?: boolean }).userCancelled;

      if (!userCancelled) {
        console.error('[Paywall] purchase failed:', error);
        Alert.alert(t('settings.errors.title'), t('paywall.purchaseError'));
      }
    } finally {
      setIsPurchasing(false);
    }
  }

  async function handleRestore() {
    setIsRestoring(true);
    try {
      await restorePremiumPurchases();

      if (userId) {
        await queryClient.invalidateQueries({ queryKey: ['has-premium-access', userId] });
        await queryClient.invalidateQueries({ queryKey: ['trial-status', userId] });
      }

      const hasAccess = userId ? await fetchHasPremiumAccess(userId) : false;

      if (hasAccess) {
        onClose();
        Alert.alert(t('paywall.restoreSuccessTitle'), t('paywall.restoreSuccessMessage'));
      } else {
        Alert.alert(t('settings.errors.title'), t('paywall.restoreEmpty'));
      }
    } catch (error) {
      console.error('[Paywall] restore failed:', error);
      Alert.alert(t('settings.errors.title'), t('paywall.restoreError'));
    } finally {
      setIsRestoring(false);
    }
  }

  const priceLabel = monthlyPackage?.product.priceString ?? t('paywall.priceFallback');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1">
        <OnboardingMeshBackground />
        <SafeAreaView className="flex-1">
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
            showsVerticalScrollIndicator={false}>
            <Pressable className="mb-4 self-end px-2 py-1" onPress={onClose}>
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
              <Text className="text-center text-2xl font-bold text-gray-900">
                {t('paywall.title')}
              </Text>
              <Text className="mt-3 text-center text-base leading-6 text-gray-600">
                {t('paywall.description')}
              </Text>

              <View className="mt-6 items-center">
                {isLoadingOffering ? (
                  <ActivityIndicator color={ONBOARDING_ACCENT} />
                ) : (
                  <Text className="text-3xl font-bold text-[#4F46E5]">{priceLabel}</Text>
                )}
              </View>

              <Text className="mt-4 text-center text-xs leading-5 text-gray-500">
                {t('paywall.autoRenew')}
              </Text>

              <Pressable
                className="mt-6 h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
                disabled={isPurchasing || isRestoring || isLoadingOffering}
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
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
