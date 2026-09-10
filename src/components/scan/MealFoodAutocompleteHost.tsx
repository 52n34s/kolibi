import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MEAL_INPUT_KEYBOARD_GAP,
  mealInputBarHeightForField,
} from '@/components/scan/MealInputAccessoryBar';
import { useMealInputBarValues } from '@/components/scan/meal-input-bar-context';
import { useFoodAutocompleteOverlayState } from '@/components/scan/meal-food-autocomplete-overlay';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import { formatKcal } from '@/utils/format';

import {
  FOOD_AUTOCOMPLETE_LOADING_ROW_HEIGHT,
  FOOD_AUTOCOMPLETE_MAX_HEIGHT,
  FOOD_AUTOCOMPLETE_MAX_VISIBLE_ROWS,
  FOOD_AUTOCOMPLETE_RESULT_PEEK,
  FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT,
  FOOD_AUTOCOMPLETE_STATUS_TEXT_HEIGHT,
  FOOD_AUTOCOMPLETE_TOP_SCREEN_PADDING,
  type NameFieldAnchor,
  type SheetLayout,
} from './FoodNameAutocompleteDropdown';

export const FOOD_AUTOCOMPLETE_DROPDOWN_Z_INDEX = 1001;
/** Pill switcher row above the suggestion list — compact segments plus its padding. */
export const FOOD_AUTOCOMPLETE_SUGGEST_HEADER_HEIGHT = 52;

const DROPDOWN_GAP = 8;
const DROPDOWN_GAP_DOWN = 4;
const MIN_DROPDOWN_HEIGHT = FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT;

export type FloatingBarDropdownPlacement = {
  mode: 'floating-bar';
  bottom: number;
  left: number;
  right: number;
  maxHeight: number;
};

export type FieldDropdownPlacement = {
  mode: 'field';
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  opensUpward: boolean;
};

export type ModalDropdownPlacement = FloatingBarDropdownPlacement | FieldDropdownPlacement;

function resolveResultsContentHeight(resultCount: number): number {
  return resultCount * FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT;
}

/**
 * Visible results height: grows with count up to 5 rows, capped by screen space.
 * When more content exists than fits, clip the last visible row (peek) so scroll is obvious.
 */
export function resolveResultsViewportHeight(options: {
  resultCount: number;
  maxHeightCap: number;
}): number {
  const { resultCount, maxHeightCap } = options;
  if (resultCount <= 0) {
    return MIN_DROPDOWN_HEIGHT;
  }

  const contentHeight = resolveResultsContentHeight(resultCount);
  const idealVisible =
    Math.min(resultCount, FOOD_AUTOCOMPLETE_MAX_VISIBLE_ROWS) *
    FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT;
  const capped = Math.min(idealVisible, Math.max(MIN_DROPDOWN_HEIGHT, maxHeightCap));

  if (contentHeight <= capped) {
    return contentHeight;
  }

  const peek = FOOD_AUTOCOMPLETE_RESULT_PEEK;
  const fullRows = Math.floor(
    Math.max(0, capped - peek) / FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT,
  );

  if (fullRows <= 0) {
    return Math.min(capped, FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT);
  }

  return Math.min(capped, fullRows * FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT + peek);
}

function resolvePanelHeight(options: {
  maxHeightCap: number;
  isSearching: boolean;
  showStatusMessage: boolean;
  showEmptyState: boolean;
  resultCount: number;
  /** Switcher row stacked above the list — eats from the same cap. */
  headerHeight?: number;
}): number {
  const headerHeight = options.headerHeight ?? 0;
  const bodyCap = Math.max(0, options.maxHeightCap - headerHeight);

  const bodyHeight = (() => {
    if (options.isSearching) {
      return Math.min(FOOD_AUTOCOMPLETE_LOADING_ROW_HEIGHT, bodyCap);
    }

    if (options.showStatusMessage || options.showEmptyState) {
      return Math.min(FOOD_AUTOCOMPLETE_STATUS_TEXT_HEIGHT, bodyCap);
    }

    if (options.resultCount > 0) {
      return resolveResultsViewportHeight({
        resultCount: options.resultCount,
        maxHeightCap: bodyCap,
      });
    }

    return Math.min(MIN_DROPDOWN_HEIGHT, bodyCap);
  })();

  return Math.min(options.maxHeightCap, headerHeight + bodyHeight);
}

/**
 * Floating-bar placement: grow upward from the input bar, overlaying sheet content.
 * Available height = dropdown bottom → top safe-area (+ padding), not sheet top edge.
 */
export function resolveFloatingBarDropdownPlacement(options: {
  keyboardHeight: number;
  windowHeight: number;
  topInset: number;
  /** Fixed bar height for the active input mode (single-line vs name). */
  barHeight: number;
  preferredMaxHeight?: number;
}): FloatingBarDropdownPlacement {
  const preferredMaxHeight = options.preferredMaxHeight ?? FOOD_AUTOCOMPLETE_MAX_HEIGHT;
  const keyboardHeight = Math.max(0, options.keyboardHeight);
  const windowHeight = Math.max(0, options.windowHeight);
  const topInset = Math.max(0, options.topInset);
  const barHeight = Math.max(0, options.barHeight);

  const bottom =
    keyboardHeight + MEAL_INPUT_KEYBOARD_GAP + barHeight + DROPDOWN_GAP;
  const dropdownBottomY = windowHeight - bottom;
  const usableTop = topInset + FOOD_AUTOCOMPLETE_TOP_SCREEN_PADDING;
  const spaceAbove = Math.max(0, dropdownBottomY - usableTop);
  const maxHeight = Math.min(
    preferredMaxHeight,
    Math.max(MIN_DROPDOWN_HEIGHT, spaceAbove),
  );

  return {
    mode: 'floating-bar',
    bottom,
    left: 0,
    right: 0,
    maxHeight,
  };
}

export function resolveFieldDropdownPlacement(
  anchor: NameFieldAnchor,
  sheetLayout: SheetLayout,
  options?: { preferredMaxHeight?: number; panelHeight?: number },
): FieldDropdownPlacement {
  const preferredMaxHeight = options?.preferredMaxHeight ?? FOOD_AUTOCOMPLETE_MAX_HEIGHT;
  const fieldBottomWindow = anchor.y + anchor.height;
  const spaceAbove = Math.max(0, anchor.y - sheetLayout.y - DROPDOWN_GAP);
  const spaceBelow = Math.max(
    0,
    sheetLayout.y + sheetLayout.height - fieldBottomWindow - DROPDOWN_GAP_DOWN,
  );
  const opensUpward = spaceBelow < preferredMaxHeight;
  const maxHeight = Math.min(
    preferredMaxHeight,
    Math.max(
      MIN_DROPDOWN_HEIGHT,
      opensUpward ? spaceAbove : spaceBelow,
    ),
  );
  const panelHeight = Math.min(options?.panelHeight ?? maxHeight, maxHeight);

  let top: number;
  if (opensUpward) {
    top = anchor.y - panelHeight - DROPDOWN_GAP;
  } else {
    top = fieldBottomWindow + DROPDOWN_GAP_DOWN;
  }

  return {
    mode: 'field',
    top: Math.max(0, top),
    left: anchor.x,
    width: anchor.width,
    maxHeight,
    opensUpward,
  };
}

export function MealFoodAutocompleteHost() {
  const overlay = useFoodAutocompleteOverlayState();
  const mealInputBarValues = useMealInputBarValues();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (!overlay?.visible || !overlay.sheetLayout) {
    return null;
  }

  if (overlay.placementMode === 'floating-bar') {
    if (overlay.keyboardHeight <= 0) {
      return null;
    }
  } else if (!overlay.anchor) {
    return null;
  }

  const preferredMaxHeight = FOOD_AUTOCOMPLETE_MAX_HEIGHT;
  const activeField = mealInputBarValues?.activeField?.field;
  // Floating-bar autocomplete only runs during name entry; still resolve via field type.
  const barHeight = mealInputBarHeightForField(activeField ?? 'name');
  const basePlacement: ModalDropdownPlacement =
    overlay.placementMode === 'floating-bar'
      ? resolveFloatingBarDropdownPlacement({
          keyboardHeight: overlay.keyboardHeight,
          windowHeight: overlay.windowHeight,
          topInset: insets.top,
          barHeight,
          preferredMaxHeight,
        })
      : resolveFieldDropdownPlacement(overlay.anchor!, overlay.sheetLayout, {
          preferredMaxHeight,
        });

  const showEmptyState =
    !overlay.isSearching &&
    !overlay.rateLimited &&
    !overlay.searchUnavailable &&
    overlay.results.length === 0;
  const showStatusMessage = overlay.rateLimited || overlay.searchUnavailable;

  const resultCount = overlay.results.length;
  const maxHeightCap = basePlacement.maxHeight;
  const showSuggestionSwitcher =
    overlay.suggestionMode != null && overlay.onSuggestionModeChange != null;
  const headerHeight = showSuggestionSwitcher ? FOOD_AUTOCOMPLETE_SUGGEST_HEADER_HEIGHT : 0;

  const panelHeight = resolvePanelHeight({
    maxHeightCap,
    isSearching: overlay.isSearching,
    showStatusMessage,
    showEmptyState,
    resultCount,
    headerHeight,
  });

  const placement: ModalDropdownPlacement =
    overlay.placementMode === 'floating-bar'
      ? basePlacement
      : resolveFieldDropdownPlacement(overlay.anchor!, overlay.sheetLayout, {
          preferredMaxHeight,
          panelHeight,
        });

  const resultsContentHeight = resolveResultsContentHeight(resultCount);
  const resultsViewportHeight =
    resultCount > 0
      ? resolveResultsViewportHeight({
          resultCount,
          maxHeightCap: Math.max(0, placement.maxHeight - headerHeight),
        })
      : Math.max(0, panelHeight - headerHeight);
  const resultsScrollEnabled = resultsContentHeight > resultsViewportHeight;

  const containerStyle =
    placement.mode === 'floating-bar'
      ? {
          bottom: placement.bottom,
          left: placement.left,
          right: placement.right,
          height: panelHeight,
          maxHeight: placement.maxHeight,
        }
      : {
          top: placement.top,
          left: placement.left,
          width: placement.width,
          height: panelHeight,
          maxHeight: placement.maxHeight,
        };

  return (
    <View pointerEvents="box-none" style={[styles.host, containerStyle]}>
      <View style={[styles.panel, { height: panelHeight, maxHeight: placement.maxHeight }]}>
        {showSuggestionSwitcher ? (
          <View style={styles.suggestionSwitcherRow}>
            <PillSegmentSwitcher
              compact
              value={overlay.suggestionMode!}
              segments={[
                { id: 'recent', label: t('home.foodSearch.suggestionsRecent') },
                { id: 'frequent', label: t('home.foodSearch.suggestionsFrequent') },
              ]}
              onChange={(mode) => overlay.onSuggestionModeChange?.(mode)}
            />
          </View>
        ) : null}

        {overlay.isSearching ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#4F46E5" size="small" />
            <Text style={styles.loadingText}>{t('home.foodSearch.searching')}</Text>
          </View>
        ) : null}

        {overlay.rateLimited ? (
          <Text style={styles.rateLimitText}>{t('home.foodSearch.rateLimited')}</Text>
        ) : null}

        {overlay.searchUnavailable ? (
          <Text style={styles.unavailableText}>{t('home.foodSearch.searchUnavailable')}</Text>
        ) : null}

        {showEmptyState ? (
          <Text style={styles.emptyText}>{t('home.foodSearch.noResultsHint')}</Text>
        ) : null}

        {!overlay.isSearching && overlay.results.length > 0 ? (
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            scrollEnabled={resultsScrollEnabled}
            showsVerticalScrollIndicator={resultsScrollEnabled}
            style={[styles.resultsScroll, { maxHeight: resultsViewportHeight }]}>
            {overlay.results.map((product) => (
              <Pressable
                key={product.offId}
                accessibilityRole="button"
                style={styles.resultRow}
                onPress={() => overlay.onSelect(product)}>
                <Text numberOfLines={2} style={styles.resultName}>
                  {product.name}
                </Text>
                {product.brand ? (
                  <Text numberOfLines={1} style={styles.resultBrand}>
                    {product.brand}
                  </Text>
                ) : null}
                <Text style={styles.resultKcal}>
                  {t('home.foodSearch.kcalPer100g', {
                    kcal: formatKcal(product.kcalPer100g),
                  })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    zIndex: FOOD_AUTOCOMPLETE_DROPDOWN_Z_INDEX,
    elevation: FOOD_AUTOCOMPLETE_DROPDOWN_Z_INDEX,
  },
  panel: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#4B5563',
  },
  rateLimitText: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#B45309',
  },
  unavailableText: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  emptyText: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  suggestionSwitcherRow: {
    height: FOOD_AUTOCOMPLETE_SUGGEST_HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  resultsScroll: {
    flexGrow: 0,
  },
  resultRow: {
    minHeight: FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(156, 163, 175, 0.4)',
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  resultBrand: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  resultKcal: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
    color: '#4F46E5',
  },
});
