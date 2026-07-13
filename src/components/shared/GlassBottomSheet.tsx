import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { MealInputFloatingBar } from '@/components/scan/MealInputAccessoryBar';
import { MealInputBarProvider } from '@/components/scan/meal-input-bar-context';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';

type GlassBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** When set (e.g. 0.88), the sheet grows with content up to this screen-height fraction. */
  maxHeightRatio?: number;
  /** Renders the shared iOS number-pad "Done" bar once at the Modal root. */
  numberInputAccessory?: boolean;
  /** Bottom sheet (default) or centered glass dialog — use center for compact numeric forms. */
  presentation?: 'bottom' | 'center';
  onShow?: () => void;
};

export function GlassBottomSheet({
  visible,
  onClose,
  children,
  maxHeightRatio,
  numberInputAccessory = false,
  presentation = 'bottom',
  onShow,
}: GlassBottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = maxHeightRatio ? windowHeight * maxHeightRatio : undefined;
  const isCentered = presentation === 'center';

  return (
    <Modal
      transparent
      visible={visible}
      animationType={isCentered ? 'fade' : 'slide'}
      onRequestClose={onClose}
      onShow={onShow}>
      {visible ? (
        <MealInputBarProvider>
          <View style={styles.modalRoot}>
            <Pressable
              style={[styles.overlay, isCentered && styles.overlayCenter]}
              onPress={onClose}>
              <Pressable
                style={[
                  styles.sheetShell,
                  isCentered && styles.sheetShellCenter,
                  maxSheetHeight ? { maxHeight: maxSheetHeight } : undefined,
                ]}
                onPress={(event) => event.stopPropagation()}>
                <GlassSheetSurface maxHeight={maxSheetHeight} variant={isCentered ? 'card' : 'sheet'}>
                  {children}
                </GlassSheetSurface>
              </Pressable>
            </Pressable>
            {numberInputAccessory ? <NumberInputAccessory /> : null}
            <MealInputFloatingBar />
          </View>
        </MealInputBarProvider>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayCenter: {
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheetShell: {
    width: '100%',
  },
  sheetShellCenter: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
});
