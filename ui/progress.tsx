import type { ViewStyle } from 'react-native';
import { View } from 'react-native';

import { colors } from '@/theme/colors';

interface ProgressProps {
  /** Fill percentage, 0–100. */
  value?: number;
  /** Extra styles for the track. */
  style?: ViewStyle;
  /** Extra styles for the filled indicator. */
  indicatorStyle?: ViewStyle;
}

/**
 * Simple determinate progress bar. Plain RN `View` track + indicator styled
 * from `@/theme/colors` (was `bg-default/20` track, `bg-foreground` bar).
 */
export function Progress({ value = 0, style, indicatorStyle }: ProgressProps) {
  return (
    <View
      style={[
        {
          height: 8,
          width: '100%',
          overflow: 'hidden',
          borderRadius: 9999,
          backgroundColor: colors.tertiarySystemBackground,
        },
        style,
      ]}
    >
      <View
        style={[
          {
            height: '100%',
            borderRadius: 9999,
            backgroundColor: colors.label,
            width: `${Math.min(100, Math.max(0, value))}%`,
          },
          indicatorStyle,
        ]}
      />
    </View>
  );
}
