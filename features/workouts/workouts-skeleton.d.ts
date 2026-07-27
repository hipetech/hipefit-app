import type { FC } from 'react';
import type { ColorSchemeName } from 'react-native';

export interface WorkoutsSkeletonProps {
  /** Full content width, for the history-row placeholders. */
  width: number;
  /** Forced appearance for the iOS `Host`; omitted follows the device. */
  colorScheme?: ColorSchemeName;
}

/**
 * Loading placeholder for the Workouts screen. iOS renders a SwiftUI `Host`
 * island of `Skeleton` blocks; Android a plain RN layout.
 */
export declare const WorkoutsSkeleton: FC<WorkoutsSkeletonProps>;
