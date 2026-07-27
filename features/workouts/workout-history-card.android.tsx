import type { WorkoutHistoryCardProps } from './workout-history-card';
import { Text, View } from 'react-native';

import { formatDuration, formatShortDate, formatVolume } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';

/** Workout-history row (Android fallback): plain RN card. */
export const WorkoutHistoryCard = ({
  workout,
  width,
}: WorkoutHistoryCardProps) => {
  const isCompleted = workout.data.status === 'completed';

  return (
    <Card width={width}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{ fontSize: 16, fontWeight: '600', color: colors.label }}
          >
            {workout.data.routineName ?? 'Quick Workout'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
            {formatShortDate(workout.data.startedAt)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
              {formatDuration(workout.data.duration)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
              {`${workout.data.totalExercises} exercises`}
            </Text>
            <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
              {formatVolume(workout.data.totalVolume)}
            </Text>
          </View>
        </View>
        <Chip
          label={isCompleted ? 'Completed' : 'Abandoned'}
          variant={isCompleted ? 'primary' : 'secondary'}
        />
      </View>
    </Card>
  );
};
