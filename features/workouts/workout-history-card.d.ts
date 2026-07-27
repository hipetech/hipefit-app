import type { WithId } from '@/database';
import type { Workout } from '@/database/types';
import type { FC } from 'react';
import type { ColorSchemeName } from 'react-native';

export interface WorkoutHistoryCardProps {
  /** A completed / abandoned workout to render as a history row. */
  workout: WithId<Workout>;
  /** Island width (drives the iOS `Host` size). */
  width: number;
  /** Forced appearance for the iOS `Host`; omitted follows the device. */
  colorScheme?: ColorSchemeName;
}

/**
 * A single workout-history row. iOS renders a SwiftUI `Host` island; Android a
 * plain RN card.
 */
export declare const WorkoutHistoryCard: FC<WorkoutHistoryCardProps>;
