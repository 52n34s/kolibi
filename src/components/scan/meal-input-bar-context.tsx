import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type MealStepperField = 'quantity' | 'kcal' | 'name';

export type ActiveMealField = {
  itemId: string;
  field: MealStepperField;
  productName: string;
  fieldLabel: string;
  displayValue: string;
  /** Native caret index into `displayValue`. Defaults to the end when omitted. */
  caretIndex?: number;
};

type MealInputBarValues = {
  activeField: ActiveMealField | null;
  keyboardHeight: number;
};

type MealInputBarActions = {
  setActiveField: (field: ActiveMealField) => void;
  updateDisplayValue: (displayValue: string, caretIndex?: number) => void;
  updateCaretIndex: (caretIndex: number) => void;
  clearActiveField: (itemId: string, field: MealStepperField) => void;
  setKeyboardHeight: (height: number) => void;
};

const MealInputBarValuesContext = createContext<MealInputBarValues | null>(null);
const MealInputBarActionsContext = createContext<MealInputBarActions | null>(null);

export function MealInputBarProvider({ children }: { children: ReactNode }) {
  const [activeField, setActiveFieldState] = useState<ActiveMealField | null>(null);
  const [keyboardHeight, setKeyboardHeightState] = useState(0);

  const setActiveField = useCallback((field: ActiveMealField) => {
    setActiveFieldState(field);
  }, []);

  const updateDisplayValue = useCallback((displayValue: string, caretIndex?: number) => {
    setActiveFieldState((current) =>
      current
        ? {
            ...current,
            displayValue,
            caretIndex: caretIndex ?? current.caretIndex,
          }
        : current,
    );
  }, []);

  const updateCaretIndex = useCallback((caretIndex: number) => {
    setActiveFieldState((current) =>
      current ? { ...current, caretIndex } : current,
    );
  }, []);

  const clearActiveField = useCallback((itemId: string, field: MealStepperField) => {
    setActiveFieldState((current) =>
      current?.itemId === itemId && current.field === field ? null : current,
    );
  }, []);

  const setKeyboardHeight = useCallback((height: number) => {
    setKeyboardHeightState(height);
  }, []);

  const values = useMemo<MealInputBarValues>(
    () => ({ activeField, keyboardHeight }),
    [activeField, keyboardHeight],
  );

  const actions = useMemo<MealInputBarActions>(
    () => ({
      setActiveField,
      updateDisplayValue,
      updateCaretIndex,
      clearActiveField,
      setKeyboardHeight,
    }),
    [
      clearActiveField,
      setActiveField,
      setKeyboardHeight,
      updateCaretIndex,
      updateDisplayValue,
    ],
  );

  return (
    <MealInputBarActionsContext.Provider value={actions}>
      <MealInputBarValuesContext.Provider value={values}>
        {children}
      </MealInputBarValuesContext.Provider>
    </MealInputBarActionsContext.Provider>
  );
}

export function useMealInputBarValues() {
  return useContext(MealInputBarValuesContext);
}

export function useMealInputBarActions() {
  return useContext(MealInputBarActionsContext);
}
