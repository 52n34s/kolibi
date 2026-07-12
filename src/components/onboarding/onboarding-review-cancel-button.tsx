import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';

const REVIEW_SETTINGS_ROUTE = {
  pathname: '/koli',
  params: { segment: 'settings', settingsSubSegment: 'profile' },
} as Href;

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingVertical: 4,
    paddingRight: 8,
  },
  label: {
    marginLeft: 2,
    fontSize: 16,
    fontWeight: '500',
    color: ONBOARDING_ACCENT,
  },
});

type OnboardingReviewCancelButtonProps = {
  label: string;
  accessibilityLabel?: string;
};

/**
 * Review-mode exit control. Navigates back to Settings without saving.
 * Intentionally isolated from footer/step navigation styling.
 */
export function OnboardingReviewCancelButton({
  label,
  accessibilityLabel,
}: OnboardingReviewCancelButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      style={styles.root}
      onPress={() => router.replace(REVIEW_SETTINGS_ROUTE)}>
      <Ionicons name="chevron-back" size={22} color={ONBOARDING_ACCENT} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
