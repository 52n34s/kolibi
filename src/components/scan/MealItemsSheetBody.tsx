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
} from 'react-native';

import { useMealInputBarActions } from '@/components/scan/meal-input-bar-context';

export const MEAL_SHEET_MAX_HEIGHT_RATIO = 0.85;

/** Syncs keyboard height into meal input bar context — call from MealItemsSheetBody. */
export function useMealInputKeyboardHeight() {
  const actions = useMealInputBarActions();
  const setKeyboardHeightRef = useRef(actions?.setKeyboardHeight);
  setKeyboardHeightRef.current = actions?.setKeyboardHeight;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      console.log(
        '[meal-input-bar] keyboardWillShow height',
        event.endCoordinates.height,
      );
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
  /** Sheet body root, for callers that measure it (autocomplete dropdown anchoring). */
  rootRef?: RefObject<View | null>;
  onScroll?: () => void;
  onBackgroundPress?: () => void;
};

/**
 * Renders a meal sheet as header / scrollable item list / footer.
 *
 * The list absorbs the leftover space by shrinking, which only works while every node
 * from here up to the height-capped surface (`GlassSheetSurface`'s content view) can
 * shrink. Mount this directly as the `GlassBottomSheet` child — an intermediate wrapper
 * without `flexShrink: 1` breaks the chain, and the footer is then clipped off-screen
 * while the list grows to full content height and stops scrolling. Callers that need a
 * root of their own should use `rootRef` instead of adding a wrapper.
 */
export function MealItemsSheetBody({
  header,
  footer,
  children,
  scrollRef,
  rootRef,
  onScroll,
  onBackgroundPress,
}: MealItemsSheetBodyProps) {
  useMealInputKeyboardHeight();

  const setScrollRef = useCallback(
    (node: ScrollView | null) => {
      if (scrollRef) {
        scrollRef.current = node;
      }
    },
    [scrollRef],
  );

  const setRootRef = useCallback(
    (node: View | null) => {
      if (rootRef) {
        rootRef.current = node;
      }
    },
    [rootRef],
  );

  return (
    // collapsable={false} keeps the node measurable on Android — it is layout-only
    // otherwise and would be flattened away before `measureInWindow` can see it.
    <View ref={setRootRef} style={styles.root} collapsable={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.keyboardAvoid}>
        <View style={styles.body}>
          {header}
          <ScrollView
            ref={setScrollRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            onScroll={onScroll}
            scrollEventThrottle={16}>
            <Pressable
              style={styles.dismissTapArea}
              onPress={() => {
                onBackgroundPress?.();
              }}>
              {children}
            </Pressable>
          </ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    flexShrink: 1,
  },
  keyboardAvoid: {
    flexShrink: 1,
  },
  body: {
    flexShrink: 1,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
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
