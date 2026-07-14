import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { AppleIcon } from '@/components/apple-icon';
import { AuthMeshLayout } from '@/components/auth/auth-mesh-layout';
import { GoogleIcon } from '@/components/google-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import {
  signInWithAppleIdentityToken,
  signInWithEmail,
  signInWithGoogleIdToken,
  signUpWithEmail,
} from '@/lib/auth';
import { getEmailAuthErrorKey, logAuthError } from '@/lib/auth-errors';
import { isPasswordRecoveryFlowActive } from '@/lib/auth-redirect';
import { configureGoogleSignIn } from '@/lib/google-signin';
import { useAuthStore } from '@/stores/auth-store';

type EmailFormValues = {
  email: string;
  password: string;
};

const AUTH_PROVIDER_BUTTON_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: '600' as const,
};

const AUTH_INPUT_STYLE = getGlassCardStyle({
  borderRadius: 12,
  height: 48,
  paddingHorizontal: 16,
  justifyContent: 'center',
});

export default function LoginScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const isOnboarded = useAuthStore((state) => state.isOnboarded);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
    }
  }, []);

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

  async function runAuthAction(action: () => Promise<void>, mode: 'signIn' | 'signUp') {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await action();
    } catch (error) {
      logAuthError(mode === 'signUp' ? 'EmailSignUp' : 'EmailSignIn', error);
      setErrorMessage(t(getEmailAuthErrorKey(mode)));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error(t('auth.errors.noAppleToken'));
      }

      await signInWithAppleIdentityToken(credential.identityToken);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }

      logAuthError('AppleSignIn', error);
      setErrorMessage(t('auth.errors.appleSignInFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();

      if (response.type === 'cancelled') {
        return;
      }

      const idToken = response.data.idToken;

      if (!idToken) {
        throw new Error(t('auth.errors.noGoogleToken'));
      }

      await signInWithGoogleIdToken(idToken);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === statusCodes.SIGN_IN_CANCELLED
      ) {
        return;
      }

      logAuthError('GoogleSignIn', error);
      setErrorMessage(t('auth.errors.googleSignInFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function onSignIn({ email, password }: EmailFormValues) {
    return runAuthAction(() => signInWithEmail(email.trim(), password), 'signIn');
  }

  function onSignUp({ email, password }: EmailFormValues) {
    return runAuthAction(() => signUpWithEmail(email.trim(), password), 'signUp');
  }

  function toggleAuthMode() {
    setIsSignUpMode((prev) => !prev);
    setErrorMessage(null);
  }

  return (
    <AuthMeshLayout>
      <View className="absolute right-6 top-3 z-10">
        <LanguageSwitcher />
      </View>

      <View className="flex-1 justify-center px-6">
        <View className="mb-4 items-center">
          <Image
            source={require('@/assets/images/koli-happy.png')}
            style={{ height: 120, width: 150 }}
            resizeMode="contain"
          />
        </View>
        <Text className="mb-8 text-center text-base text-gray-500">
          {t(isSignUpMode ? 'auth.subtitleSignUp' : 'auth.subtitleSignIn')}
        </Text>
        {Platform.OS === 'ios' && isAppleAvailable && (
          <Pressable
            className="mb-3 h-12 flex-row items-center justify-center gap-2.5 rounded-xl bg-black"
            disabled={isSubmitting}
            onPress={handleAppleSignIn}>
            <AppleIcon size={20} />
            <Text style={AUTH_PROVIDER_BUTTON_TEXT_STYLE} className="text-white">
              {t('auth.apple')}
            </Text>
          </Pressable>
        )}

        <Pressable
          className="mb-6 h-12 flex-row items-center justify-center gap-2.5 rounded-xl"
          style={getGlassCardStyle({ borderRadius: 12 })}
          disabled={isSubmitting}
          onPress={handleGoogleSignIn}>
          <GoogleIcon size={20} />
          <Text style={AUTH_PROVIDER_BUTTON_TEXT_STYLE} className="text-gray-900">
            {t('auth.signInWithGoogle')}
          </Text>
        </Pressable>

        <View className="mb-4 flex-row items-center">
          <View className="h-px flex-1 bg-gray-200/80" />
          <Text className="mx-3 text-sm text-gray-400">{t('auth.or')}</Text>
          <View className="h-px flex-1 bg-gray-200/80" />
        </View>

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
        {errors.email && (
          <Text className="mb-2 text-sm text-red-500">{errors.email.message}</Text>
        )}

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
        {errors.password && (
          <Text className="mb-2 text-sm text-red-500">{errors.password.message}</Text>
        )}

        {!isSignUpMode ? (
          <Pressable
            className="mb-4 self-end"
            disabled={isSubmitting}
            onPress={() => router.push('/(auth)/forgot-password')}>
            <Text className="text-sm font-medium text-[#4F46E5]">
              {t('auth.forgotPassword.link')}
            </Text>
          </Pressable>
        ) : (
          <View className="mb-4" />
        )}

        {errorMessage && (
          <Text className="mb-4 text-center text-sm text-red-500">{errorMessage}</Text>
        )}

        <Pressable
          className="overflow-hidden rounded-xl"
          disabled={isSubmitting}
          onPress={handleSubmit(isSignUpMode ? onSignUp : onSignIn)}>
          <LinearGradient
            colors={['#4F46E5', '#7CE7C7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {isSignUpMode ? t('auth.signUp') : t('auth.signIn')}
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        {isSignUpMode ? (
          <Text className="mt-2 text-center text-[13px] text-gray-500">
            {t('auth.signup.freeHint')}
          </Text>
        ) : null}

        <Pressable
          className={`items-center py-2 ${isSignUpMode ? 'mt-2' : 'mt-3'}`}
          disabled={isSubmitting}
          onPress={toggleAuthMode}>
          <Text className="text-center text-sm text-gray-500">
            {isSignUpMode ? (
              <>
                {t('auth.haveAccount')}{' '}
                <Text className="font-semibold text-[#4F46E5]">{t('auth.signIn')}</Text>
              </>
            ) : (
              <>
                {t('auth.noAccount')}{' '}
                <Text className="font-semibold text-[#4F46E5]">{t('auth.signUp')}</Text>
              </>
            )}
          </Text>
        </Pressable>
      </View>
    </AuthMeshLayout>
  );
}
