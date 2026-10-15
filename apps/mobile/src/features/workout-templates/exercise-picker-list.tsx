import type { MergedExercise } from '@/features/exercises/exercise-catalogue';
import type { Ref } from '@hipefit/schemas';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  Button,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityHidden,
  autocorrectionDisabled,
  disabled,
  font,
  foregroundStyle,
  listRowBackground,
  redacted,
  scrollContentBackground,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { capitalize } from '@/lib/format';
import { useExerciseStore } from '@/stores/use-exercise-store';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

/**
 * The grouped list with its page background hidden, so the sheet's own
 * background shows through. Kept local rather than added to
 * `mods.listInsetGrouped`: the full-screen grouped lists need that background.
 */
const LIST_MODIFIERS = [
  ...mods.listInsetGrouped,
  scrollContentBackground('hidden'),
];

/**
 * A translucent system fill for every row. The default grouped row color is
 * opaque white in light mode and vanishes against the full-height sheet,
 * which iOS 26 draws opaque; a fill reads as a card on it.
 */
const SECTION_MODIFIERS = [listRowBackground(colors.tertiarySystemFill)];

const FILTER_FIELD_MODIFIERS = [
  textInputAutocapitalization('never'),
  autocorrectionDisabled(),
];

const FILTER_GLYPH_MODIFIERS = [
  foregroundStyle(colors.secondaryLabel),
  accessibilityHidden(true),
];

/**
 * The checkmark inherits the `Button`'s accent foreground, matching the
 * selection mark UIKit draws. It is sized with a text style so it scales with
 * the name, and hidden from VoiceOver because the row's selected trait says it.
 */
const CHECKMARK_MODIFIERS = [
  font({ textStyle: 'body', weight: 'semibold' }),
  accessibilityHidden(true),
];

const SELECTED_ROW_MODIFIERS = [accessibilityAddTraits(['isSelected'])];

/** Redaction over a row of the real shape, disabled so it cannot be tapped. */
const PLACEHOLDER_ROW_MODIFIERS = [redacted('placeholder'), disabled(true)];

interface CategoryGroup {
  categoryRef: Ref;
  categoryName: string;
  exercises: MergedExercise[];
}

/**
 * Groups the catalogue by category in the order the store publishes it. The
 * store sorts by category order, then name, but exercises whose category is not
 * published share one sort key and interleave by name, so groups are keyed by
 * ref rather than built from consecutive runs.
 */
const groupMatchingExercises = (
  exercises: MergedExercise[],
  query: string
): CategoryGroup[] => {
  const needle = query.trim().toLocaleLowerCase();
  const groups = new Map<Ref, CategoryGroup>();
  for (const exercise of exercises) {
    if (needle && !exercise.name.toLocaleLowerCase().includes(needle)) {
      continue;
    }
    const group = groups.get(exercise.categoryRef);
    if (group) {
      group.exercises.push(exercise);
    } else {
      groups.set(exercise.categoryRef, {
        categoryRef: exercise.categoryRef,
        categoryName: exercise.categoryName,
        exercises: [exercise],
      });
    }
  }
  return [...groups.values()];
};

const formatSubtitle = (exercise: MergedExercise): string =>
  `${exercise.categoryName} · ${capitalize(exercise.type)}`;

export interface ExercisePickerListProps {
  /** Refs of the exercises currently selected in the picker. */
  selectedRefs: ReadonlySet<Ref>;
  /** Adds the exercise to the selection, or removes it if already selected. */
  onToggle: (ref: Ref) => void;
}

/**
 * The picker's grouped `List`: a name filter, then one section per category
 * with a selectable row per exercise. Host-less. It renders inside the
 * `BottomSheet` of `exercise-picker-sheet.tsx`, which mounts it once per
 * presentation, so the filter starts empty every time.
 */
export const ExercisePickerList: React.FC<ExercisePickerListProps> = ({
  selectedRefs,
  onToggle,
}) => {
  const exercises = useExerciseStore((state) => state.exercises);
  const isLoading = useExerciseStore((state) => state.isLoading);
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () => groupMatchingExercises(exercises, query),
    [exercises, query]
  );

  return (
    <List modifiers={LIST_MODIFIERS}>
      <Section modifiers={SECTION_MODIFIERS}>
        <HStack spacing={8}>
          <Image
            systemName="magnifyingglass"
            modifiers={FILTER_GLYPH_MODIFIERS}
          />
          <TextField
            placeholder="Filter by name"
            onTextChange={setQuery}
            modifiers={FILTER_FIELD_MODIFIERS}
          />
        </HStack>
      </Section>

      {isLoading ? (
        <Section modifiers={SECTION_MODIFIERS}>
          <HStack modifiers={PLACEHOLDER_ROW_MODIFIERS}>
            <VStack alignment="leading" spacing={2}>
              <Text modifiers={mods.bodyLabel}>Placeholder Exercise</Text>
              <Text modifiers={mods.footnoteSecondary}>
                Category · Strength
              </Text>
            </VStack>
            <Spacer />
          </HStack>
        </Section>
      ) : exercises.length === 0 ? (
        <Section modifiers={SECTION_MODIFIERS}>
          <Text modifiers={mods.bodySecondary}>No exercises available</Text>
        </Section>
      ) : groups.length === 0 ? (
        <Section modifiers={SECTION_MODIFIERS}>
          <Text modifiers={mods.bodySecondary}>No matching exercises</Text>
        </Section>
      ) : (
        groups.map((group) => (
          <Section
            key={group.categoryRef}
            modifiers={SECTION_MODIFIERS}
            title={group.categoryName}
          >
            {group.exercises.map((exercise) => {
              const isSelected = selectedRefs.has(exercise.ref);
              return (
                <Button
                  key={exercise.ref}
                  onPress={() => onToggle(exercise.ref)}
                  modifiers={isSelected ? SELECTED_ROW_MODIFIERS : undefined}
                >
                  <HStack>
                    {/* Explicit label colors: text inside a `Button` otherwise
                        takes the accent tint and every row reads as a link. */}
                    <VStack alignment="leading" spacing={2}>
                      <Text modifiers={mods.bodyLabel}>{exercise.name}</Text>
                      <Text modifiers={mods.footnoteSecondary}>
                        {formatSubtitle(exercise)}
                      </Text>
                    </VStack>
                    <Spacer />
                    {isSelected ? (
                      <Image
                        systemName="checkmark"
                        modifiers={CHECKMARK_MODIFIERS}
                      />
                    ) : null}
                  </HStack>
                </Button>
              );
            })}
          </Section>
        ))
      )}
    </List>
  );
};
