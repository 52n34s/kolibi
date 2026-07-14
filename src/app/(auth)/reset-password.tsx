import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AuthMeshLayout } from '@/components/auth/auth-mesh-layout';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { updatePassword, navigateAfterLogin } from '@/lib/auth';
import { logAuthError } from '@/lib/auth-errors';
import { markPasswordRecoveryFlow } from '@/lib/auth-redirect';
import { useAuthStore } from '@/stores/auth-store';

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

const AUTH_INPUT_STYLE = getGlassCardStyle({
  borderRadius: 12,
  height: 48,
  paddingHorizontal: 16,
  justifyContent: 'center',
});

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { linkError } = useLocalSearchParams<{ linkError?: string }>();
  const session = useAuthStore((state) => state.session);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = watch('password');
  const hasExpiredLink = linkError === 'expired';
  const hasRecoverySession = session != null;

  useEffect(() => {
    if (hasExpiredLink || hasRecoverySession) {
      return;
    }

    setErrorMessage(t('auth.resetPassword.errors.sessionMissing'));
  }, [hasExpiredLink, hasRecoverySession, t]);

  async function onSubmit({ password }: ResetPasswordFormValues) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await updatePassword(password);
      markPasswordRecoveryFlow(false);
      await navigateAfterLogin();
    } catch (error) {
      logAuthError('PasswordResetUpdate', error);
      setErrorMessage(t('auth.resetPassword.errors.updateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthMeshLayout>
      <View className="flex-1 justify-center px-6">
        <Text className="mb-2 text-center text-2xl font-semibold text-gray-900">
          {t('auth.resetPassword.title')}
        </Text>
        <Text className="mb-8 text-center text-base text-gray-500">
          {t('auth.resetPassword.subtitle')}
        </Text>

        {hasExpiredLink ? (
          <Text className="mb-4 text-center text-sm text-red-500">
            {t('auth.resetPassword.errors.linkExpired')}
          </Text>
        ) : null}

        {!hasExpiredLink && hasRecoverySession ? (
          <>
            <Controller
              control={control}
              name="password"
              rules={{
                required: t('auth.errors.passwordRequired'),
                minLength: { value: 6, message: t('auth.errors.passwordMinLength') },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  className="mb-2 text-base text-gray-900"
                  style={AUTH_INPUT_STYLE}
                  placeholder={t('auth.resetPassword.newPassword')}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.password ? (
              <Text className="mb-2 text-sm text-red-500">{errors.password.message}</Text>
            ) : null}

            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: t('auth.errors.passwordRequired'),
                validate: (value) =>
                  value === passwordValue || t('auth.resetPassword.errors.passwordMismatch'),
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  className="mb-2 text-base text-gray-900"
                  style={AUTH_INPUT_STYLE}
                  placeholder={t('auth.resetPassword.confirmPassword')}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.confirmPassword ? (
              <Text className="mb-2 text-sm text-red-500">{errors.confirmPassword.message}</Text>
            ) : null}

            {errorMessage ? (
              <Text className="mb-4 text-center text-sm text-red-500">{errorMessage}</Text>
            ) : null}

            <Pressable
              className="overflow-hidden rounded-xl"
              disabled={isSubmitting}
              onPress={handleSubmit(onSubmit)}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {t('auth.resetPassword.submit')}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </>
        ) : !hasExpiredLink ? (
          <Text className="mb-4 text-center text-sm text-red-500">{errorMessage}</Text>
        ) : null}

        <Pressable
          className="mt-4 items-center py-2"
          disabled={isSubmitting}
          onPress={() =>
            router.replace(hasExpiredLink ? '/(auth)/forgot-password' : '/(auth)/login')
          }>
          <Text className="text-center text-sm text-gray-500">
            {hasExpiredLink
              ? t('auth.resetPassword.requestNewLink')
              : t('auth.resetPassword.backToSignIn')}
          </Text>
        </Pressable>
      </View>
    </AuthMeshLayout>
  );
}
