import type { WorkoutHistoryCardProps } from './workout-history-card';
import { Host } from '@expo/ui';
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundColor } from '@expo/ui/swift-ui/modifiers';

import { formatDuration, formatShortDate, formatVolume } from '@/lib/format';
import { BRAND_SEED, colors } from '@/theme/colors';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';

/** Workout-history row (iOS): a SwiftUI `Host` island. */
export const WorkoutHistoryCard = ({
  workout,
  width,
  colorScheme,
}: WorkoutHistoryCardProps) => {
  const isCompleted = workout.data.status === 'completed';

  return (
    <Host
      style={{ width }}
      matchContents={{ vertical: true }}
      seedColor={BRAND_SEED}
      colorScheme={colorScheme}
    >
      <Card>
        <HStack alignment="top" spacing={8}>
          <VStack alignment="leading" spacing={4}>
            <Text
              modifiers={[
                font({ size: 16, weight: 'semibold' }),
                foregroundColor(colors.label),
              ]}
            >
              {workout.data.routineName ?? 'Quick Workout'}
            </Text>
            <Text
              modifiers={[
                font({ size: 12 }),
                foregroundColor(colors.secondaryLabel),
              ]}
            >
              {formatShortDate(workout.data.startedAt)}
            </Text>
            <HStack spacing={12}>
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundColor(colors.secondaryLabel),
                ]}
              >
                {formatDuration(workout.data.duration)}
              </Text>
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundColor(colors.secondaryLabel),
                ]}
              >
                {`${workout.data.totalExercises} exercises`}
              </Text>
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundColor(colors.secondaryLabel),
                ]}
              >
                {formatVolume(workout.data.totalVolume)}
              </Text>
            </HStack>
          </VStack>
          <Spacer />
          <Chip
            label={isCompleted ? 'Completed' : 'Abandoned'}
            variant={isCompleted ? 'primary' : 'secondary'}
          />
        </HStack>
      </Card>
    </Host>
  );
};
