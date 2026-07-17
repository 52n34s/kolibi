import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { GLASS_SURFACE } from '@/components/ui/glass-styles';
import { insertWithdrawal } from '@/lib/withdrawal';

type WithdrawalPhase = 'info' | 'submitting' | 'success' | 'error';

type WithdrawalSheetProps = {
  visible: boolean;
  userId: string;
  userEmail: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

function formatWithdrawalTimestamp(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function WithdrawalSheet({
  visible,
  userId,
  userEmail,
  onClose,
  onSubmitted,
}: WithdrawalSheetProps) {
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = useState<WithdrawalPhase>('info');
  const [note, setNote] = useState('');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPhase('info');
      setNote('');
      setSubmittedAt(null);
      setErrorMessage(null);
    }
  }, [visible]);

  async function handleSubmit() {
    setPhase('submitting');
    setErrorMessage(null);

    try {
      const result = await insertWithdrawal({
        userId,
        userEmail,
        note,
      });
      setSubmittedAt(result.submitted_at);
      setPhase('success');
      onSubmitted?.();
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('[WithdrawalSheet] insertWithdrawal failed:', {
          message: (error as { message?: string }).message,
          code: (error as { code?: string }).code,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        });
      } else {
        console.error('[WithdrawalSheet] insertWithdrawal failed:', error);
      }

      setErrorMessage(t('settings.withdrawal.errorMessage'));
      setPhase('error');
    }
  }

  const isBusy = phase === 'submitting';

  function renderContent() {
    switch (phase) {
      case 'info':
        return (
          <>
            <Text style={styles.title}>{t('settings.withdrawal.title')}</Text>
            <Text style={styles.body}>{t('settings.withdrawal.legalNotice')}</Text>
            <Text style={styles.body}>{t('settings.withdrawal.appleRefundNotice')}</Text>

            <Text style={styles.noteLabel}>{t('settings.withdrawal.noteLabel')}</Text>
            <TextInput
              multiline
              placeholder={t('settings.withdrawal.notePlaceholder')}
              placeholderTextColor="#9CA3AF"
              style={styles.noteInput}
              textAlignVertical="top"
              value={note}
              onChangeText={setNote}
            />

            <Pressable
              accessibilityRole="button"
              style={styles.primaryButtonShell}
              onPress={() => void handleSubmit()}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}>
                <Text style={styles.primaryButtonLabel}>{t('settings.withdrawal.submit')}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonLabel}>{t('settings.withdrawal.cancel')}</Text>
            </Pressable>
          </>
        );

      case 'submitting':
        return (
          <View style={styles.centeredState}>
            <ActivityIndicator color="#4F46E5" size="large" />
            <Text style={styles.body}>{t('settings.withdrawal.submitting')}</Text>
          </View>
        );

      case 'success':
        return (
          <>
            <Text style={styles.title}>{t('settings.withdrawal.successTitle')}</Text>
            {submittedAt ? (
              <Text style={styles.receivedAt}>
                {t('settings.withdrawal.receivedAt', {
                  datetime: formatWithdrawalTimestamp(submittedAt, i18n.language),
                })}
              </Text>
            ) : null}
            <Text style={styles.body}>{t('settings.withdrawal.emailConfirmation')}</Text>

            <Pressable accessibilityRole="button" style={styles.primaryButtonShell} onPress={onClose}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}>
                <Text style={styles.primaryButtonLabel}>{t('settings.withdrawal.close')}</Text>
              </LinearGradient>
            </Pressable>
          </>
        );

      case 'error':
        return (
          <>
            <Text style={styles.title}>{t('settings.withdrawal.title')}</Text>
            <Text style={styles.errorText}>
              {errorMessage ?? t('settings.withdrawal.errorMessage')}
            </Text>

            <Pressable
              accessibilityRole="button"
              style={styles.primaryButtonShell}
              onPress={() => void handleSubmit()}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}>
                <Text style={styles.primaryButtonLabel}>{t('settings.withdrawal.retry')}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonLabel}>{t('settings.withdrawal.cancel')}</Text>
            </Pressable>
          </>
        );
    }
  }

  return (
    <GlassBottomSheet
      visible={visible}
      presentation="center"
      maxHeightRatio={0.88}
      onClose={isBusy ? () => undefined : onClose}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  body: {
    marginBottom: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },
  receivedAt: {
    marginBottom: 12,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  noteLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  noteInput: {
    minHeight: 88,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: GLASS_SURFACE.borderWidth,
    fontSize: 15,
    color: '#111827',
  },
  primaryButtonShell: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  errorText: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: '#DC2626',
    textAlign: 'center',
  },
});
