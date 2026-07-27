import type { SeparatorProps } from './separator';
import { View } from 'react-native';

import { colors } from '@/theme/colors';

/** 1px divider (Android fallback): plain RN `View`. */
export const Separator = ({
  orientation = 'horizontal',
  length = 24,
}: SeparatorProps) => (
  <View
    style={
      orientation === 'vertical'
        ? { width: 1, height: length, backgroundColor: colors.separator }
        : { height: 1, width: '100%', backgroundColor: colors.separator }
    }
  />
);
