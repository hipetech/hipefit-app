import type { WorkoutsSkeletonProps } from './workouts-skeleton';
import { View } from 'react-native';

import { Skeleton } from '@/ui/skeleton';

/** Workouts loading state (Android fallback): plain RN skeleton layout. */
export const WorkoutsSkeleton = ({ width }: WorkoutsSkeletonProps) => (
  <View style={{ gap: 16 }}>
    <View style={{ gap: 8 }}>
      <Skeleton width={128} height={32} />
      <Skeleton width={192} height={16} />
    </View>
    <Skeleton width={128} height={24} />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton width={200} height={120} radius={12} />
      <Skeleton width={200} height={120} radius={12} />
    </View>
    <Skeleton width={96} height={24} />
    <View style={{ gap: 12 }}>
      <Skeleton width={width} height={80} radius={12} />
      <Skeleton width={width} height={80} radius={12} />
      <Skeleton width={width} height={80} radius={12} />
    </View>
  </View>
);
