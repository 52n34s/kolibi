import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';

type ProfileHeaderProps = {
  displayName: string;
  email: string;
  avatarSignedUrl: string | null;
  isUploadingAvatar: boolean;
  onPressAvatar: () => void;
  onPressName: () => void;
};

export function ProfileHeader({
  displayName,
  email,
  avatarSignedUrl,
  isUploadingAvatar,
  onPressAvatar,
  onPressName,
}: ProfileHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-8 items-center">
      <View className="mb-4 flex-row items-center gap-3">
        {avatarSignedUrl ? (
          <View className="h-24 w-24 overflow-hidden rounded-full bg-[#EEF2FF]">
            <Image
              source={{ uri: avatarSignedUrl }}
              style={{ width: 96, height: 96 }}
              contentFit="cover"
            />
            {isUploadingAvatar ? (
              <View className="absolute inset-0 items-center justify-center bg-black/35">
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        ) : (
          <View
            className="items-center justify-center"
            style={{ width: 96, height: 96 }}>
            <Image
              source={require('@/assets/images/koli-happy.png')}
              style={{ width: 96, height: 77 }}
              contentFit="contain"
            />
            {isUploadingAvatar ? (
              <View
                className="absolute items-center justify-center bg-black/20"
                style={{ width: 96, height: 96 }}>
                <ActivityIndicator color={ONBOARDING_ACCENT} />
              </View>
            ) : null}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.profile.avatarButtonLabel')}
          disabled={isUploadingAvatar}
          onPress={onPressAvatar}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <View
            className="items-center justify-center rounded-full bg-[#4F46E5]"
            style={{
              width: 34,
              height: 34,
              shadowColor: ONBOARDING_ACCENT,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
            }}>
            <Ionicons name="camera" size={14} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-1"
        onPress={onPressName}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Text className="text-xl font-bold text-gray-900">{displayName}</Text>
        <Ionicons name="pencil" size={16} color={ONBOARDING_ACCENT} />
      </Pressable>

      <Text className="mt-1 text-sm text-gray-500">{email}</Text>
    </View>
  );
}
