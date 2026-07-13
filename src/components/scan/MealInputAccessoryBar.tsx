import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useMealInputBarValues } from '@/components/scan/meal-input-bar-context';

const BAR_HEIGHT = 64;
const KEYBOARD_GAP = 8;

function BarContent({
  productName,
  fieldLabel,
  displayValue,
}: {
  productName: string;
  fieldLabel: string;
  displayValue: string;
}) {
  return (
    <>
      <Text ellipsizeMode="tail" numberOfLines={1} style={styles.meta}>
        {productName} · {fieldLabel}
      </Text>
      <Text numberOfLines={1} style={styles.value}>
        {displayValue}
      </Text>
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
  value: {
    flexShrink: 0,
    fontSize: 28,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
