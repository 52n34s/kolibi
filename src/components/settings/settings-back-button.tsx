import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Pressable } from 'react-native';

type SettingsBackButtonProps = {
  label: string;
  href?: Href;
};

export function SettingsBackButton({ label, href }: SettingsBackButtonProps) {
  function handlePress() {
    if (href) {
      router.replace(href);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/home' as Href);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center py-1 pr-2"
      hitSlop={8}
      onPress={handlePress}>
      <Ionicons name="chevron-back" size={22} color="#4F46E5" />
    </Pressable>
  );
}
