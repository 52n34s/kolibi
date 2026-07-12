import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getGlassCardSelectedStyle } from '@/components/ui/glass-styles';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_INNER_RADIUS,
  ONBOARDING_CARD_RADIUS,
  ONBOARDING_GRID_CARD_MIN_HEIGHT,
  ONBOARDING_SELECTED_GRADIENT,
} from './onboarding-styles';

export { getOptionIconColor, ONBOARDING_ACCENT } from './onboarding-styles';

const SELECTED_BORDER_PADDING = 2.5;

/** Light glass fill inside the gradient ring — blocks tint bleed from the border layer. */
const SELECTED_INNER_GLASS_COLOR = 'rgba(255, 255, 255, 0.72)';

type OptionCardProps = {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  icon: ReactNode;
  layout?: 'row' | 'grid';
};

const gridStyles = StyleSheet.create({
  shell: {
    minHeight: ONBOARDING_GRID_CARD_MIN_HEIGHT,
    flex: 1,
    alignSelf: 'stretch',
  },
  borderGradient: {
    borderRadius: ONBOARDING_CARD_RADIUS,
    padding: SELECTED_BORDER_PADDING,
    flex: 1,
    minHeight: ONBOARDING_GRID_CARD_MIN_HEIGHT,
  },
  inner: {
    flex: 1,
    minHeight: ONBOARDING_GRID_CARD_MIN_HEIGHT - SELECTED_BORDER_PADDING * 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: ONBOARDING_CARD_INNER_RADIUS,
  },
  icon: {
    marginBottom: 12,
  },
  label: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    marginTop: 4,
    minHeight: 20,
    textAlign: 'center',
    fontSize: 14,
    color: '#4B5563',
  },
});

const rowBorderGradient = {
  borderRadius: ONBOARDING_CARD_RADIUS,
  padding: SELECTED_BORDER_PADDING,
  overflow: 'hidden' as const,
};

function getSelectedInnerGlassStyle() {
  return getGlassCardSelectedStyle({
    borderRadius: ONBOARDING_CARD_INNER_RADIUS,
    borderWidth: 0,
    backgroundColor: SELECTED_INNER_GLASS_COLOR,
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'hidden',
  });
}

type SelectedGradientBorderProps = {
  layout: 'row' | 'grid';
  children: ReactNode;
};

function SelectedGradientBorder({ layout, children }: SelectedGradientBorderProps) {
  return (
    <LinearGradient
      colors={[...ONBOARDING_SELECTED_GRADIENT.border]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={layout === 'grid' ? gridStyles.borderGradient : rowBorderGradient}>
      {children}
    </LinearGradient>
  );
}

export function OptionCard({
  label,
  hint,
  selected,
  onPress,
  icon,
  layout = 'row',
}: OptionCardProps) {
  const gridHint = hint?.trim() ? hint : undefined;

  const innerContent = layout === 'grid' ? (
    <>
      <View style={gridStyles.icon}>{icon}</View>
      <Text
        style={[gridStyles.label, { color: selected ? ONBOARDING_ACCENT : '#111827' }]}>
        {label}
      </Text>
      {gridHint ? <Text style={gridStyles.hint}>{gridHint}</Text> : null}
    </>
  ) : (
    <>
      <View className="mr-3">{icon}</View>
      <View className="flex-1">
        <Text
          className={`text-base font-semibold ${selected ? 'text-[#4F46E5]' : 'text-gray-900'}`}
          style={{ textAlign: 'left' }}>
          {label}
        </Text>
        {hint ? (
          <Text className="mt-1 text-sm text-gray-600" style={{ textAlign: 'left' }}>
            {hint}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (selected) {
    if (layout === 'grid') {
      return (
        <Pressable onPress={onPress} style={gridStyles.shell}>
          <SelectedGradientBorder layout="grid">
            <View style={[getSelectedInnerGlassStyle(), gridStyles.inner]}>{innerContent}</View>
          </SelectedGradientBorder>
        </Pressable>
      );
    }

    return (
      <Pressable onPress={onPress} style={{ borderRadius: ONBOARDING_CARD_RADIUS }}>
        <SelectedGradientBorder layout="row">
          <View style={[getSelectedInnerGlassStyle(), { width: '100%', alignSelf: 'stretch' }]}>
            <View className="flex-row items-center px-4 py-4">{innerContent}</View>
          </View>
        </SelectedGradientBorder>
      </Pressable>
    );
  }

  if (layout === 'grid') {
    return (
      <Pressable onPress={onPress} style={[getOnboardingIdleCardStyle(), gridStyles.shell]}>
        <View style={gridStyles.inner}>{innerContent}</View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={getOnboardingIdleCardStyle()}>
      <View className="flex-row items-center px-4 py-4">{innerContent}</View>
    </Pressable>
  );
}
