import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';

type ScanParseErrorSheetProps = {
  visible: boolean;
  onClose: () => void;
  onScanAgain: () => void;
  onManualEntry: () => void;
};

export function ScanParseErrorSheet({
  visible,
  onClose,
  onScanAgain,
  onManualEntry,
}: ScanParseErrorSheetProps) {
  const { t } = useTranslation();

  return (
    <GlassBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('home.scan.errors.parseTitle')}</Text>
      <Text style={styles.message}>{t('home.scan.errors.parseMessage')}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.errors.scanAgain')}
        style={styles.buttonShell}
        onPress={onScanAgain}>
        <LinearGradient
          colors={['#4F46E5', '#7CE7C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}>
          <Text style={styles.buttonLabel}>{t('home.scan.errors.scanAgain')}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.errors.manualEntry')}
        style={styles.secondaryButton}
        onPress={onManualEntry}>
        <Text style={styles.secondaryButtonLabel}>{t('home.scan.errors.manualEntry')}</Text>
      </Pressable>
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  message: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },
  buttonShell: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  buttonGradient: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
