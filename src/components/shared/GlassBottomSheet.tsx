import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getGlassCardStyle } from '@/components/ui/glass-styles';

type GlassBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** When set (e.g. 0.88), the sheet grows with content up to this screen-height fraction. */
  maxHeightRatio?: number;
};

const SHEET_RADIUS = 24;
const HANDLE_ROW_HEIGHT = 18;

function SheetSurface({
  children,
  maxHeight,
}: {
  children: ReactNode;
  maxHeight?: number;
}) {
  const surfaceStyle = getGlassCardStyle({
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    overflow: 'hidden',
    maxHeight,
  });

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={48} tint="light" style={surfaceStyle}>
        <View style={styles.blurTint}>{children}</View>
      </BlurView>
    );
  }

  return <View style={surfaceStyle}>{children}</View>;
}

export function GlassBottomSheet({
  visible,
  onClose,
  children,
  maxHeightRatio,
}: GlassBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = maxHeightRatio ? windowHeight * maxHeightRatio : undefined;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheetShell, maxSheetHeight ? { maxHeight: maxSheetHeight } : undefined]}
          onPress={(event) => event.stopPropagation()}>
          <SheetSurface maxHeight={maxSheetHeight}>
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>
            <View
              style={[
                styles.content,
                {
                  paddingBottom: Math.max(insets.bottom, 16),
                  maxHeight: maxSheetHeight
                    ? maxSheetHeight - HANDLE_ROW_HEIGHT
                    : undefined,
                },
              ]}>
              {children}
            </View>
          </SheetSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheetShell: {
    width: '100%',
  },
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
});
