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
import {
  NUMERIC_DONE_INPUT_PROPS,
  isLegacyNumericKeyboardType,
  isPartialNumericInput,
  numericInputAllowsDecimals,
  resolveNumericKeyboardType,
} from '@/lib/numeric-input';

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

export function OnboardingField({
  style,
  keyboardType,
  onChangeText,
  ...props
}: OnboardingFieldProps) {
  const resolvedKeyboardType = resolveNumericKeyboardType(keyboardType);
  const isLegacyNumeric = isLegacyNumericKeyboardType(keyboardType);

  return (
    <TextInput
      {...props}
      {...(isLegacyNumeric ? NUMERIC_DONE_INPUT_PROPS : {})}
      keyboardType={resolvedKeyboardType}
      onChangeText={(text) => {
        if (
          isLegacyNumeric &&
          !isPartialNumericInput(text, numericInputAllowsDecimals(keyboardType))
        ) {
          return;
        }

        onChangeText?.(text);
      }}
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
