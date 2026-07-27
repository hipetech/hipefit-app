import type { WorkoutsSkeletonProps } from './workouts-skeleton';
import { Host } from '@expo/ui';
import { HStack, VStack } from '@expo/ui/swift-ui';

import { BRAND_SEED } from '@/theme/colors';
import { Skeleton } from '@/ui/skeleton';

/** Workouts loading state (iOS): a SwiftUI `Host` island of skeleton blocks. */
export const WorkoutsSkeleton = ({
  width,
  colorScheme,
}: WorkoutsSkeletonProps) => (
  <Host
    style={{ width }}
    matchContents={{ vertical: true }}
    seedColor={BRAND_SEED}
    colorScheme={colorScheme}
  >
    <VStack alignment="leading" spacing={16}>
      <VStack alignment="leading" spacing={8}>
        <Skeleton width={128} height={32} />
        <Skeleton width={192} height={16} />
      </VStack>
      <Skeleton width={128} height={24} />
      <HStack spacing={12}>
        <Skeleton width={200} height={120} radius={12} />
        <Skeleton width={200} height={120} radius={12} />
      </HStack>
      <Skeleton width={96} height={24} />
      <VStack alignment="leading" spacing={12}>
        <Skeleton width={width} height={80} radius={12} />
        <Skeleton width={width} height={80} radius={12} />
        <Skeleton width={width} height={80} radius={12} />
      </VStack>
    </VStack>
  </Host>
);
