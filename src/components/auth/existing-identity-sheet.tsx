import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import type { LinkedOAuthProvider } from '@/lib/auth-errors';

type ExistingIdentitySheetProps = {
  visible: boolean;
  provider: LinkedOAuthProvider;
  mealCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ExistingIdentitySheet({
  visible,
  provider,
  mealCount,
  isSubmitting,
  onCancel,
  onConfirm,
}: ExistingIdentitySheetProps) {
  const { t } = useTranslation();
  const messageKey =
    provider === 'apple' ? 'auth.existingIdentity.messageApple' : 'auth.existingIdentity.messageGoogle';

  return (
    <GlassBottomSheet
      visible={visible}
      presentation="center"
      onClose={isSubmitting ? () => undefined : onCancel}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.existingIdentity.title')}</Text>
        <Text style={styles.message}>{t(messageKey, { count: mealCount })}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.existingIdentity.confirm')}
          disabled={isSubmitting}
          style={styles.buttonShell}
          onPress={onConfirm}>
          <LinearGradient
            colors={['#4F46E5', '#7CE7C7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonLabel}>{t('auth.existingIdentity.confirm')}</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.existingIdentity.cancel')}
          disabled={isSubmitting}
          style={styles.secondaryButton}
          onPress={onCancel}>
          <Text style={styles.secondaryButtonLabel}>{t('auth.existingIdentity.cancel')}</Text>
        </Pressable>
      </View>
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
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
