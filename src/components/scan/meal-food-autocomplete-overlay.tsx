import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  NameFieldAnchor,
  SheetLayout,
} from '@/components/scan/FoodNameAutocompleteDropdown';
import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';

export type FoodAutocompletePlacementMode = 'floating-bar' | 'field';

export type FoodAutocompleteOverlayState = {
  visible: boolean;
  placementMode: FoodAutocompletePlacementMode;
  anchor: NameFieldAnchor | null;
  sheetLayout: SheetLayout | null;
  keyboardHeight: number;
  windowHeight: number;
  results: FoodSearchProduct[];
  isSearching: boolean;
  rateLimited: boolean;
  searchUnavailable: boolean;
  onSelect: (product: FoodSearchProduct) => void;
};

type FoodAutocompleteOverlayActions = {
  setOverlayState: (state: FoodAutocompleteOverlayState | null) => void;
};

const FoodAutocompleteOverlayStateContext =
  createContext<FoodAutocompleteOverlayState | null>(null);
const FoodAutocompleteOverlayActionsContext =
  createContext<FoodAutocompleteOverlayActions | null>(null);

export function FoodAutocompleteOverlayProvider({ children }: { children: ReactNode }) {
  const [overlayState, setOverlayStateInternal] =
    useState<FoodAutocompleteOverlayState | null>(null);

  const setOverlayState = useCallback((state: FoodAutocompleteOverlayState | null) => {
    setOverlayStateInternal(state);
  }, []);

  const actions = useMemo<FoodAutocompleteOverlayActions>(
    () => ({ setOverlayState }),
    [setOverlayState],
  );

  return (
    <FoodAutocompleteOverlayActionsContext.Provider value={actions}>
      <FoodAutocompleteOverlayStateContext.Provider value={overlayState}>
        {children}
      </FoodAutocompleteOverlayStateContext.Provider>
    </FoodAutocompleteOverlayActionsContext.Provider>
  );
}

export function useFoodAutocompleteOverlayActions() {
  const context = useContext(FoodAutocompleteOverlayActionsContext);
  if (!context) {
    throw new Error(
      'useFoodAutocompleteOverlayActions must be used within FoodAutocompleteOverlayProvider',
    );
  }
  return context;
}

export function useFoodAutocompleteOverlayState() {
  return useContext(FoodAutocompleteOverlayStateContext);
}

export function resolveFoodAutocompletePlacementMode(
  keyboardHeight: number,
  hasNameAutocompleteSession: boolean,
): FoodAutocompletePlacementMode {
  return keyboardHeight > 0 && hasNameAutocompleteSession ? 'floating-bar' : 'field';
}
