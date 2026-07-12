import type { ReactNode } from 'react';
import { Platform, View, type ViewProps, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';

import { getGlassCardStyle } from '@/components/ui/glass-styles';

type GlassCardProps = ViewProps & {
  children: ReactNode;
  style?: ViewStyle;
};

function canRenderNativeGlass(): boolean {
  return Platform.OS === 'ios' && isGlassEffectAPIAvailable() && GlassView != null;
}

/**
 * Reusable glass card container. Uses expo-glass-effect on supported iOS devices;
 * falls back to a semi-transparent surface elsewhere so the mesh gradient shows through.
 */
export function GlassCard({ children, style, ...props }: GlassCardProps) {
  const cardStyle = getGlassCardStyle(style);

  if (canRenderNativeGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor="rgba(255, 255, 255, 0.28)"
        style={cardStyle}
        {...props}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}
