import type { CardProps } from './card';
import { View } from 'react-native';

import { colors } from '@/theme/colors';

/** Surface container (Android fallback): plain RN `View`. */
export const Card = ({
  children,
  padding = 16,
  spacing = 12,
  radius = 16,
  background = colors.secondarySystemBackground,
  bordered = false,
  borderColor = colors.brand,
  alignment = 'leading',
  width,
}: CardProps) => (
  <View
    style={{
      padding,
      gap: spacing,
      borderRadius: radius,
      backgroundColor: background,
      alignItems:
        alignment === 'center'
          ? 'center'
          : alignment === 'trailing'
            ? 'flex-end'
            : 'flex-start',
      ...(bordered ? { borderWidth: 2, borderColor } : {}),
      ...(width != null ? { width } : {}),
    }}
  >
    {children}
  </View>
);
