import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOnboardingSecondarySurfaceStyle } from '@/components/onboarding/onboarding-styles';
import {
  ONBOARDING_SKIP_LINK_HEIGHT,
  OnboardingSkipLink,
  shouldShowOnboardingSkip,
} from '@/components/onboarding/onboarding-skip-link';

/** Approximate footer height for scroll content padding (buttons + skip + safe area). */
export const ONBOARDING_FOOTER_ESTIMATED_HEIGHT = 16 + 48 + 12 + ONBOARDING_SKIP_LINK_HEIGHT + 24;

type OnboardingFooterProps = {
  step: number;
  totalSteps: number;
  isSubmitting: boolean;
  /** Disables footer actions (e.g. while session is loading). Defaults to isSubmitting. */
  actionsDisabled?: boolean;
  errorMessage: string | null;
  backLabel: string;
  skipLabel: string;
  nextLabel: string;
  finishLabel: string;
  hideSkip?: boolean;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  onFinish: () => void;
};

export function OnboardingFooter({
  step,
  totalSteps,
  isSubmitting,
  actionsDisabled,
  errorMessage,
  backLabel,
  skipLabel,
  nextLabel,
  finishLabel,
  hideSkip = false,
  onBack,
  onSkip,
  onNext,
  onFinish,
}: OnboardingFooterProps) {
  const insets = useSafeAreaInsets();
  const isLastStep = step >= totalSteps - 1;
  const showBack = step > 0;
  const showSkip = shouldShowOnboardingSkip(step, totalSteps, hideSkip);
  const footerDisabled = actionsDisabled ?? isSubmitting;

  return (
    <View
      className="px-6 pt-4"
      style={{
        flexShrink: 0,
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: 'transparent',
      }}>
      {errorMessage ? (
        <Text className="mb-3 text-center text-sm text-red-500">{errorMessage}</Text>
      ) : null}

      <View className="flex-row gap-3">
        {showBack ? (
          <Pressable
            className="h-12 flex-1 items-center justify-center"
            style={getOnboardingSecondarySurfaceStyle()}
            disabled={footerDisabled}
            onPress={onBack}>
            <Text className="text-base font-semibold text-gray-900">{backLabel}</Text>
          </Pressable>
        ) : null}

        <Pressable
          className="h-12 flex-1 overflow-hidden rounded-xl"
          disabled={footerDisabled}
          onPress={isLastStep ? onFinish : onNext}>
          <LinearGradient
            colors={['#4F46E5', '#7CE7C7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {isSubmitting && isLastStep ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {isLastStep ? finishLabel : nextLabel}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      {/* IMPORTANT: Skip button must always remain visible in non-review onboarding mode (steps 1–6). Do not remove during redesigns. */}
      {showSkip ? (
        <OnboardingSkipLink label={skipLabel} disabled={footerDisabled} onPress={onSkip} />
      ) : null}
    </View>
  );
}
