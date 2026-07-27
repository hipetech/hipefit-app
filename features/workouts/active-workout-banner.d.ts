import type { WithId } from '@/database';
import type { Workout } from '@/database/types';
import type { FC } from 'react';
import type { ColorSchemeName } from 'react-native';

export interface ActiveWorkoutBannerProps {
  /** The in-progress workout to surface. */
  workout: WithId<Workout>;
  /** Island width (drives the iOS `Host` size). */
  width: number;
  /** Forced appearance for the iOS `Host`; omitted follows the device. */
  colorScheme?: ColorSchemeName;
  /** Continue handler (no-op placeholder for now). */
  onContinue?: () => void;
}

/**
 * Accent-bordered banner shown while a workout is in progress. iOS renders a
 * SwiftUI `Host` island; Android a plain RN card.
 */
export declare const ActiveWorkoutBanner: FC<ActiveWorkoutBannerProps>;
