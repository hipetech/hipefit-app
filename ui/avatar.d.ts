import type { FC } from 'react';

export interface AvatarProps {
  /** Remote or local image URI. When absent, initials are shown. */
  source?: string | null;
  /** Name used to derive fallback initials (via `getInitials`). */
  fallback: string;
  /** Diameter in points. @default 40 */
  size?: number;
}

/**
 * Circular avatar with an initials fallback. Host-less SwiftUI subtree on iOS
 * (image via `RNHostView` + `expo-image`); plain RN fallback on Android.
 */
export declare const Avatar: FC<AvatarProps>;
