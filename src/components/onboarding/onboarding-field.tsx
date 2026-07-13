import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  TextInputProps,
  ViewStyle,
} from 'react-native';

import { getOnboardingIdleCardStyle } from './onboarding-styles';
import { getNumberInputAccessoryProps } from '@/components/ui/keyboard-accessory';

const FIELD_HEIGHT = 48;

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  fieldBody: {
    height: FIELD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  input: {
    height: FIELD_HEIGHT,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
});

type OnboardingFieldProps = TextInputProps;

export function OnboardingField({ style, keyboardType, ...props }: OnboardingFieldProps) {
  return (
    <TextInput
      {...props}
      keyboardType={keyboardType}
      {...getNumberInputAccessoryProps(keyboardType)}
      placeholderTextColor="#9CA3AF"
      style={[getOnboardingIdleCardStyle(), styles.input, style]}
    />
  );
}

type OnboardingFieldPressableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function OnboardingFieldPressable({
  children,
  style,
  onPress,
  ...rest
}: OnboardingFieldPressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.85 }]}>
      <View style={[getOnboardingIdleCardStyle(), styles.fieldBody, style]}>{children}</View>
    </Pressable>
  );
}
