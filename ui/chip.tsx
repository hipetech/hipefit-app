import type { ColorValue } from 'react-native';
import { Text } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  fixedSize,
  font,
  foregroundStyle,
  lineLimit,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';

/**
 * A chip conveys *status*, so variants map to the system status colors rather
 * than to one accent. All variants share a neutral fill; the label carries the
 * color, which is the system's own status idiom and stays legible in both
 * appearances.
 *
 * `primary` is retained as an alias of `success` so existing call sites keep
 * working — prefer `success` / `warning` in new code.
 */
export type ChipVariant = 'primary' | 'secondary' | 'success' | 'warning';

export interface ChipProps {
  /** Text shown inside the capsule. */
  label: string;
  /** Status treatment. @default 'secondary' */
  variant?: ChipVariant;
  /** Size preset. @default 'sm' */
  size?: 'sm';
}

/** Status color carried by the label; the fill stays neutral for every variant. */
const labelColor: Record<ChipVariant, ColorValue> = {
  primary: colors.systemGreen,
  success: colors.systemGreen,
  warning: colors.systemOrange,
  secondary: colors.label,
};

/**
 * Small capsule label (status / count / difficulty badges), in SwiftUI.
 * Host-less — compose inside a screen's `Host`.
 */
export const Chip = ({ label, variant = 'secondary' }: ChipProps) => (
  <Text
    modifiers={[
      // `caption` resolves to the same 12pt at the default Dynamic Type size,
      // but unlike a fixed `size` it scales with the user's setting.
      font({ textStyle: 'caption', weight: 'semibold' }),
      foregroundStyle(labelColor[variant]),
      lineLimit(1),
      padding({ horizontal: 10, vertical: 4 }),
      background(colors.tertiarySystemFill),
      clipShape('capsule'),
      // Outermost: keeps the capsule at its ideal width so a greedy sibling
      // (e.g. an expanding title in the same HStack) can't compress it.
      fixedSize({ horizontal: true, vertical: false }),
    ]}
  >
    {label}
  </Text>
);
