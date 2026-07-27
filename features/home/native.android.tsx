import type {
  FeaturedRoutineCardProps,
  HomeSkeletonProps,
  MessageCardProps,
  StatsRowProps,
  WorkoutRowProps,
} from './native';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Skeleton } from '@/ui/skeleton';

/**
 * Android fallbacks for the Home native building blocks — plain RN mirrors of
 * the SwiftUI trees in `native.ios.tsx` (same props). See that file for intent.
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
    <Text style={{ color: colors.label, fontSize: 24, fontWeight: '700' }}>
      {String(value)}
    </Text>
    <Text style={{ color: colors.label, fontSize: 12, fontWeight: '600' }}>
      {label.toUpperCase()}
    </Text>
    <Text style={{ color: colors.secondaryLabel, fontSize: 10 }}>
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
  <View style={{ flexDirection: 'row', gap: 12 }}>
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
  </View>
);

export const FeaturedRoutineCard = ({
  name,
  description,
  exercisesLabel,
  durationLabel,
  width,
}: FeaturedRoutineCardProps) => (
  <Card spacing={8} width={width}>
    <Text style={{ color: colors.label, fontSize: 20, fontWeight: '700' }}>
      {name}
    </Text>
    {description ? (
      <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>
        {description}
      </Text>
    ) : null}
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>
        {exercisesLabel}
      </Text>
      {durationLabel ? (
        <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>
          {durationLabel}
        </Text>
      ) : null}
    </View>
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
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.label, fontSize: 16, fontWeight: '600' }}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>
            {durationLabel}
          </Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>
            {exercisesLabel}
          </Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>
            {dateLabel}
          </Text>
        </View>
      </View>
      <Chip
        label={statusLabel}
        variant={statusPrimary ? 'primary' : 'secondary'}
      />
    </View>
  </Card>
);

export const MessageCard = ({
  message,
  alignment = 'center',
  width,
}: MessageCardProps) => (
  <Card alignment={alignment} width={width} padding={20}>
    <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>
      {message}
    </Text>
  </Card>
);

export const HomeSkeleton = ({
  contentWidth,
  statCardWidth,
}: HomeSkeletonProps) => (
  <View style={{ gap: 24 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width={192} height={32} />
        <Skeleton width={144} height={16} />
      </View>
      <Skeleton width={48} height={48} radius={9999} />
    </View>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton width={statCardWidth} height={100} radius={12} />
      <Skeleton width={statCardWidth} height={100} radius={12} />
      <Skeleton width={statCardWidth} height={100} radius={12} />
    </View>
    <View style={{ gap: 16 }}>
      <Skeleton width={160} height={24} />
      <Skeleton width={contentWidth} height={120} radius={12} />
    </View>
    <View style={{ gap: 12 }}>
      <Skeleton width={160} height={24} />
      <Skeleton width={contentWidth} height={80} radius={12} />
      <Skeleton width={contentWidth} height={80} radius={12} />
    </View>
  </View>
);
