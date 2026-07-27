import type { FC } from 'react';
import type { ColorSchemeName } from 'react-native';

export interface EmptyCardProps {
  /** Centered muted message. */
  message: string;
  /** Island width (drives the iOS `Host` size). */
  width: number;
  /** Optional call-to-action button label. When omitted, no button renders. */
  actionLabel?: string;
  /** Handler for the optional action button. */
  onAction?: () => void;
  /** Forced appearance for the iOS `Host`; omitted follows the device. */
  colorScheme?: ColorSchemeName;
}

/**
 * Centered empty-state card with an optional outlined action. iOS renders a
 * SwiftUI `Host` island; Android a plain RN card.
 */
export declare const EmptyCard: FC<EmptyCardProps>;
