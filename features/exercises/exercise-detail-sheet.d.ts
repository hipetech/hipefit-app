import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import type { FC } from 'react';

export interface ExerciseDetailSheetProps {
  /** Exercise to show, or `null` when nothing is selected. */
  exercise: MergedExercise | null;
  /** Whether the sheet is presented. */
  isPresented: boolean;
  /** Dismiss the sheet (Close button, swipe-down, or overlay tap). */
  onClose: () => void;
  /** "Add to Workout" action (currently just dismisses). */
  onAdd: () => void;
}

/**
 * Exercise detail sheet. iOS renders a native SwiftUI `BottomSheet`; Android
 * falls back to an RN `Modal`. Own-`Host` island (self-presenting overlay).
 */
export declare const ExerciseDetailSheet: FC<ExerciseDetailSheetProps>;
