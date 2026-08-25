import { LinearGradient } from 'expo-linear-gradient';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { AppleIcon } from '@/components/apple-icon';
import { ExistingIdentitySheet } from '@/components/auth/existing-identity-sheet';
import { GoogleIcon } from '@/components/google-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  GradientScreenWrapper,
  useGradientScreenInsets,
} from '@/components/shared/GradientScreenWrapper';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { trackSignupProviderSelected } from '@/lib/analytics';
import {
  completeExistingIdentitySignIn,
  setDisplayNameIfEmpty,
  signInWithAppleIdentityToken,
  signInWithEmail,
  signInWithGoogleIdToken,
} from '@/lib/auth';
import {
  EmailAuthError,
  IdentityAlreadyLinkedError,
  getEmailAuthErrorKey,
  logAuthError,
  type LinkedOAuthProvider,
} from '@/lib/auth-errors';
import { isPasswordRecoveryFlowActive } from '@/lib/auth-redirect';
import { configureGoogleSignIn } from '@/lib/google-signin';
import { checkScanAllowance, scanAllowanceQueryKey } from '@/lib/scanGate';
import { useAuthStore } from '@/stores/auth-store';

type PendingExistingAccount =
  | { provider: LinkedOAuthProvider; identityToken: string }
  | { provider: 'email'; email: string; password: string };

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
  const { contentTopPadding } = useGradientScreenInsets({ extraTop: 28 });
  const params = useLocalSearchParams<{ mode?: string; reason?: string }>();
  const session = useAuthStore((state) => state.session);
  const isOnboarded = useAuthStore((state) => state.isOnboarded);
  const isAnonymousUser = session?.user.is_anonymous === true;
  const userId = session?.user?.id;
  const { data: scanAllowance } = useQuery({
    queryKey: userId ? scanAllowanceQueryKey(userId) : ['scan-allowance'],
    enabled: Boolean(userId) && isAnonymousUser,
    staleTime: 15 * 1000,
    queryFn: () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return checkScanAllowance(userId);
    },
  });
  const unsavedMealCount = scanAllowance?.scanCount ?? 0;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwitchingIdentity, setIsSwitchingIdentity] = useState(false);
  const [pendingExistingAccount, setPendingExistingAccount] =
    useState<PendingExistingAccount | null>(null);
  const [warningMealCount, setWarningMealCount] = useState(0);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(true);
  const passwordInputRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setValue,
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

  // Deep-link / return from signup-email (e.g. email already registered).
  useEffect(() => {
    if (params.mode === 'signin') {
      setIsSignUpMode(false);
    }
    if (params.reason === 'emailAlreadyRegistered') {
      setErrorMessage(t('auth.errors.emailAlreadyRegistered'));
      setValue('password', '');
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
    }
    if (params.reason === 'accountRequired') {
      setErrorMessage(t('auth.accountRequired'));
    }
  }, [params.mode, params.reason, setValue, t]);

  useEffect(() => {
    if (!session) return;

    // Anonymous sessions still need the signup screen (scan-limit conversion).
    if (session.user.is_anonymous) return;

    if (isPasswordRecoveryFlowActive()) return;

    if (isOnboarded === null) return;

    router.replace(
      (isOnboarded
        ? '/home'
        : ({ pathname: '/onboarding', params: {} } as Href)) as Href,
    );
  }, [session, isOnboarded]);

  async function runSignInAction(action: () => Promise<void>) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await action();
    } catch (error) {
      logAuthError('EmailSignIn', error);

      if (error instanceof EmailAuthError) {
        setErrorMessage(t(getEmailAuthErrorKey(error.kind, 'signIn')));
        return;
      }

      setErrorMessage(t('auth.errors.signInFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    if (isSignUpMode) {
      trackSignupProviderSelected('apple');
    }

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

      // Only reached if auth above did not throw. Still writes to whoever
      // supabase.auth.getUser() returns — including a still-anonymous session.
      const givenName = credential.fullName?.givenName?.trim();
      if (givenName) {
        await setDisplayNameIfEmpty(givenName);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }

      if (error instanceof IdentityAlreadyLinkedError) {
        await promptOrSwitchExistingOAuth(error);
        return;
      }

      logAuthError('AppleSignIn', error);
      setErrorMessage(t('auth.errors.appleSignInFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (isSignUpMode) {
      trackSignupProviderSelected('google');
    }

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

      if (error instanceof IdentityAlreadyLinkedError) {
        await promptOrSwitchExistingOAuth(error);
        return;
      }

      logAuthError('GoogleSignIn', error);
      setErrorMessage(t('auth.errors.googleSignInFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function anonymousMealCount(): Promise<number> {
    if (!isAnonymousUser || !userId) {
      return 0;
    }

    if (scanAllowance) {
      return scanAllowance.scanCount;
    }

    return (await checkScanAllowance(userId)).scanCount;
  }

  async function promptOrSwitchExistingOAuth(error: IdentityAlreadyLinkedError) {
    const mealCount = await anonymousMealCount();
    if (mealCount > 0) {
      setWarningMealCount(mealCount);
      setPendingExistingAccount({
        provider: error.provider,
        identityToken: error.identityToken,
      });
      return;
    }

    await completeExistingIdentitySignIn(error.provider, error.identityToken);
  }

  async function onSignIn({ email, password }: EmailFormValues) {
    const trimmedEmail = email.trim();
    const mealCount = await anonymousMealCount();
    if (mealCount > 0) {
      setWarningMealCount(mealCount);
      setPendingExistingAccount({
        provider: 'email',
        email: trimmedEmail,
        password,
      });
      return;
    }

    return runSignInAction(() => signInWithEmail(trimmedEmail, password));
  }

  function openEmailSignUp() {
    trackSignupProviderSelected('email');
    router.push('/(auth)/signup-email');
  }

  function toggleAuthMode() {
    setIsSignUpMode((prev) => !prev);
    setErrorMessage(null);
  }

  function cancelExistingIdentitySignIn() {
    if (isSwitchingIdentity) {
      return;
    }

    setPendingExistingAccount(null);
  }

  async function confirmExistingIdentitySignIn() {
    if (!pendingExistingAccount || isSwitchingIdentity) {
      return;
    }

    setIsSwitchingIdentity(true);
    setErrorMessage(null);

    try {
      if (pendingExistingAccount.provider === 'email') {
        await signInWithEmail(pendingExistingAccount.email, pendingExistingAccount.password);
      } else {
        await completeExistingIdentitySignIn(
          pendingExistingAccount.provider,
          pendingExistingAccount.identityToken,
        );
      }
      setPendingExistingAccount(null);
    } catch (signInError) {
      if (pendingExistingAccount.provider === 'email') {
        logAuthError('EmailSignIn', signInError);
        if (signInError instanceof EmailAuthError) {
          setErrorMessage(t(getEmailAuthErrorKey(signInError.kind, 'signIn')));
        } else {
          setErrorMessage(t('auth.errors.signInFailed'));
        }
        setPendingExistingAccount(null);
        return;
      }

      logAuthError(
        pendingExistingAccount.provider === 'apple' ? 'AppleSignIn' : 'GoogleSignIn',
        signInError,
      );
      setErrorMessage(
        t(
          pendingExistingAccount.provider === 'apple'
            ? 'auth.errors.appleSignInFailed'
            : 'auth.errors.googleSignInFailed',
        ),
      );
      setPendingExistingAccount(null);
    } finally {
      setIsSwitchingIdentity(false);
    }
  }

  return (
    <GradientScreenWrapper>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: contentTopPadding,
          paddingBottom: 24,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="mb-3 items-center">
          <Image
            source={require('@/assets/images/koli-happy.png')}
            style={{ height: 90, width: 112 }}
            resizeMode="contain"
          />
        </View>

        {isAnonymousUser ? (
          <Text
            className="mb-8 text-center text-5xl font-bold leading-tight tracking-tight text-[#2C2C2A]"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}>
            {t('auth.convertHeadline')}
          </Text>
        ) : (
          <Text
            className="mb-8 text-center text-5xl font-bold leading-tight tracking-tight"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}>
            <Text className="text-[#2C2C2A]">{t('auth.valueProp.action')}</Text>
            {'\n'}
            <Text className="text-[#4F46E5]">{t('auth.valueProp.result')}</Text>
          </Text>
        )}
        {isSignUpMode ? (
          <View className="mb-10 self-center rounded-full bg-[#7CE7C7] px-4 py-2.5">
            <Text className="text-center text-sm font-semibold text-[#2C2C2A]">
              {isAnonymousUser
                ? t('auth.signup.convertBadge')
                : t('auth.signup.freeBadge')}
            </Text>
          </View>
        ) : (
          <View className="mb-6" />
        )}

        {Platform.OS === 'ios' && isAppleAvailable && (
          <Pressable
            className={`${isSignUpMode ? 'mb-2' : 'mb-3'} h-12 flex-row items-center justify-center gap-2.5 rounded-xl bg-black`}
            disabled={isSubmitting}
            onPress={handleAppleSignIn}>
            <AppleIcon size={20} />
            <Text style={AUTH_PROVIDER_BUTTON_TEXT_STYLE} className="text-white">
              {t('auth.apple')}
            </Text>
          </Pressable>
        )}

        <Pressable
          className={`${isSignUpMode ? 'mb-2' : 'mb-6'} h-12 flex-row items-center justify-center gap-2.5 rounded-xl`}
          style={getGlassCardStyle({ borderRadius: 12 })}
          disabled={isSubmitting}
          onPress={handleGoogleSignIn}>
          <GoogleIcon size={20} />
          <Text style={AUTH_PROVIDER_BUTTON_TEXT_STYLE} className="text-gray-900">
            {t('auth.signInWithGoogle')}
          </Text>
        </Pressable>

        {isSignUpMode ? (
          <>
            <Pressable
              className="mb-10 h-12 flex-row items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white"
              disabled={isSubmitting}
              onPress={openEmailSignUp}>
              <Ionicons name="mail-outline" size={20} color="#111827" />
              <Text style={AUTH_PROVIDER_BUTTON_TEXT_STYLE} className="text-gray-900">
                {t('auth.signup.withEmail')}
              </Text>
            </Pressable>

            {errorMessage ? (
              <Text className="mb-4 text-center text-sm text-red-500">{errorMessage}</Text>
            ) : null}

            <Pressable
              className="items-center py-2"
              disabled={isSubmitting}
              onPress={toggleAuthMode}>
              <Text className="text-center text-sm text-gray-500">
                {t('auth.haveAccount')}{' '}
                <Text className="font-semibold text-[#4F46E5]">{t('auth.signIn')}</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
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
                  ref={passwordInputRef}
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

            <Pressable
              className="mb-4 self-end"
              disabled={isSubmitting}
              onPress={() => router.push('/(auth)/forgot-password')}>
              <Text className="text-sm font-medium text-[#4F46E5]">
                {t('auth.forgotPassword.link')}
              </Text>
            </Pressable>

            {errorMessage && (
              <Text className="mb-4 text-center text-sm text-red-500">{errorMessage}</Text>
            )}

            <Pressable
              className="overflow-hidden rounded-xl"
              disabled={isSubmitting}
              onPress={handleSubmit(onSignIn)}>
              <LinearGradient
                colors={['#4F46E5', '#7CE7C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-base font-semibold text-white">{t('auth.signIn')}</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              className="mt-3 items-center py-2"
              disabled={isSubmitting}
              onPress={toggleAuthMode}>
              <Text className="text-center text-sm text-gray-500">
                {t('auth.noAccount')}{' '}
                <Text className="font-semibold text-[#4F46E5]">{t('auth.signUp')}</Text>
              </Text>
            </Pressable>
          </>
        )}

        <View className="mt-4 items-center">
          <LanguageSwitcher compact />
        </View>
      </ScrollView>

      <ExistingIdentitySheet
        visible={pendingExistingAccount !== null}
        provider={pendingExistingAccount?.provider ?? 'apple'}
        mealCount={warningMealCount > 0 ? warningMealCount : unsavedMealCount}
        isSubmitting={isSwitchingIdentity}
        onCancel={cancelExistingIdentitySignIn}
        onConfirm={() => void confirmExistingIdentitySignIn()}
      />
    </GradientScreenWrapper>
  );
}
