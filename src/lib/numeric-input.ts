import { Keyboard, type TextInputProps } from 'react-native';

const LEGACY_NUMERIC_KEYBOARD_TYPES = new Set<TextInputProps['keyboardType']>([
  'numeric',
  'number-pad',
  'decimal-pad',
]);

export function isPartialNumericInput(text: string, allowDecimals: boolean): boolean {
  const normalized = text.replace(',', '.');
  if (normalized === '') {
    return true;
  }

  return allowDecimals ? /^[0-9]*\.?[0-9]*$/.test(normalized) : /^[0-9]*$/.test(normalized);
}

export function resolveNumericKeyboardType(
  keyboardType?: TextInputProps['keyboardType'],
): TextInputProps['keyboardType'] {
  if (keyboardType && LEGACY_NUMERIC_KEYBOARD_TYPES.has(keyboardType)) {
    return 'numbers-and-punctuation';
  }

  return keyboardType;
}

export function numericInputAllowsDecimals(
  keyboardType?: TextInputProps['keyboardType'],
): boolean {
  return keyboardType === 'decimal-pad' || keyboardType === 'numeric';
}

export function isLegacyNumericKeyboardType(
  keyboardType?: TextInputProps['keyboardType'],
): boolean {
  return keyboardType != null && LEGACY_NUMERIC_KEYBOARD_TYPES.has(keyboardType);
}

export const NUMERIC_DONE_INPUT_PROPS = {
  returnKeyType: 'done' as const,
  blurOnSubmit: true,
  onSubmitEditing: () => Keyboard.dismiss(),
};
