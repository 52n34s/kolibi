import { create } from 'zustand';

import type { Exercise } from '@/lib/workouts/types';

type ExerciseImageViewerState = {
  exercise: Exercise | null;
  /** Count of open GlassBottomSheet modals — inline host when > 0. */
  sheetModalDepth: number;
  openExerciseImage: (exercise: Exercise) => void;
  closeExerciseImage: () => void;
  enterSheetModal: () => void;
  leaveSheetModal: () => void;
};

export const useExerciseImageViewerStore = create<ExerciseImageViewerState>((set) => ({
  exercise: null,
  sheetModalDepth: 0,
  openExerciseImage: (exercise) => set({ exercise }),
  closeExerciseImage: () => set({ exercise: null }),
  enterSheetModal: () =>
    set((state) => ({ sheetModalDepth: state.sheetModalDepth + 1 })),
  leaveSheetModal: () =>
    set((state) => {
      const sheetModalDepth = Math.max(0, state.sheetModalDepth - 1);
      // Clear exercise when the last sheet modal closes so the global host does
      // not present its Modal in the same frame as the sheet dismiss (UIKit deadlock).
      if (sheetModalDepth === 0) {
        return { sheetModalDepth, exercise: null };
      }
      return { sheetModalDepth };
    }),
}));
