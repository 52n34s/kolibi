import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ONBOARDING_CARD_COLORS } from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE } from '@/components/ui/glass-styles';
import { TEXT_SECONDARY } from '@/constants/brand';

const PILL_RADIUS = 999;

type PillSegment<T extends string> = {
  id: T;
  label: string;
  testID?: string;
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
            testID={segment.testID}
            style={[
              styles.segment,
              compact && styles.segmentCompact,
              compact && segments.length >= 3 && styles.segmentCompactTriple,
              compact && segments.length >= 4 && styles.segmentCompactQuad,
              isActive && styles.segmentActive,
            ]}
            onPress={() => onChange(segment.id)}>
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={segments.length >= 3 ? 0.7 : 0.75}>
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
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: 1,
    borderRadius: PILL_RADIUS,
  },
  segment: {
    flex: 1,
    minWidth: 0,
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
  segmentCompactTriple: {
    paddingHorizontal: 4,
  },
  segmentCompactQuad: {
    paddingHorizontal: 2,
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
    width: '100%',
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 12,
  },
  labelActive: {
    color: '#111827',
  },
});
