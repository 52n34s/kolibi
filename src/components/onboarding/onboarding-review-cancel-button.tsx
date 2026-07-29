import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';

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
  disabled?: boolean;
  onPress: () => void;
};

/**
 * Exit control for onboarding. Caller must persist onboarded_at (e.g. skipOnboarding)
 * before navigating away — cancel alone must not leave onboarded_at null.
 */
export function OnboardingReviewCancelButton({
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: OnboardingReviewCancelButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      hitSlop={8}
      style={[styles.root, disabled ? { opacity: 0.5 } : null]}
      onPress={onPress}>
      <Ionicons name="chevron-back" size={22} color={ONBOARDING_ACCENT} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
