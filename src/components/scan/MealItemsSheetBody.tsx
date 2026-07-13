import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMealInputBarActions } from '@/components/scan/meal-input-bar-context';

export const MEAL_SHEET_MAX_HEIGHT_RATIO = 0.85;
const SHEET_CHROME_HEIGHT = 54;
const MEAL_SHEET_FIXED_CHROME_HEIGHT = 220;

export function useMealItemsSheetLayout() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentMaxHeight =
    height * MEAL_SHEET_MAX_HEIGHT_RATIO - SHEET_CHROME_HEIGHT - Math.max(insets.bottom, 16);
  const scrollMaxHeight = Math.max(100, contentMaxHeight - MEAL_SHEET_FIXED_CHROME_HEIGHT);

  return { contentMaxHeight, scrollMaxHeight };
}

/** Syncs keyboard height into meal input bar context — call from MealItemsSheetBody. */
export function useMealInputKeyboardHeight() {
  const actions = useMealInputBarActions();
  const setKeyboardHeightRef = useRef(actions?.setKeyboardHeight);
  setKeyboardHeightRef.current = actions?.setKeyboardHeight;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeightRef.current?.(event.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeightRef.current?.(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
}

type MealItemsSheetBodyProps = {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
};

export function MealItemsSheetBody({
  header,
  footer,
  children,
  scrollRef,
}: MealItemsSheetBodyProps) {
  const { scrollMaxHeight } = useMealItemsSheetLayout();
  useMealInputKeyboardHeight();

  const setScrollRef = useCallback(
    (node: ScrollView | null) => {
      if (scrollRef) {
        scrollRef.current = node;
      }
    },
    [scrollRef],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      style={styles.keyboardAvoid}>
      <View style={styles.body}>
        {header}
        <ScrollView
          ref={setScrollRef}
          style={[styles.list, { maxHeight: scrollMaxHeight }]}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled>
          <Pressable style={styles.dismissTapArea} onPress={Keyboard.dismiss}>
            {children}
          </Pressable>
        </ScrollView>
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flexGrow: 0,
  },
  body: {
    flexGrow: 0,
  },
  list: {
    flexGrow: 0,
    marginBottom: 4,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  dismissTapArea: {
    flexGrow: 1,
    gap: 10,
  },
});
