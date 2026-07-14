import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ONBOARDING_ACCENT,
  ONBOARDING_SECONDARY_SURFACE,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE } from '@/components/ui/glass-styles';

const segmentRadius = ONBOARDING_SECONDARY_SURFACE.borderRadius - 4;

type CompactSegmentToggleProps = {
  segments: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabledSegmentIds?: string[];
  onDisabledSegmentPress?: (segmentId: string) => void;
  /** Language uses solid accent fill; unit uses bordered card segment. */
  variant?: 'language' | 'unit';
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  containerStyle?: import('react-native').StyleProp<import('react-native').ViewStyle>;
};

export function CompactSegmentToggle({
  segments,
  value,
  onChange,
  disabledSegmentIds = [],
  onDisabledSegmentPress,
  variant = 'unit',
  style,
  containerStyle,
}: CompactSegmentToggleProps) {
  return (
    <View style={[styles.fitWrapper, style]}>
      <View style={[styles.container, variant === 'language' && styles.containerLanguage, containerStyle]}>
        {segments.map((segment) => {
          const isActive = value === segment.id;
          const isDisabled = disabledSegmentIds.includes(segment.id);

          return (
            <Pressable
              key={segment.id}
              style={[
                styles.segment,
                variant === 'unit' && isActive && styles.segmentActive,
                variant === 'language' && isActive && styles.segmentActive,
                isDisabled && styles.segmentDisabled,
              ]}
              onPress={() => {
                if (isDisabled) {
                  onDisabledSegmentPress?.(segment.id);
                  return;
                }

                onChange(segment.id);
              }}>
              <Text
                style={[
                  styles.label,
                  variant === 'unit' && isActive && styles.labelActive,
                  variant === 'language' && isActive && styles.labelActive,
                  isDisabled && styles.labelDisabled,
                ]}>
                {segment.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fitWrapper: {
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
  },
  container: {
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 12,
    padding: 4,
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: GLASS_SURFACE.borderWidth,
    borderRadius: ONBOARDING_SECONDARY_SURFACE.borderRadius,
  },
  containerLanguage: {
    backgroundColor: GLASS_SURFACE.backgroundColor,
  },
  segment: {
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: segmentRadius,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: ONBOARDING_ACCENT,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  labelActive: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  segmentDisabled: {
    opacity: 0.45,
  },
  labelDisabled: {
    color: '#9CA3AF',
  },
});
