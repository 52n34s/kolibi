import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import {
  useMealInputBarValues,
  type MealStepperField,
} from '@/components/scan/meal-input-bar-context';
import { BRAND_INDIGO } from '@/constants/brand';

export const MEAL_INPUT_BAR_HEIGHT = 64;
export const MEAL_INPUT_KEYBOARD_GAP = 8;

const BAR_HEIGHT = MEAL_INPUT_BAR_HEIGHT;
const KEYBOARD_GAP = MEAL_INPUT_KEYBOARD_GAP;
const CARET_BLINK_MS = 530;

/**
 * Height budget (approx.):
 * - Current single-line value: font 28 + paddingTop 12 + paddingBottom 8 ≈ 48–64 → minHeight 64
 * - Name two-line value: font 22 / lineHeight 26 × 2 = 52 + same padding ≈ 72
 * Host is bottom-anchored at keyboardHeight + 8, so extra height grows upward (away from keyboard).
 */
const NAME_VALUE_LINE_HEIGHT = 26;

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
  field,
  productName,
  fieldLabel,
  displayValue,
  caretIndex,
}: {
  field: MealStepperField;
  productName: string;
  fieldLabel: string;
  displayValue: string;
  caretIndex?: number;
}) {
  const isNameField = field === 'name';

  if (isNameField) {
    // No split caret: before/after Text siblings in a row cannot keep caret position
    // across a mid-string wrap. Name shows the full value without a fake caret.
    return (
      <>
        <Text ellipsizeMode="tail" numberOfLines={1} style={styles.meta}>
          {productName} · {fieldLabel}
        </Text>
        <View style={styles.valueClusterName}>
          <Text numberOfLines={2} style={styles.valueName}>
            {displayValue}
          </Text>
        </View>
      </>
    );
  }

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

  const isNameField = activeField.field === 'name';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        isNameField && styles.hostName,
        { bottom: keyboardHeight + KEYBOARD_GAP },
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="light" style={[styles.bar, isNameField && styles.barName]}>
          <View style={[styles.barSurface, isNameField && styles.barSurfaceName]}>
            <BarContent
              caretIndex={activeField.caretIndex}
              displayValue={activeField.displayValue}
              field={activeField.field}
              fieldLabel={activeField.fieldLabel}
              productName={activeField.productName}
            />
          </View>
        </BlurView>
      ) : (
        <View style={[styles.bar, isNameField && styles.barName]}>
          <View style={[styles.barSurface, isNameField && styles.barSurfaceName]}>
            <BarContent
              caretIndex={activeField.caretIndex}
              displayValue={activeField.displayValue}
              field={activeField.field}
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
  hostName: {
    minHeight: 76,
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
  barName: {
    minHeight: 76,
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
  barSurfaceName: {
    minHeight: 76,
    alignItems: 'flex-start',
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
  valueClusterName: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '58%',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 28,
    fontWeight: '600',
    color: '#4F46E5',
  },
  valueName: {
    fontSize: 22,
    lineHeight: NAME_VALUE_LINE_HEIGHT,
    fontWeight: '600',
    color: '#4F46E5',
    textAlign: 'right',
  },
  caret: {
    width: 2,
    height: 28,
    marginLeft: 2,
    backgroundColor: BRAND_INDIGO,
  },
});
