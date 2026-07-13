import { useTranslation } from 'react-i18next';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from 'react-native';

/** Default ID for single-field sheets (weight, onboarding, etc.). */
export const NUMBER_INPUT_ACCESSORY_ID = 'number-input-accessory';

const NUMERIC_KEYBOARD_TYPES = new Set<TextInputProps['keyboardType']>([
  'numeric',
  'number-pad',
  'decimal-pad',
  'phone-pad',
]);

export function isNumericKeyboardType(
  keyboardType: TextInputProps['keyboardType'] | undefined,
): boolean {
  return keyboardType != null && NUMERIC_KEYBOARD_TYPES.has(keyboardType);
}

export function getNumberInputAccessoryProps(
  keyboardType?: TextInputProps['keyboardType'],
): Pick<TextInputProps, 'inputAccessoryViewID'> {
  if (Platform.OS !== 'ios' || !isNumericKeyboardType(keyboardType)) {
    return {};
  }

  return { inputAccessoryViewID: NUMBER_INPUT_ACCESSORY_ID };
}

type NumberInputAccessoryProps = {
  nativeID?: string;
};

export function NumberInputAccessory({
  nativeID = NUMBER_INPUT_ACCESSORY_ID,
}: NumberInputAccessoryProps) {
  const { t } = useTranslation();

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.accessoryBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
          hitSlop={8}
          onPress={() => Keyboard.dismiss()}>
          <Text style={styles.accessoryDone}>{t('common.done')}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  accessoryDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
