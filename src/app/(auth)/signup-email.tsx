import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  GradientScreenWrapper,
  useGradientScreenInsets,
} from '@/components/shared/GradientScreenWrapper';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { posthog } from '@/lib/analytics';
import { signUpWithEmail } from '@/lib/auth';
import {
  EmailAuthError,
  getEmailAuthErrorKey,
  logAuthError,
} from '@/lib/auth-errors';
import { isPasswordRecoveryFlowActive } from '@/lib/auth-redirect';
import { useAuthStore } from '@/stores/auth-store';

type EmailFormValues = {
  email: string;
  password: string;
};

const SIGNUP_EMAIL_KOLI_SIZE = { height: 84, width: 105 } as const;

const AUTH_INPUT_STYLE = getGlassCardStyle({
  borderRadius: 12,
  height: 48,
  paddingHorizontal: 16,
  justifyContent: 'center',
});

export default function SignupEmailScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useGradientScreenInsets({ extraTop: 12 });
  const session = useAuthStore((state) => state.session);
  const isOnboarded = useAuthStore((state) => state.isOnboarded);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!session) return;
    if (isPasswordRecoveryFlowActive()) return;
    if (isOnboarded === null) return;

    router.replace(
      (isOnboarded
        ? '/home'
        : ({ pathname: '/onboarding', params: {} } as Href)) as Href,
    );
  }, [session, isOnboarded]);

  async function onSignUp({ email, password }: EmailFormValues) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signUpWithEmail(email.trim(), password);
      posthog?.capture('signup_completed', { provider: 'email' });
    } catch (error) {
      logAuthError('EmailSignUp', error);

      if (error instanceof EmailAuthError && error.kind === 'emailAlreadyRegistered') {
        router.replace({
          pathname: '/(auth)/login',
          params: { mode: 'signin', reason: 'emailAlreadyRegistered' },
        });
        return;
      }

      if (error instanceof EmailAuthError) {
        setErrorMessage(t(getEmailAuthErrorKey(error.kind, 'signUp')));
        return;
      }

      setErrorMessage(t('auth.errors.signUpFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/login');
  }

  return (
    <GradientScreenWrapper>
      <View className="absolute left-4 z-10" style={{ top: contentTopPadding }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.signup.emailBack')}
          className="flex-row items-center py-1 pr-2"
          hitSlop={8}
          disabled={isSubmitting}
          onPress={handleBack}>
          <Ionicons name="chevron-back" size={22} color="#4F46E5" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: contentTopPadding + 52,
            paddingBottom: 24,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="mb-3 items-center">
            <Image
              source={require('@/assets/images/koli-curious.png')}
              style={SIGNUP_EMAIL_KOLI_SIZE}
              resizeMode="contain"
            />
          </View>

          <Text className="mb-10 text-center text-2xl font-bold text-[#2C2C2A]">
            {t('auth.signup.emailTitle')}
          </Text>

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
                autoComplete="password"
                className="mb-2 text-base text-gray-900"
                style={AUTH_INPUT_STYLE}
                placeholder={t('auth.password')}
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

          {errorMessage ? (
            <Text className="mb-10 text-center text-sm text-red-500">{errorMessage}</Text>
          ) : (
            <View className="mb-10" />
          )}

          <Pressable
            className="overflow-hidden rounded-xl"
            disabled={isSubmitting}
            onPress={handleSubmit(onSignUp)}>
            <LinearGradient
              colors={['#4F46E5', '#7CE7C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">{t('auth.signUp')}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientScreenWrapper>
  );
}
