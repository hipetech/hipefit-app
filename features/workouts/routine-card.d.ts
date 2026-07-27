import type { WithId } from '@/database';
import type { Routine } from '@/database/types';
import type { FC } from 'react';
import type { ColorSchemeName } from 'react-native';

export interface RoutineCardProps {
  /** The routine to preview. */
  routine: WithId<Routine>;
  /** Forced appearance for the iOS `Host`; omitted follows the device. */
  colorScheme?: ColorSchemeName;
  /** Start handler (no-op placeholder for now). */
  onStart?: () => void;
}

/**
 * A routine preview card for the horizontal carousel. iOS renders a SwiftUI
 * `Host` island; Android a plain RN card.
 */
export declare const RoutineCard: FC<RoutineCardProps>;
