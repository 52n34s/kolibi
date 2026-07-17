import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';

export const FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT = 76;
export const FOOD_AUTOCOMPLETE_MAX_VISIBLE_ROWS = 5;
export const FOOD_AUTOCOMPLETE_MAX_HEIGHT =
  FOOD_AUTOCOMPLETE_RESULT_ROW_HEIGHT * FOOD_AUTOCOMPLETE_MAX_VISIBLE_ROWS;
export const FOOD_AUTOCOMPLETE_LOADING_ROW_HEIGHT = 44;
export const FOOD_AUTOCOMPLETE_STATUS_TEXT_HEIGHT = 42;
const DROPDOWN_GAP = 8;
const DROPDOWN_GAP_DOWN = 4;
const MIN_DROPDOWN_HEIGHT = 80;

export type NameFieldAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SheetLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DropdownPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  opensUpward: boolean;
};

type FoodNameAutocompleteDropdownProps = {
  visible: boolean;
  anchor: NameFieldAnchor | null;
  sheetLayout: SheetLayout | null;
  keyboardHeight: number;
  windowHeight: number;
  results: FoodSearchProduct[];
  isSearching: boolean;
  rateLimited: boolean;
  onSelect: (product: FoodSearchProduct) => void;
  onInteractionStart?: () => void;
};

export function resolveDropdownPlacement(
  anchor: NameFieldAnchor,
  sheetLayout: SheetLayout,
  options: {
    keyboardHeight: number;
    windowHeight: number;
    preferredMaxHeight?: number;
  },
): DropdownPlacement {
  const preferredMaxHeight = options.preferredMaxHeight ?? FOOD_AUTOCOMPLETE_MAX_HEIGHT;
  const keyboardHeight = Math.max(0, options.keyboardHeight);
  const windowHeight = Math.max(0, options.windowHeight);

  const relativeTop = anchor.y - sheetLayout.y;
  const relativeLeft = anchor.x - sheetLayout.x;
  const fieldBottomRelative = relativeTop + anchor.height;
  const fieldBottomWindow = anchor.y + anchor.height;

  const spaceAbove = Math.max(0, relativeTop - DROPDOWN_GAP);
  const spaceBelow =
    keyboardHeight > 0 && windowHeight > 0
      ? Math.max(0, windowHeight - keyboardHeight - fieldBottomWindow - DROPDOWN_GAP_DOWN)
      : Math.max(0, sheetLayout.height - fieldBottomRelative - DROPDOWN_GAP_DOWN);

  const opensUpward = keyboardHeight > 0 || spaceBelow < preferredMaxHeight;

  let maxHeight: number;
  let top: number;

  if (opensUpward) {
    maxHeight = Math.min(preferredMaxHeight, Math.max(MIN_DROPDOWN_HEIGHT, spaceAbove));
    top = relativeTop - maxHeight - DROPDOWN_GAP;
  } else {
    maxHeight = Math.min(preferredMaxHeight, Math.max(MIN_DROPDOWN_HEIGHT, spaceBelow));
    top = fieldBottomRelative + DROPDOWN_GAP_DOWN;
  }

  return {
    top: Math.max(0, top),
    left: relativeLeft,
    width: anchor.width,
    maxHeight,
    opensUpward,
  };
}

export function FoodNameAutocompleteDropdown({
  visible,
  anchor,
  sheetLayout,
  keyboardHeight,
  windowHeight,
  results,
  isSearching,
  rateLimited,
  onSelect,
  onInteractionStart,
}: FoodNameAutocompleteDropdownProps) {
  const { t } = useTranslation();

  if (!visible || !anchor || !sheetLayout) {
    return null;
  }

  const placement = resolveDropdownPlacement(anchor, sheetLayout, {
    keyboardHeight,
    windowHeight,
  });
  const showEmptyState = !isSearching && !rateLimited && results.length === 0;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          top: placement.top,
          left: placement.left,
          width: placement.width,
          maxHeight: placement.maxHeight,
        },
      ]}>
      <View
        style={[styles.panel, { maxHeight: placement.maxHeight }]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={() => {
          onInteractionStart?.();
        }}>
        {isSearching ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#4F46E5" size="small" />
            <Text style={styles.loadingText}>{t('home.foodSearch.searching')}</Text>
          </View>
        ) : null}

        {rateLimited ? (
          <Text style={styles.rateLimitText}>{t('home.foodSearch.rateLimited')}</Text>
        ) : null}

        {showEmptyState ? (
          <Text style={styles.emptyText}>{t('home.foodSearch.noResultsHint')}</Text>
        ) : null}

        {!isSearching && results.length > 0 ? (
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={[styles.resultsScroll, { maxHeight: placement.maxHeight }]}>
            {results.map((product) => (
              <Pressable
                key={product.offId}
                accessibilityRole="button"
                style={styles.resultRow}
                onPressIn={() => {
                  onInteractionStart?.();
                }}
                onPress={() => onSelect(product)}>
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
  container: {
    position: 'absolute',
    zIndex: 50,
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
    elevation: 8,
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
