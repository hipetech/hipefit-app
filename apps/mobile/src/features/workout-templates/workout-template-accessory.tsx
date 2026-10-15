import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ExpandableAccessory } from '@hipefit/expandable-accessory';

import { Text } from '@/components/text';
import { formatExerciseCount } from '@/features/workouts/workout-template-summary';
import { useWorkoutTemplateDraftStore } from '@/stores/use-workout-template-draft-store';
import { colors } from '@/theme/colors';

const TITLE = 'New Workout Template';

/** The name shown while the draft's name is empty or only whitespace. */
const UNTITLED_NAME = 'Untitled';

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  /**
   * The title uses `subheadline` instead of `headline` so that two lines take
   * less of the accessory's height, and this weight so it still reads as the
   * title. Not yet checked on a device.
   */
  title: {
    fontWeight: '600',
  },
  summary: {
    color: colors.secondaryLabel,
  },
});

/**
 * The tab bar accessory while a template draft is minimized. Tapping it
 * presents the template editor again, zooming out of the pill when the
 * editor is presented full screen. Renders nothing without a draft.
 */
export const WorkoutTemplateAccessory: React.FC = () => {
  const draft = useWorkoutTemplateDraftStore((state) => state.draft);

  if (draft === null) {
    return null;
  }

  const name = draft.name.trim() || UNTITLED_NAME;
  const exerciseCount = formatExerciseCount(draft.exercises.length);

  return (
    <ExpandableAccessory.Trigger>
      <Pressable
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${TITLE}, ${name}, ${exerciseCount}`}
        accessibilityHint="Opens the template editor."
        style={styles.trigger}
      >
        <ExpandableAccessory.ZoomSource>
          <View collapsable={false} style={styles.content}>
            <Text variant="subheadline" numberOfLines={1} style={styles.title}>
              {TITLE}
            </Text>
            <Text variant="footnote" numberOfLines={1} style={styles.summary}>
              {`${name} · ${exerciseCount}`}
            </Text>
          </View>
        </ExpandableAccessory.ZoomSource>
      </Pressable>
    </ExpandableAccessory.Trigger>
  );
};
