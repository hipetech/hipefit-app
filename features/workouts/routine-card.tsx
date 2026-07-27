import type { WithId } from '@/database';
import type { Routine } from '@/database/types';
import { Button, Text, VStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  lineLimit,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';
import { Card } from '@/ui/card';

export interface RoutineCardProps {
  /** The routine to preview. */
  routine: WithId<Routine>;
  /**
   * Start handler. While it is omitted the "Start" button renders **disabled**
   * — there is no workout player to navigate to yet, and a live-looking button
   * that does nothing is worse than a greyed one. Pass a handler to enable it.
   */
  onStart?: () => void;
}

/**
 * A routine preview card for the horizontal carousel.
 *
 * **Host-less** SwiftUI: it lives inside the screen's single `Host`, in a
 * full-bleed `List` row that scrolls horizontally. The radius matches the
 * grouped list's own corner radius rather than the old 16pt card radius.
 */
export const RoutineCard = ({ routine, onStart }: RoutineCardProps) => (
  <Card width={200} radius={12} spacing={8}>
    <Text
      modifiers={[
        font({ textStyle: 'headline' }),
        foregroundStyle(colors.label),
        lineLimit(1),
      ]}
    >
      {routine.data.name}
    </Text>
    {/* None of these three lines is a counter, so none takes
        `monospacedDigit()` or a `numericText` transition: they are sentence
        fragments ("8 exercises", "Performed 12 times"), not standalone figures
        in a column. `timesPerformed` is the only one that can move at all, and
        only after a workout finishes — a moment the user spends leaving the
        player, not watching this card. */}
    <VStack alignment="leading" spacing={2}>
      <Text
        modifiers={[
          font({ textStyle: 'footnote' }),
          foregroundStyle(colors.secondaryLabel),
        ]}
      >
        {`${routine.data.exercises.length} exercises`}
      </Text>
      {routine.data.estimatedDuration ? (
        <Text
          modifiers={[
            font({ textStyle: 'footnote' }),
            foregroundStyle(colors.secondaryLabel),
          ]}
        >
          {`~${routine.data.estimatedDuration} min`}
        </Text>
      ) : null}
      <Text
        modifiers={[
          font({ textStyle: 'footnote' }),
          foregroundStyle(colors.secondaryLabel),
        ]}
      >
        {`Performed ${routine.data.timesPerformed} times`}
      </Text>
    </VStack>
    {/* Disabled until the workout player exists — see ActiveWorkoutBanner. The
        card keeps its full shape, the button just stops pretending to work;
        passing `onStart` re-enables it. */}
    <Button
      label="Start"
      onPress={onStart}
      modifiers={[buttonStyle('bordered'), disabled(onStart == null)]}
    />
  </Card>
);
