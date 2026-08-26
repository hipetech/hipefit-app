import { Divider, VStack } from '@expo/ui/swift-ui';
import { background, frame } from '@expo/ui/swift-ui/modifiers';

import { colors } from './colors';

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
 * 1px divider (SwiftUI). Host-less — compose inside a screen's `Host`.
 * `horizontal` uses the native `Divider` (fills width); `vertical` is a thin
 * fixed-height rule tinted with the separator color.
 */
export const Separator = ({
  orientation = 'horizontal',
  length = 24,
}: SeparatorProps) => {
  if (orientation === 'vertical') {
    return (
      <VStack
        modifiers={[
          frame({ width: 1, height: length }),
          background(colors.separator),
        ]}
      >
        <></>
      </VStack>
    );
  }

  return <Divider />;
};
