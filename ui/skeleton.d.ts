import type { FC } from 'react';

export interface SkeletonProps {
  /** Block width in points. */
  width: number;
  /** Block height in points. */
  height: number;
  /** Corner radius. Use a large value (e.g. `9999`) for pills/circles. @default 8 */
  radius?: number;
}

/**
 * Loading placeholder block. Host-less SwiftUI subtree on iOS; plain RN
 * fallback on Android.
 */
export declare const Skeleton: FC<SkeletonProps>;
