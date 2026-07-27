import type { RoutineCardProps } from './routine-card';
import { Button, Host } from '@expo/ui';
import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundColor, lineLimit } from '@expo/ui/swift-ui/modifiers';

import { BRAND_SEED, colors } from '@/theme/colors';
import { Card } from '@/ui/card';

/** Routine preview card (iOS): a SwiftUI `Host` island. */
export const RoutineCard = ({
  routine,
  colorScheme,
  onStart,
}: RoutineCardProps) => (
  <Host
    matchContents={{ vertical: true }}
    seedColor={BRAND_SEED}
    colorScheme={colorScheme}
  >
    <Card width={200}>
      <Text
        modifiers={[
          font({ size: 16, weight: 'bold' }),
          foregroundColor(colors.label),
          lineLimit(1),
        ]}
      >
        {routine.data.name}
      </Text>
      <VStack alignment="leading" spacing={4}>
        <Text
          modifiers={[
            font({ size: 12 }),
            foregroundColor(colors.secondaryLabel),
          ]}
        >
          {`${routine.data.exercises.length} exercises`}
        </Text>
        {routine.data.estimatedDuration ? (
          <Text
            modifiers={[
              font({ size: 12 }),
              foregroundColor(colors.secondaryLabel),
            ]}
          >
            {`~${routine.data.estimatedDuration} min`}
          </Text>
        ) : null}
        <Text
          modifiers={[
            font({ size: 12 }),
            foregroundColor(colors.secondaryLabel),
          ]}
        >
          {`Performed ${routine.data.timesPerformed} times`}
        </Text>
      </VStack>
      <Button label="Start" onPress={onStart} />
    </Card>
  </Host>
);
