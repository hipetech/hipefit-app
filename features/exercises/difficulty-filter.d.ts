import type { FC } from 'react';

export interface DifficultyFilterProps {
  /** Currently selected difficulty (`all` | `beginner` | `intermediate` | `advanced`). */
  value: string;
  /** Fired with the newly selected value. */
  onValueChange: (value: string) => void;
}

/**
 * Difficulty segmented control. iOS renders a native SwiftUI segmented
 * `Picker`; Android falls back to a native menu `Picker`. Own-`Host` island.
 */
export declare const DifficultyFilter: FC<DifficultyFilterProps>;
