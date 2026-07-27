import type { ActiveWorkoutBannerProps } from './active-workout-banner';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Card } from '@/ui/card';

import { FallbackButton } from './fallback-button';

/** Active-workout banner (Android fallback): plain RN card. */
export const ActiveWorkoutBanner = ({
  workout,
  width,
  onContinue,
}: ActiveWorkoutBannerProps) => (
  <Card width={width} bordered>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>
          Workout in progress
        </Text>
        <Text style={{ fontSize: 14, color: colors.secondaryLabel }}>
          {`${workout.data.routineName ?? 'Quick Workout'} • ${workout.data.totalExercises} exercises`}
        </Text>
      </View>
      <FallbackButton label="Continue" onPress={onContinue} />
    </View>
  </Card>
);
