import type { WithId } from '@/database';
import type { Workout } from '@/database/types';
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  lineLimit,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';

import { formatDuration, formatShortDate, formatVolume } from '@/lib/format';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

/** The workout name, clamped to one line so a long routine name cannot wrap. */
const TITLE_MODIFIERS = [...mods.bodyLabel, lineLimit(1)];

/** The trailing exercise count — caption-sized, tabular so the column aligns. */
const EXERCISE_COUNT_MODIFIERS = [
  font({ textStyle: 'caption' }),
  foregroundStyle(colors.secondaryLabel),
  monospacedDigit(),
];

export interface WorkoutHistoryCardProps {
  /** A completed / abandoned workout to render as a history row. */
  workout: WithId<Workout>;
}

/**
 * A single workout-history row.
 *
 * **Host-less** SwiftUI sized by its grouped `List` row, which also supplies
 * the surface and the inset hairline separator — so the row takes no width and
 * no color scheme. Status is carried by the leading symbol (the Fitness idiom)
 * instead of a trailing chip, and the trailing column holds the numbers.
 */
export const WorkoutHistoryCard = ({ workout }: WorkoutHistoryCardProps) => {
  const isCompleted = workout.data.status === 'completed';

  return (
    <HStack alignment="center" spacing={12}>
      {/* Sized with a text style rather than a fixed `size`, so the glyph
          scales with Dynamic Type alongside the labels next to it. A `font`
          modifier also supersedes `size`, so the two must not be combined. */}
      <Image
        systemName={
          isCompleted ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'
        }
        color={isCompleted ? colors.systemGreen : colors.systemOrange}
        modifiers={mods.title3}
      />
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={TITLE_MODIFIERS}>
          {workout.data.routineName ?? 'Quick Workout'}
        </Text>
        <Text modifiers={mods.footnoteSecondaryOneLine}>
          {`${formatShortDate(workout.data.startedAt)} · ${formatDuration(workout.data.duration)}`}
        </Text>
      </VStack>
      <Spacer />
      {/* The trailing column is the only place in this row that gets
          `monospacedDigit()`: two standalone figures stacked on top of each
          other and repeated down every history row, so fixed-width digits keep
          the column from ragging. The leading subtitle deliberately does not —
          "Jan 1, 2026 · 45 min" is prose, and monospaced digits inside running
          text look like a bug.

          They get no `contentTransition('numericText')` either, unlike Home's
          Activity figures. A logged workout is immutable: its volume and
          exercise count are fixed the moment it lands in history, so there is
          no in-place change for a transition to animate — it would only cost a
          modifier on every one of these rows. Animate a figure that moves, not
          one that merely contains digits. */}
      <VStack alignment="trailing" spacing={2}>
        <Text modifiers={mods.bodyLabelMono}>
          {formatVolume(workout.data.totalVolume)}
        </Text>
        <Text modifiers={EXERCISE_COUNT_MODIFIERS}>
          {`${workout.data.totalExercises} exercises`}
        </Text>
      </VStack>
    </HStack>
  );
};
