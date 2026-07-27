import type { RoutineCardProps } from './routine-card';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Card } from '@/ui/card';

import { FallbackButton } from './fallback-button';

/** Routine preview card (Android fallback): plain RN card. */
export const RoutineCard = ({ routine, onStart }: RoutineCardProps) => (
  <Card width={200}>
    <Text
      numberOfLines={1}
      style={{ fontSize: 16, fontWeight: '700', color: colors.label }}
    >
      {routine.data.name}
    </Text>
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
        {`${routine.data.exercises.length} exercises`}
      </Text>
      {routine.data.estimatedDuration ? (
        <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
          {`~${routine.data.estimatedDuration} min`}
        </Text>
      ) : null}
      <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
        {`Performed ${routine.data.timesPerformed} times`}
      </Text>
    </View>
    <FallbackButton label="Start" onPress={onStart} />
  </Card>
);
