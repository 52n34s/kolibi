import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { requestPasswordReset } from '@/lib/auth';
import { logAuthError } from '@/lib/auth-errors';

type ForgotPasswordFormValues = {
  email: string;
};

const AUTH_INPUT_STYLE = getGlassCardStyle({
  borderRadius: 12,
  height: 48,
  paddingHorizontal: 16,
  justifyContent: 'center',
});

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: { email: '' },
  });

  async function onSubmit({ email }: ForgotPasswordFormValues) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setEmailSent(true);
    } catch (error) {
      logAuthError('PasswordResetRequest', error);
      setErrorMessage(t('auth.forgotPassword.errors.requestFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthMeshLayout>
      <View className="flex-1 justify-center px-6">
        <Text className="mb-2 text-center text-2xl font-semibold text-gray-900">
          {t('auth.forgotPassword.title')}
        </Text>
        <Text className="mb-8 text-center text-base text-gray-500">
          {emailSent ? t('auth.forgotPassword.successMessage') : t('auth.forgotPassword.subtitle')}
        </Text>

        {!emailSent ? (
          <>
            <Controller
              control={control}
              name="email"
              rules={{
                required: t('auth.errors.emailRequired'),
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t('auth.errors.emailInvalid'),
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  className="mb-2 text-base text-gray-900"
                  style={AUTH_INPUT_STYLE}
                  keyboardType="email-address"
                  placeholder={t('auth.email')}
                  placeholderTextColor="#9CA3AF"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.email ? (
              <Text className="mb-2 text-sm text-red-500">{errors.email.message}</Text>
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
                    {t('auth.forgotPassword.submit')}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </>
        ) : null}

        <Pressable
          className="mt-4 items-center py-2"
          disabled={isSubmitting}
          onPress={() => router.back()}>
          <Text className="text-center text-sm text-gray-500">
            {emailSent ? t('auth.forgotPassword.backToSignIn') : t('auth.forgotPassword.cancel')}
          </Text>
        </Pressable>
      </View>
    </AuthMeshLayout>
  );
}
