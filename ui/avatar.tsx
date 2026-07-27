import { RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  font,
  foregroundStyle,
  frame,
} from '@expo/ui/swift-ui/modifiers';
import { Image as ExpoImage } from 'expo-image';

import { getInitials } from '@/lib/format';
import { colors } from '@/theme/colors';

export interface AvatarProps {
  /** Remote or local image URI. When absent, initials are shown. */
  source?: string | null;
  /** Name used to derive fallback initials (via `getInitials`). */
  fallback: string;
  /** Diameter in points. @default 40 */
  size?: number;
}

/**
 * Circular avatar with an initials fallback (SwiftUI). Host-less — compose
 * inside a screen's `Host`.
 * A remote/local `source` renders `expo-image` via `RNHostView` (SwiftUI
 * `Image` cannot load URLs); otherwise initials are shown on a neutral fill —
 * the system placeholder treatment used by Contacts and Messages.
 */
export const Avatar = ({ source, fallback, size = 40 }: AvatarProps) => {
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
          pointerEvents="none"
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </RNHostView>
    );
  }

  return (
    <VStack
      alignment="center"
      modifiers={[
        frame({ width: size, height: size, alignment: 'center' }),
        background(colors.systemFill),
        clipShape('circle'),
      ]}
    >
      {/*
       * Deliberately a fixed `size`, not a `textStyle` — the one place in the
       * app exempt from the Dynamic Type rule. The initials are sized *relative
       * to the circle*, and the circle is a caller-supplied pixel `size` that
       * cannot scale: `@expo/ui` exposes no `ScaledMetric`, and the `source`
       * branch above hands the very same `size` to `expo-image`, which has no
       * Dynamic Type support at all. A `textStyle` here would therefore grow
       * the glyphs inside a fixed circle until they clip, *and* make one avatar
       * render differently from the other for an identical `size` prop. The
       * initials are also redundant rather than informational — the only caller
       * (the Settings profile row) shows the display name immediately beside
       * them — so nothing is lost by holding them still.
       */}
      <Text
        modifiers={[
          font({ size: size * 0.4, weight: 'semibold' }),
          foregroundStyle(colors.label),
        ]}
      >
        {getInitials(fallback)}
      </Text>
    </VStack>
  );
};
