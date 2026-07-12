import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ONBOARDING_CARD_COLORS } from '@/components/onboarding/onboarding-styles';

const PILL_RADIUS = 999;

type PillSegment<T extends string> = {
  id: T;
  label: string;
};

type PillSegmentSwitcherProps<T extends string> = {
  value: T;
  segments: PillSegment<T>[];
  onChange: (segment: T) => void;
  compact?: boolean;
};

export function PillSegmentSwitcher<T extends string>({
  value,
  segments,
  onChange,
  compact = false,
}: PillSegmentSwitcherProps<T>) {
  return (
    <View style={styles.container}>
      {segments.map((segment) => {
        const isActive = value === segment.id;

        return (
          <Pressable
            key={segment.id}
            style={[styles.segment, compact && styles.segmentCompact, isActive && styles.segmentActive]}
            onPress={() => onChange(segment.id)}>
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    borderColor: ONBOARDING_CARD_COLORS.border,
    borderWidth: 1,
    borderRadius: PILL_RADIUS,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PILL_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  segmentCompact: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  segmentActive: {
    backgroundColor: ONBOARDING_CARD_COLORS.idle,
    borderColor: ONBOARDING_CARD_COLORS.border,
    borderWidth: 1.5,
    shadowColor: ONBOARDING_CARD_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  labelCompact: {
    fontSize: 12,
  },
  labelActive: {
    color: '#111827',
  },
});
