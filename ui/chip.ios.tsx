import type { ChipProps } from './chip';
import { Text } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  font,
  foregroundColor,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';

/**
 * Small capsule label (SwiftUI). Host-less — compose inside a screen's `Host`.
 */
export const Chip = ({ label, variant = 'secondary' }: ChipProps) => {
  const isPrimary = variant === 'primary';

  return (
    <Text
      modifiers={[
        font({ size: 12, weight: 'semibold' }),
        foregroundColor(isPrimary ? colors.brandForeground : colors.label),
        padding({ horizontal: 10, vertical: 4 }),
        background(isPrimary ? colors.brand : colors.tertiarySystemBackground),
        clipShape('capsule'),
      ]}
    >
      {label}
    </Text>
  );
};
