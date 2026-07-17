import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MEAL_INPUT_BAR_HEIGHT,
  MEAL_INPUT_KEYBOARD_GAP,
} from '@/components/scan/MealInputAccessoryBar';
import { useFoodAutocompleteOverlayState } from '@/components/scan/meal-food-autocomplete-overlay';
import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';

import {
  FOOD_AUTOCOMPLETE_LOADING_ROW_HEIGHT,
  FOOD_AUTOCOMPLETE_MAX_HEIGHT,
  FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT,
  FOOD_AUTOCOMPLETE_STATUS_TEXT_HEIGHT,
  type NameFieldAnchor,
  type SheetLayout,
} from './FoodNameAutocompleteDropdown';

export const FOOD_AUTOCOMPLETE_DROPDOWN_Z_INDEX = 1001;

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

function resolvePanelHeight(options: {
  maxHeightCap: number;
  isSearching: boolean;
  showStatusMessage: boolean;
  showEmptyState: boolean;
  resultCount: number;
}): number {
  let contentHeight = MIN_DROPDOWN_HEIGHT;

  if (options.isSearching) {
    contentHeight = FOOD_AUTOCOMPLETE_LOADING_ROW_HEIGHT;
  } else if (options.showStatusMessage || options.showEmptyState) {
    contentHeight = FOOD_AUTOCOMPLETE_STATUS_TEXT_HEIGHT;
  } else if (options.resultCount > 0) {
    contentHeight = resolveResultsContentHeight(options.resultCount);
  }

  return Math.min(contentHeight, options.maxHeightCap);
}

export function resolveFloatingBarDropdownPlacement(
  sheetLayout: SheetLayout,
  options: {
    keyboardHeight: number;
    windowHeight: number;
    preferredMaxHeight?: number;
  },
): FloatingBarDropdownPlacement {
  const preferredMaxHeight = options.preferredMaxHeight ?? FOOD_AUTOCOMPLETE_MAX_HEIGHT;
  const keyboardHeight = Math.max(0, options.keyboardHeight);
  const windowHeight = Math.max(0, options.windowHeight);

  const barTop = windowHeight - keyboardHeight - MEAL_INPUT_KEYBOARD_GAP - MEAL_INPUT_BAR_HEIGHT;
  const spaceAbove = Math.max(0, barTop - sheetLayout.y - DROPDOWN_GAP);
  const maxHeight = Math.min(
    preferredMaxHeight,
    Math.max(MIN_DROPDOWN_HEIGHT, spaceAbove),
  );

  return {
    mode: 'floating-bar',
    bottom: keyboardHeight + MEAL_INPUT_KEYBOARD_GAP + MEAL_INPUT_BAR_HEIGHT + DROPDOWN_GAP,
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
  const { t } = useTranslation();

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

  const basePlacement: ModalDropdownPlacement =
    overlay.placementMode === 'floating-bar'
      ? resolveFloatingBarDropdownPlacement(overlay.sheetLayout, {
          keyboardHeight: overlay.keyboardHeight,
          windowHeight: overlay.windowHeight,
        })
      : resolveFieldDropdownPlacement(overlay.anchor!, overlay.sheetLayout);

  const showEmptyState =
    !overlay.isSearching &&
    !overlay.rateLimited &&
    !overlay.searchUnavailable &&
    overlay.results.length === 0;
  const showStatusMessage = overlay.rateLimited || overlay.searchUnavailable;

  const panelHeight = resolvePanelHeight({
    maxHeightCap: basePlacement.maxHeight,
    isSearching: overlay.isSearching,
    showStatusMessage,
    showEmptyState,
    resultCount: overlay.results.length,
  });

  const placement: ModalDropdownPlacement =
    overlay.placementMode === 'floating-bar'
      ? basePlacement
      : resolveFieldDropdownPlacement(overlay.anchor!, overlay.sheetLayout, {
          panelHeight,
        });

  const resultsContentHeight = resolveResultsContentHeight(overlay.results.length);
  const resultsViewportHeight = Math.min(resultsContentHeight, placement.maxHeight);
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
                    kcal: Math.round(product.kcalPer100g),
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
