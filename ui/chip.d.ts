import type { FC } from 'react';

export interface ChipProps {
  /** Text shown inside the capsule. */
  label: string;
  /** `primary` uses the brand fill; `secondary` a muted surface. @default 'secondary' */
  variant?: 'primary' | 'secondary';
  /** Size preset. @default 'sm' */
  size?: 'sm';
}

/**
 * Small capsule label (status / count / difficulty badges). Host-less SwiftUI
 * subtree on iOS; plain RN fallback on Android.
 */
export declare const Chip: FC<ChipProps>;
