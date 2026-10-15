import type { TemplateExerciseContentProps } from './template-exercise-content';
import type React from 'react';
import { View } from 'react-native';

import { templateCardStyles } from './template-card-styles';
import { TemplateExerciseContent } from './template-exercise-content';

export type TemplateExerciseRowProps = Omit<
  TemplateExerciseContentProps,
  'move'
>;

/**
 * A single exercise in the template editor's list: its content on its own
 * card. A long press anywhere outside the inputs and the action button lifts
 * it. Exercises in a superset render in `template-superset-block.tsx` instead.
 */
export const TemplateExerciseRow: React.FC<TemplateExerciseRowProps> = (
  props
) => (
  <View style={templateCardStyles.item}>
    <View style={templateCardStyles.card}>
      <TemplateExerciseContent {...props} />
    </View>
  </View>
);
