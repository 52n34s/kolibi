import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getGlassCardStyle } from '@/components/ui/glass-styles';

const SHEET_RADIUS = 24;
const HANDLE_ROW_HEIGHT = 18;
const DEFAULT_TINT_OPACITY = 0.18;
const DEFAULT_BLUR_INTENSITY = 48;

type GlassSheetSurfaceProps = {
  children: ReactNode;
  maxHeight?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** `sheet` = bottom sheet (rounded top only). `card` = centered dialog (all corners). */
  variant?: 'sheet' | 'card';
  /** White tint over blur; higher = more opaque sheet (default 0.18). */
  tintOpacity?: number;
  blurIntensity?: number;
};

function SheetSurface({
  children,
  maxHeight,
  variant = 'sheet',
  tintOpacity = DEFAULT_TINT_OPACITY,
  blurIntensity = DEFAULT_BLUR_INTENSITY,
}: {
  children: ReactNode;
  maxHeight?: number;
  variant?: 'sheet' | 'card';
  tintOpacity?: number;
  blurIntensity?: number;
}) {
  const androidBackground = `rgba(255, 255, 255, ${Math.min(0.92, tintOpacity + 0.45)})`;

  const surfaceStyle = getGlassCardStyle(
    variant === 'card'
      ? {
          borderRadius: SHEET_RADIUS,
          overflow: 'hidden',
          maxHeight,
          ...(Platform.OS !== 'ios' ? { backgroundColor: androidBackground } : {}),
        }
      : {
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          overflow: 'hidden',
          maxHeight,
          ...(Platform.OS !== 'ios' ? { backgroundColor: androidBackground } : {}),
        },
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={blurIntensity} tint="light" style={surfaceStyle}>
        <View style={[styles.blurTint, { backgroundColor: `rgba(255, 255, 255, ${tintOpacity})` }]}>
          {children}
        </View>
      </BlurView>
    );
  }

  return <View style={surfaceStyle}>{children}</View>;
}

export function GlassSheetSurface({
  children,
  maxHeight,
  contentStyle,
  variant = 'sheet',
  tintOpacity,
  blurIntensity,
}: GlassSheetSurfaceProps) {
  const insets = useSafeAreaInsets();
  const showHandle = variant === 'sheet';

  return (
    <SheetSurface
      maxHeight={maxHeight}
      variant={variant}
      tintOpacity={tintOpacity}
      blurIntensity={blurIntensity}>
      {showHandle ? (
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>
      ) : null}
      <View
        style={[
          styles.content,
          variant === 'card' && styles.contentCard,
          contentStyle,
          {
            paddingBottom: variant === 'sheet' ? Math.max(insets.bottom, 16) : 0,
            maxHeight: maxHeight ? maxHeight - (showHandle ? HANDLE_ROW_HEIGHT : 0) : undefined,
          },
        ]}>
        {children}
      </View>
    </SheetSurface>
  );
}

const styles = StyleSheet.create({
  blurTint: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  content: {
    paddingHorizontal: 24,
  },
  contentCard: {
    paddingHorizontal: 0,
  },
});
