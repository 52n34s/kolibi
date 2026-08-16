import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { useMealInputBarValues } from '@/components/scan/meal-input-bar-context';
import { BRAND_INDIGO } from '@/constants/brand';

export const MEAL_INPUT_BAR_HEIGHT = 64;
export const MEAL_INPUT_KEYBOARD_GAP = 8;

const BAR_HEIGHT = MEAL_INPUT_BAR_HEIGHT;
const KEYBOARD_GAP = MEAL_INPUT_KEYBOARD_GAP;
const CARET_BLINK_MS = 530;

function BlinkingCaret() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.delay(CARET_BLINK_MS),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(CARET_BLINK_MS),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    blink.start();
    return () => {
      blink.stop();
      opacity.setValue(1);
    };
  }, [opacity]);

  return <Animated.View style={[styles.caret, { opacity }]} />;
}

function BarContent({
  productName,
  fieldLabel,
  displayValue,
  caretIndex,
}: {
  productName: string;
  fieldLabel: string;
  displayValue: string;
  caretIndex?: number;
}) {
  const clampedCaret = Math.max(
    0,
    Math.min(caretIndex ?? displayValue.length, displayValue.length),
  );
  const beforeCaret = displayValue.slice(0, clampedCaret);
  const afterCaret = displayValue.slice(clampedCaret);

  return (
    <>
      <Text ellipsizeMode="tail" numberOfLines={1} style={styles.meta}>
        {productName} · {fieldLabel}
      </Text>
      <View style={styles.valueCluster}>
        {beforeCaret.length > 0 ? (
          <Text numberOfLines={1} style={styles.value}>
            {beforeCaret}
          </Text>
        ) : null}
        <BlinkingCaret />
        {afterCaret.length > 0 ? (
          <Text numberOfLines={1} style={styles.value}>
            {afterCaret}
          </Text>
        ) : null}
      </View>
    </>
  );
}

export function MealInputFloatingBar() {
  const values = useMealInputBarValues();
  const activeField = values?.activeField ?? null;
  const keyboardHeight = values?.keyboardHeight ?? 0;

  if (!activeField || keyboardHeight <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: keyboardHeight + KEYBOARD_GAP }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="light" style={styles.bar}>
          <View style={styles.barSurface}>
            <BarContent
              caretIndex={activeField.caretIndex}
              displayValue={activeField.displayValue}
              fieldLabel={activeField.fieldLabel}
              productName={activeField.productName}
            />
          </View>
        </BlurView>
      ) : (
        <View style={styles.bar}>
          <View style={styles.barSurface}>
            <BarContent
              caretIndex={activeField.caretIndex}
              displayValue={activeField.displayValue}
              fieldLabel={activeField.fieldLabel}
              productName={activeField.productName}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
    minHeight: BAR_HEIGHT,
  },
  bar: {
    minHeight: BAR_HEIGHT,
    overflow: 'hidden',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(79, 70, 229, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  barSurface: {
    minHeight: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  meta: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  valueCluster: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '600',
    color: '#4F46E5',
  },
  caret: {
    width: 2,
    height: 28,
    marginLeft: 2,
    backgroundColor: BRAND_INDIGO,
  },
});
