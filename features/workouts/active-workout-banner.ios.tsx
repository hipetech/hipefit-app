import type { ActiveWorkoutBannerProps } from './active-workout-banner';
import { Button, Host } from '@expo/ui';
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundColor } from '@expo/ui/swift-ui/modifiers';

import { BRAND_SEED, colors } from '@/theme/colors';
import { Card } from '@/ui/card';

/** Active-workout banner (iOS): a SwiftUI `Host` island. */
export const ActiveWorkoutBanner = ({
  workout,
  width,
  colorScheme,
  onContinue,
}: ActiveWorkoutBannerProps) => (
  <Host
    style={{ width }}
    matchContents={{ vertical: true }}
    seedColor={BRAND_SEED}
    colorScheme={colorScheme}
  >
    <Card bordered>
      <HStack alignment="center" spacing={8}>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ size: 16, weight: 'bold' }),
              foregroundColor(colors.label),
            ]}
          >
            Workout in progress
          </Text>
          <Text
            modifiers={[
              font({ size: 14 }),
              foregroundColor(colors.secondaryLabel),
            ]}
          >
            {`${workout.data.routineName ?? 'Quick Workout'} • ${workout.data.totalExercises} exercises`}
          </Text>
        </VStack>
        <Spacer />
        <Button label="Continue" onPress={onContinue} />
      </HStack>
    </Card>
  </Host>
);
