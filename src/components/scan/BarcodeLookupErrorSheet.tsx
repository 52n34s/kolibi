import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';

type BarcodeLookupErrorSheetProps = {
  visible: boolean;
  onClose: () => void;
  onRetry: () => void;
};

export function BarcodeLookupErrorSheet({
  visible,
  onClose,
  onRetry,
}: BarcodeLookupErrorSheetProps) {
  const { t } = useTranslation();

  return (
    <GlassBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('home.scan.errors.apiTitle')}</Text>
      <Text style={styles.message}>{t('home.scan.errors.apiMessage')}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.errors.retryAnalysis')}
        style={styles.buttonShell}
        onPress={onRetry}>
        <LinearGradient
          colors={['#4F46E5', '#7CE7C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}>
          <Text style={styles.buttonLabel}>{t('home.scan.errors.retryAnalysis')}</Text>
        </LinearGradient>
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
});
