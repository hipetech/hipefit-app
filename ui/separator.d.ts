import type { FC } from 'react';

export interface SeparatorProps {
  /** @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Length of a `vertical` separator in points (height). Ignored for
   * `horizontal`, which fills the available width. @default 24
   */
  length?: number;
}

/**
 * 1px divider. Host-less SwiftUI subtree on iOS; plain RN fallback on Android.
 */
export declare const Separator: FC<SeparatorProps>;
