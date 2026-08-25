import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

type PurchaseSuccessPitchProps = {
  onContinue: () => void;
};

export function PurchaseSuccessPitch({ onContinue }: PurchaseSuccessPitchProps) {
  const { t } = useTranslation();

  return (
    <>
      <Text className="text-center text-3xl font-bold leading-10 text-gray-900">
        {t('paywall.purchaseSuccessTitle')}
      </Text>
      <Text className="mt-3 text-center text-lg leading-7 text-gray-600">
        {t('paywall.purchaseSuccessMessage')}
      </Text>

      <View className="mt-8 flex-row items-center">
        <View style={{ flex: 7, paddingRight: 12, justifyContent: 'center' }}>
          <Text className="text-sm leading-5 text-gray-600">
            {t('paywall.purchaseSuccessNote')}
          </Text>
        </View>
        <View style={{ flex: 3, alignItems: 'flex-end' }}>
          <Image
            source={require('@/assets/images/me-steffen.png')}
            style={{ width: '100%', height: 128 }}
            contentFit="contain"
          />
          <Text className="mt-2 text-xs font-semibold text-gray-900">
            {t('paywall.valuePitch.names')}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        className="mt-8 overflow-hidden rounded-xl"
        onPress={onContinue}>
        <LinearGradient
          colors={['#4F46E5', '#7CE7C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Text className="text-base font-semibold text-white">
            {t('paywall.purchaseSuccessContinue')}
          </Text>
        </LinearGradient>
      </Pressable>
    </>
  );
}
