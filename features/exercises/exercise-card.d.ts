import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import type { FC } from 'react';

export interface ExerciseCardProps {
  exercise: MergedExercise;
  onSelect: (exercise: MergedExercise) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Exercise list card. Hybrid on iOS: the RN surface + remote image + Reanimated
 * expand/collapse stay in RN (reliable inside the recycled `LegendList`), with
 * the native text column and expanded actions as two `Host` islands. Android
 * falls back to a fully-RN card with the same Reanimated animation.
 */
export declare const ExerciseCard: FC<ExerciseCardProps>;
