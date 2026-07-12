import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

type BirthDatePickerProps = {
  visible: boolean;
  value: Date;
  minimumDate: Date;
  maximumDate: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
};

export function openBirthDatePickerAndroid(
  options: Omit<BirthDatePickerProps, 'visible' | 'onClose'> & {
    onChange: (date: Date) => void;
  },
) {
  DateTimePickerAndroid.open({
    value: options.value,
    mode: 'date',
    maximumDate: options.maximumDate,
    minimumDate: options.minimumDate,
    onChange: (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (selectedDate) {
        options.onChange(selectedDate);
      }
    },
  });
}

export function BirthDatePickerModal({
  visible,
  value,
  minimumDate,
  maximumDate,
  onChange,
  onClose,
}: BirthDatePickerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (__DEV__) {
      console.log('[BirthDatePickerModal] visible changed:', visible, 'platform:', Platform.OS);
    }
  }, [visible]);

  if (Platform.OS !== 'ios') {
    return null;
  }

  function handleChange(_event: DateTimePickerEvent, selectedDate?: Date) {
    if (selectedDate) {
      onChange(selectedDate);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('onboarding.birthDate.selectDate')}</Text>
            <Pressable hitSlop={8} onPress={onClose}>
              <Text style={styles.done}>{t('onboarding.birthDate.done')}</Text>
            </Pressable>
          </View>

          <View style={styles.pickerContainer}>
            {IS_EXPO_GO ? (
              <Text style={styles.expoGoWarning}>{t('onboarding.birthDate.expoGoWarning')}</Text>
            ) : (
              <DateTimePicker
                value={value}
                mode="date"
                display="spinner"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onChange={handleChange}
                themeVariant="light"
                textColor="#111827"
                style={styles.picker}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  done: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pickerContainer: {
    height: 216,
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    height: 216,
    width: '100%',
  },
  expoGoWarning: {
    paddingVertical: 24,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#6B7280',
  },
});
