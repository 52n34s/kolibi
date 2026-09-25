import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

type StickerBrandProps = {
  color: string;
  textShadow?: TextStyle | null;
  /**
   * Slot for the Koli line drawing (SVG, ~28 pt tall, drawn in `color`).
   * Not delivered yet — until then the brand is the domain alone.
   */
  mark?: ReactNode;
};

/** Quiet bottom-right signature on every sticker. */
export function StickerBrand({ color, textShadow, mark }: StickerBrandProps) {
  return (
    <View style={styles.row}>
      {mark ? <View style={styles.mark}>{mark}</View> : null}
      <Text allowFontScaling={false} style={[styles.domain, { color }, textShadow]}>
        kolibi.app
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    gap: 6,
  },
  mark: {
    height: 28,
    justifyContent: 'center',
  },
  domain: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
