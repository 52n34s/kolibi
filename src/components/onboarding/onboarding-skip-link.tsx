import { Pressable, StyleSheet, Text } from 'react-native';

/** Reserved vertical space for the skip link (used by scroll padding estimates). */
export const ONBOARDING_SKIP_LINK_HEIGHT = 44;

const styles = StyleSheet.create({
  root: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ONBOARDING_SKIP_LINK_HEIGHT,
    paddingVertical: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
});

type OnboardingSkipLinkProps = {
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * Standalone skip affordance for onboarding.
 * Intentionally self-contained so footer/card/glass redesigns do not touch it.
 */
export function OnboardingSkipLink({ label, disabled = false, onPress }: OnboardingSkipLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      style={styles.root}
      onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

/** Skip is hidden on the final step and in review mode. */
export function shouldShowOnboardingSkip(
  step: number,
  totalSteps: number,
  hideSkip = false,
): boolean {
  return !hideSkip && step < totalSteps - 1;
}
