import type React from 'react';
import { Circle, RNHostView, Text, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  clipShape,
  font,
  foregroundStyle,
  frame,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import { Image as ExpoImage } from 'expo-image';

import { AVATAR_BORDER_COLOR } from './avatar-backgrounds';
import { getAvatarGradient, getAvatarInitials } from './avatar-utils';

export interface AvatarProps {
  /** Remote or local image URI. When absent, initials are shown. */
  source?: string | null;
  /** Name used to derive fallback initials. */
  fallback: string;
  /** Stable user identity used to choose the fallback gradient. */
  seed: string;
  /** Diameter in points. @default 40 */
  size?: number;
}

/** Circular profile image with a deterministic initials fallback. */
export const Avatar: React.FC<AvatarProps> = ({
  source,
  fallback,
  seed,
  size = 40,
}) => {
  if (source) {
    return (
      <RNHostView matchContents>
        {/*
         * `pointerEvents="none"` is load-bearing: `RNHostView` attaches an
         * `RCTSurfaceTouchHandler` to the hosted RN view, whose gesture
         * recognizer would otherwise swallow taps meant for an enclosing
         * SwiftUI `Button` (the Settings profile row). An avatar is purely
         * presentational, so it never wants touches of its own.
         */}
        <ExpoImage
          source={source}
          accessible={false}
          contentFit="cover"
          pointerEvents="none"
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </RNHostView>
    );
  }

  const gradient = getAvatarGradient(seed);

  return (
    <ZStack
      alignment="center"
      modifiers={[
        accessibilityHidden(true),
        frame({ width: size, height: size }),
        clipShape('circle'),
      ]}
    >
      <Circle
        modifiers={[
          foregroundStyle({
            type: 'linearGradient',
            colors: gradient.colors,
            startPoint: gradient.startPoint,
            endPoint: gradient.endPoint,
          }),
          frame({ width: size, height: size }),
          strokeBorder({
            color: AVATAR_BORDER_COLOR,
            style: { lineWidth: 1 },
            shape: 'circle',
          }),
        ]}
      />
      {/*
       * Deliberately a fixed `size`, not a `textStyle` — the one place in the
       * app exempt from the Dynamic Type rule. The initials are sized relative
       * to a caller-supplied pixel circle that cannot scale, and the image branch
       * above uses that same fixed size. Both callers show the display name
       * beside this redundant presentation, so holding the initials still loses
       * no information.
       */}
      <Text
        modifiers={[
          font({ size: size * 0.4, weight: 'semibold' }),
          foregroundStyle(gradient.foregroundColor),
        ]}
      >
        {getAvatarInitials(fallback)}
      </Text>
    </ZStack>
  );
};
