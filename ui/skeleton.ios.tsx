import type { SkeletonProps } from './skeleton';
import { VStack } from '@expo/ui/swift-ui';
import { background, cornerRadius, frame } from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';

/**
 * Loading placeholder block (SwiftUI). Host-less — compose inside a screen's
 * `Host`. A muted rounded rectangle at the given size.
 */
export const Skeleton = ({ width, height, radius = 8 }: SkeletonProps) => (
  <VStack
    modifiers={[
      frame({ width, height }),
      background(colors.tertiarySystemBackground),
      cornerRadius(radius),
    ]}
  >
    <></>
  </VStack>
);
