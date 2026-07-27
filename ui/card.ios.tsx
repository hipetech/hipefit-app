import type { CardProps } from './card';
import { VStack } from '@expo/ui/swift-ui';
import {
  background,
  cornerRadius,
  frame,
  padding,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';

/**
 * Surface container (SwiftUI). Host-less — compose inside a screen's `Host`.
 * Modifiers are applied inner→outer: padding, fill, clip, then optional border
 * and fixed width.
 */
export const Card = ({
  children,
  padding: paddingValue = 16,
  spacing = 12,
  radius = 16,
  background: backgroundColor = colors.secondarySystemBackground,
  bordered = false,
  borderColor = colors.brand,
  alignment = 'leading',
  width,
}: CardProps) => {
  const modifiers = [
    padding({ all: paddingValue }),
    background(backgroundColor),
    cornerRadius(radius),
    ...(bordered
      ? [
          strokeBorder({
            color: borderColor,
            style: { lineWidth: 2 },
            shape: 'roundedRectangle' as const,
            cornerRadius: radius,
          }),
        ]
      : []),
    ...(width != null ? [frame({ width })] : []),
  ];

  return (
    <VStack spacing={spacing} alignment={alignment} modifiers={modifiers}>
      {children}
    </VStack>
  );
};
