import type {
  FeaturedRoutineCardProps,
  HomeSkeletonProps,
  MessageCardProps,
  StatsRowProps,
  WorkoutRowProps,
} from './native';
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundColor } from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Skeleton } from '@/ui/skeleton';

/**
 * Home-screen native (SwiftUI) building blocks. Each export returns a Host-less
 * subtree — compose it inside a screen `Host` (see `app/(private)/index.tsx`).
 * The Android fallbacks live in `native.android.tsx`; shared prop types in
 * `native.d.ts`.
 */

const StatCard = ({
  value,
  label,
  sublabel,
  width,
}: {
  value: number;
  label: string;
  sublabel: string;
  width: number;
}) => (
  <Card alignment="center" spacing={4} width={width}>
    <Text modifiers={[font({ size: 24, weight: 'bold' })]}>
      {String(value)}
    </Text>
    <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>
      {label.toUpperCase()}
    </Text>
    <Text
      modifiers={[font({ size: 10 }), foregroundColor(colors.secondaryLabel)]}
    >
      {sublabel}
    </Text>
  </Card>
);

export const StatsRow = ({
  totalWorkouts,
  currentStreak,
  longestStreak,
  cardWidth,
}: StatsRowProps) => (
  <HStack spacing={12} alignment="top">
    <StatCard
      value={totalWorkouts}
      label="Workouts"
      sublabel="total"
      width={cardWidth}
    />
    <StatCard
      value={currentStreak}
      label="Streak"
      sublabel="days"
      width={cardWidth}
    />
    <StatCard
      value={longestStreak}
      label="Best Streak"
      sublabel="days"
      width={cardWidth}
    />
  </HStack>
);

export const FeaturedRoutineCard = ({
  name,
  description,
  exercisesLabel,
  durationLabel,
  width,
}: FeaturedRoutineCardProps) => (
  <Card spacing={8} width={width}>
    <Text modifiers={[font({ size: 20, weight: 'bold' })]}>{name}</Text>
    {description ? (
      <Text
        modifiers={[font({ size: 14 }), foregroundColor(colors.secondaryLabel)]}
      >
        {description}
      </Text>
    ) : null}
    <HStack spacing={16} alignment="center">
      <Text
        modifiers={[font({ size: 14 }), foregroundColor(colors.secondaryLabel)]}
      >
        {exercisesLabel}
      </Text>
      {durationLabel ? (
        <Text
          modifiers={[
            font({ size: 14 }),
            foregroundColor(colors.secondaryLabel),
          ]}
        >
          {durationLabel}
        </Text>
      ) : null}
    </HStack>
  </Card>
);

export const WorkoutRow = ({
  title,
  durationLabel,
  exercisesLabel,
  dateLabel,
  statusLabel,
  statusPrimary,
  width,
}: WorkoutRowProps) => (
  <Card width={width}>
    <HStack alignment="center">
      <VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ size: 16, weight: 'semibold' })]}>
          {title}
        </Text>
        <HStack spacing={12} alignment="center">
          <Text
            modifiers={[
              font({ size: 12 }),
              foregroundColor(colors.secondaryLabel),
            ]}
          >
            {durationLabel}
          </Text>
          <Text
            modifiers={[
              font({ size: 12 }),
              foregroundColor(colors.secondaryLabel),
            ]}
          >
            {exercisesLabel}
          </Text>
          <Text
            modifiers={[
              font({ size: 12 }),
              foregroundColor(colors.secondaryLabel),
            ]}
          >
            {dateLabel}
          </Text>
        </HStack>
      </VStack>
      <Spacer />
      <Chip
        label={statusLabel}
        variant={statusPrimary ? 'primary' : 'secondary'}
      />
    </HStack>
  </Card>
);

export const MessageCard = ({
  message,
  alignment = 'center',
  width,
}: MessageCardProps) => (
  <Card alignment={alignment} width={width} padding={20}>
    <Text
      modifiers={[font({ size: 14 }), foregroundColor(colors.secondaryLabel)]}
    >
      {message}
    </Text>
  </Card>
);

export const HomeSkeleton = ({
  contentWidth,
  statCardWidth,
}: HomeSkeletonProps) => (
  <VStack spacing={24} alignment="leading">
    <HStack alignment="center">
      <VStack spacing={8} alignment="leading">
        <Skeleton width={192} height={32} />
        <Skeleton width={144} height={16} />
      </VStack>
      <Spacer />
      <Skeleton width={48} height={48} radius={9999} />
    </HStack>
    <HStack spacing={12} alignment="top">
      <Skeleton width={statCardWidth} height={100} radius={12} />
      <Skeleton width={statCardWidth} height={100} radius={12} />
      <Skeleton width={statCardWidth} height={100} radius={12} />
    </HStack>
    <VStack spacing={16} alignment="leading">
      <Skeleton width={160} height={24} />
      <Skeleton width={contentWidth} height={120} radius={12} />
    </VStack>
    <VStack spacing={12} alignment="leading">
      <Skeleton width={160} height={24} />
      <Skeleton width={contentWidth} height={80} radius={12} />
      <Skeleton width={contentWidth} height={80} radius={12} />
    </VStack>
  </VStack>
);
