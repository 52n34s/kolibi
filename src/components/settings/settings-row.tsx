import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SETTINGS_GLASS_DIVIDER_CLASS, GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';

type SettingsRowProps = {
  label: string;
  value?: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
  dimmed?: boolean;
  showChevron?: boolean;
  accessory?: ReactNode;
  isLast?: boolean;
  testID?: string;
};

export function SettingsRow({
  label,
  value,
  subtitle,
  onPress,
  destructive = false,
  dimmed = false,
  showChevron = !!onPress,
  accessory,
  isLast = false,
  testID,
}: SettingsRowProps) {
  const labelClass = destructive
    ? 'text-red-600'
    : dimmed
      ? 'text-gray-500'
      : 'text-gray-900';

  const content = (
    <View
      className={`px-4 py-3.5 ${!isLast ? `border-b ${SETTINGS_GLASS_DIVIDER_CLASS}` : ''}`}>
      <View className="flex-row items-center">
        <Text className={`flex-1 text-base ${labelClass}`}>{label}</Text>
        {value ? <Text className="mr-2 text-sm text-gray-500">{value}</Text> : null}
        {accessory}
        {showChevron && onPress ? (
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        ) : null}
      </View>
      {subtitle ? (
        <Text className="mt-1 pr-6 text-sm text-gray-500">{subtitle}</Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? GLASS_SURFACE_PRESSED.backgroundColor : 'transparent',
      })}>
      {content}
    </Pressable>
  );
}
