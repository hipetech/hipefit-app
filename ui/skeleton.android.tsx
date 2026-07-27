import type { SkeletonProps } from './skeleton';
import { View } from 'react-native';

import { colors } from '@/theme/colors';

/** Loading placeholder block (Android fallback): plain RN `View`. */
export const Skeleton = ({ width, height, radius = 8 }: SkeletonProps) => (
  <View
    style={{
      width,
      height,
      borderRadius: radius,
      backgroundColor: colors.tertiarySystemBackground,
    }}
  />
);
