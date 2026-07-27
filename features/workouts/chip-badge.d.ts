import type { FC } from 'react';
import type { ColorSchemeName } from 'react-native';

export interface ChipBadgeProps {
  /** Text shown inside the capsule. */
  label: string;
  /** Fill style. @default 'secondary' */
  variant?: 'primary' | 'secondary';
  /** Forced appearance for the iOS `Host`; omitted follows the device. */
  colorScheme?: ColorSchemeName;
}

/**
 * A standalone `Chip` badge usable in RN scaffolding. iOS wraps the `Chip`
 * primitive in its own SwiftUI `Host`; Android renders the RN `Chip` directly.
 */
export declare const ChipBadge: FC<ChipBadgeProps>;
