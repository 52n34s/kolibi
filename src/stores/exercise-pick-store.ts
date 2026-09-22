import { create } from 'zustand';

type ExercisePickState = {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  toggleId: (id: string) => void;
  /** Returns current selection and clears the store. */
  consumeSelection: () => string[];
  clear: () => void;
};

export const useExercisePickStore = create<ExercisePickState>((set, get) => ({
  selectedIds: [],

  setSelectedIds: (ids) => set({ selectedIds: [...ids] }),

  toggleId: (id) => {
    const current = get().selectedIds;
    if (current.includes(id)) {
      set({ selectedIds: current.filter((row) => row !== id) });
      return;
    }
    set({ selectedIds: [...current, id] });
  },

  consumeSelection: () => {
    const ids = get().selectedIds;
    set({ selectedIds: [] });
    return ids;
  },

  clear: () => set({ selectedIds: [] }),
}));
