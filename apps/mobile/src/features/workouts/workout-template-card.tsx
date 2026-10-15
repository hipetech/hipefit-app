import type { WorkoutTemplate } from '@hipefit/schemas';
import type React from 'react';
import { Button, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import { Card } from '@hipefit/ui';

import {
  countTemplateSets,
  formatExerciseCount,
  formatSetCount,
} from '@/features/workouts/workout-template-summary';
import { mods } from '@/theme/modifiers';

/**
 * `plain`, so the card keeps its own look: the default style would tint every
 * label with the accent color. A plain button still dims on press.
 */
const CARD_BUTTON_MODIFIERS = [buttonStyle('plain')];

export interface WorkoutTemplateCardProps {
  /** The decoded template the card summarizes. */
  template: WorkoutTemplate;
  /** Opens the template's preview. */
  onPress: () => void;
}

/**
 * One saved template in the Workouts carousel: its name, exercise count and set
 * count. Tapping it opens the template's preview.
 *
 * The card's width, radius and spacing match `PlaceholderWorkoutTemplateCard`
 * in `workouts-content.tsx`, so the carousel keeps its geometry when redaction
 * lifts. The name is clamped to one line because a taller card would leave its
 * neighbours top-aligned against a ragged bottom edge. There is no duration
 * line: `estimatedDuration` is always written as `null`.
 *
 * The counts are descriptive fragments, not standalone figures, so they keep
 * proportional digits (see Typography in `docs/app/ui.md`).
 */
export const WorkoutTemplateCard: React.FC<WorkoutTemplateCardProps> = ({
  template,
  onPress,
}) => (
  <Button onPress={onPress} modifiers={CARD_BUTTON_MODIFIERS}>
    <Card width={200} radius={12} spacing={8}>
      <Text modifiers={mods.headlineLabelOneLine}>{template.name}</Text>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={mods.footnoteSecondary}>
          {formatExerciseCount(template.exercises.length)}
        </Text>
        <Text modifiers={mods.footnoteSecondary}>
          {formatSetCount(countTemplateSets(template))}
        </Text>
      </VStack>
    </Card>
  </Button>
);
