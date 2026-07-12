import { Image } from 'expo-image';
import { Href, router } from 'expo-router';
import { Pressable } from 'react-native';

type SettingsGearButtonProps = {
  accessibilityLabel: string;
};

export function SettingsGearButton({ accessibilityLabel }: SettingsGearButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
      style={{
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      }}
      onPress={() => router.push('/settings' as Href)}>
      <Image
        source={require('@/assets/images/koli-curious.png')}
        style={{ width: 28, height: 28 }}
        contentFit="contain"
      />
    </Pressable>
  );
}
