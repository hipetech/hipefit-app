import type { AvatarProps } from './avatar';
import { RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  font,
  foregroundColor,
  frame,
} from '@expo/ui/swift-ui/modifiers';
import { Image as ExpoImage } from 'expo-image';

import { getInitials } from '@/lib/format';
import { colors } from '@/theme/colors';

/**
 * Circular avatar (SwiftUI). Host-less — compose inside a screen's `Host`.
 * A remote/local `source` renders `expo-image` via `RNHostView` (SwiftUI
 * `Image` cannot load URLs); otherwise brand-tinted initials are shown.
 */
export const Avatar = ({ source, fallback, size = 40 }: AvatarProps) => {
  if (source) {
    return (
      <RNHostView matchContents>
        <ExpoImage
          source={source}
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
        background(colors.brand),
        clipShape('circle'),
      ]}
    >
      <Text
        modifiers={[
          font({ size: size * 0.4, weight: 'semibold' }),
          foregroundColor(colors.brandForeground),
        ]}
      >
        {getInitials(fallback)}
      </Text>
    </VStack>
  );
};
