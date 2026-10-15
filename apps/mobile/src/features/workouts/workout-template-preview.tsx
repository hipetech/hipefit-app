import type { UnitSystem } from '@/lib/units';
import type { WorkoutTemplate } from '@hipefit/schemas';
import type React from 'react';
import { HStack, List, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  listRowBackground,
  monospacedDigit,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';

import {
  countTemplateSets,
  formatExerciseCount,
  formatSetCount,
  formatTemplateSet,
  groupTemplateExercises,
} from '@/features/workouts/workout-template-summary';
import { formatLongDate } from '@/lib/format';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

/**
 * The grouped list with its page background hidden, so the sheet's own
 * background shows through, as in the custom exercise sheet.
 */
const LIST_MODIFIERS = [
  ...mods.listInsetGrouped,
  scrollContentBackground('hidden'),
];

/**
 * A system fill for every row. The default grouped row color is opaque white
 * in light mode and vanishes against the full-height sheet, which iOS 26 draws
 * opaque.
 */
const SECTION_MODIFIERS = [listRowBackground(colors.tertiarySystemFill)];

const TITLE_MODIFIERS = [font({ textStyle: 'title2', weight: 'bold' })];

/** Set numbers line up as a column, so they take tabular digits. */
const SET_NUMBER_MODIFIERS = [...mods.footnoteSecondary, monospacedDigit()];

export interface WorkoutTemplatePreviewProps {
  template: WorkoutTemplate;
  /** The user's unit system, which decides how weights and distances read. */
  units: UnitSystem;
}

/**
 * A read-only view of a saved template: its name, counts, and planned date,
 * then one section per superset or single exercise, with every set's targets
 * and notes. A superset's section is titled Superset and carries its note as
 * the footer.
 *
 * Host-less: it renders inside the `BottomSheet` of
 * `workout-template-preview-sheet.tsx`.
 */
export const WorkoutTemplatePreview: React.FC<WorkoutTemplatePreviewProps> = ({
  template,
  units,
}) => {
  const groups = groupTemplateExercises(template.exercises);

  return (
    <List modifiers={LIST_MODIFIERS}>
      <Section modifiers={SECTION_MODIFIERS}>
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={TITLE_MODIFIERS}>{template.name}</Text>
          <Text modifiers={mods.footnoteSecondary}>
            {`${formatExerciseCount(template.exercises.length)} · ${formatSetCount(
              countTemplateSets(template)
            )}`}
          </Text>
          {template.plannedDate === undefined ? null : (
            <Text modifiers={mods.footnoteSecondary}>
              {`Planned for ${formatLongDate(template.plannedDate)}`}
            </Text>
          )}
        </VStack>
      </Section>

      {groups.map((group) => (
        <Section
          key={group.key}
          title={group.supersetId === null ? undefined : 'Superset'}
          footer={
            group.supersetNotes === null ? undefined : (
              <Text>{group.supersetNotes}</Text>
            )
          }
          modifiers={SECTION_MODIFIERS}
        >
          {group.exercises.map((exercise, exerciseIndex) => (
            <VStack
              key={`${group.key}-${exerciseIndex}`}
              alignment="leading"
              spacing={8}
            >
              <Text modifiers={mods.headlineLabel}>
                {exercise.nameSnapshot}
              </Text>
              {exercise.sets.map((set, setIndex) => (
                <HStack
                  key={`${group.key}-${exerciseIndex}-${setIndex}`}
                  alignment="firstTextBaseline"
                  spacing={12}
                >
                  <Text modifiers={SET_NUMBER_MODIFIERS}>
                    {String(setIndex + 1)}
                  </Text>
                  <VStack alignment="leading" spacing={2}>
                    <Text modifiers={mods.bodyLabel}>
                      {formatTemplateSet(set, exercise.type, units)}
                    </Text>
                    {set.notes === undefined ? null : (
                      <Text modifiers={mods.footnoteSecondary}>
                        {set.notes}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              ))}
            </VStack>
          ))}
        </Section>
      ))}
    </List>
  );
};
