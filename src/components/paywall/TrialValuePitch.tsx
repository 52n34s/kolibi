import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

const VALUE_POINTS = [
  { key: 'paywall.valuePitch.photo', icon: 'camera-outline' },
  { key: 'paywall.valuePitch.ingredients', icon: 'eye-outline' },
  { key: 'paywall.valuePitch.health', icon: 'heart-outline' },
  { key: 'paywall.valuePitch.privacy', icon: 'shield-checkmark-outline' },
] as const;

type TrialValuePitchProps = {
  onContinue: () => void;
};

export function TrialValuePitch({ onContinue }: TrialValuePitchProps) {
  const { t } = useTranslation();

  return (
    <>
      <Text className="text-center text-2xl font-bold leading-8 text-gray-900">
        {t('paywall.valuePitch.headline')}
      </Text>

      <View className="mt-6 gap-3">
        {VALUE_POINTS.map((point) => (
          <View key={point.key} className="flex-row items-start">
            <Ionicons
              name={point.icon}
              size={18}
              color="#4F46E5"
              style={{ marginTop: 2, marginRight: 10 }}
            />
            <Text className="flex-1 text-base leading-6 text-gray-700">{t(point.key)}</Text>
          </View>
        ))}
      </View>

      <View className="mt-8 flex-row items-center">
        <View style={{ flex: 7, paddingRight: 12 }}>
          <Text className="text-sm leading-5 text-gray-600">{t('paywall.valuePitch.note')}</Text>
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
            {t('paywall.valuePitch.continue')}
          </Text>
        </LinearGradient>
      </Pressable>
    </>
  );
}
