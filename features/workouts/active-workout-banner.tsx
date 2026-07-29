import type { WithId } from '@/database';
import type { Workout } from '@/database/types';
import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled } from '@expo/ui/swift-ui/modifiers';

import { formatShortDate } from '@/lib/format';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

export interface ActiveWorkoutBannerProps {
  /** The in-progress workout to surface. */
  workout: WithId<Workout>;
  /**
   * Resume handler. While it is omitted the "Resume" button renders
   * **disabled** — the workout player does not exist yet, so the control is
   * shown inert rather than falsely interactive. Pass a handler to enable it.
   */
  onContinue?: () => void;
}

/**
 * Row surfacing the workout that is currently in progress.
 *
 * **Host-less** SwiftUI meant to be dropped straight into the screen's `List`
 * as a `Section` row — the grouped list supplies the surface, insets and 44pt
 * row height, so there is no `Card` and no width math. The leading symbol
 * carries the "in progress" status, so the row needs neither an accent border
 * nor a custom surface.
 */
export const ActiveWorkoutBanner = ({
  workout,
  onContinue,
}: ActiveWorkoutBannerProps) => (
  <HStack alignment="center" spacing={12}>
    {/* Sized with a text style rather than a fixed `size`, so the glyph scales
        with Dynamic Type alongside the labels next to it. */}
    <Image
      systemName="figure.run"
      color={colors.systemOrange}
      modifiers={mods.title3}
    />
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={mods.headlineLabelOneLine}>
        {workout.data.routineName ?? 'Quick Workout'}
      </Text>
      <Text modifiers={mods.footnoteSecondaryOneLine}>
        {`${workout.data.totalExercises} exercises · ${formatShortDate(workout.data.startedAt)}`}
      </Text>
    </VStack>
    <Spacer />
    {/* Disabled until the workout player exists. A bordered button with full
        press feedback that goes nowhere reads as a broken app, so the control
        stays visible but inert; passing `onContinue` re-enables it. */}
    <Button
      label="Resume"
      onPress={onContinue}
      modifiers={[buttonStyle('bordered'), disabled(onContinue == null)]}
    />
  </HStack>
);
