import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type SettingsRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  accessory?: ReactNode;
  isLast?: boolean;
};

export function SettingsRow({
  label,
  value,
  onPress,
  destructive = false,
  showChevron = !!onPress,
  accessory,
  isLast = false,
}: SettingsRowProps) {
  const content = (
    <View
      className={`flex-row items-center px-4 py-3.5 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <Text
        className={`flex-1 text-base ${destructive ? 'text-red-600' : 'text-gray-900'}`}>
        {label}
      </Text>
      {value ? <Text className="mr-2 text-sm text-gray-500">{value}</Text> : null}
      {accessory}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}
