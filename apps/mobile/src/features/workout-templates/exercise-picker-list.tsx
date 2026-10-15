import type { ExercisePickerSection } from './exercise-picker-catalogue';
import type { MergedExercise } from '@/features/exercises/exercise-catalogue';
import type { Ref } from '@hipefit/schemas';
import type React from 'react';
import {
  Button,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityHidden,
  disabled,
  font,
  listRowBackground,
  listSectionMargins,
  redacted,
  scrollContentBackground,
  scrollDismissesKeyboard,
} from '@expo/ui/swift-ui/modifiers';

import { capitalize } from '@/lib/format';
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
  scrollDismissesKeyboard('immediately'),
];

/**
 * A translucent system fill for every row. The default grouped row color is
 * opaque white in light mode and vanishes against the full-height sheet,
 * which iOS 26 draws opaque; a fill reads as a card on it.
 */
const SECTION_MODIFIERS = [listRowBackground(colors.tertiarySystemFill)];

/**
 * A section without a heading would otherwise keep the grouped list's tall top
 * gap below the search field. 8pt matches the grid's top inset.
 */
const UNTITLED_SECTION_MODIFIERS = [
  ...SECTION_MODIFIERS,
  listSectionMargins({ length: 8, edges: 'top' }),
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

const formatSubtitle = (
  exercise: MergedExercise,
  showCategory: boolean
): string =>
  showCategory
    ? `${exercise.categoryName} · ${capitalize(exercise.type)}`
    : capitalize(exercise.type);

export interface ExercisePickerListProps {
  /** The exercises to list, already filtered and grouped. */
  sections: ExercisePickerSection[];
  /** Whether the catalogue is still loading. Draws one redacted row. */
  isLoading: boolean;
  /** Shown in place of the sections when there are none. */
  emptyMessage: string;
  /**
   * Whether each row's subtitle names the category. Off inside one category,
   * where every row would repeat it.
   */
  showCategory: boolean;
  /** Refs of the exercises currently selected in the picker. */
  selectedRefs: ReadonlySet<Ref>;
  /** Adds the exercise to the selection, or removes it if already selected. */
  onToggle: (ref: Ref) => void;
}

/**
 * The picker's grouped `List` of selectable exercise rows, one section per
 * entry in `sections`. Host-less. It renders inside the `BottomSheet` of
 * `exercise-picker-sheet.tsx`, below the search field.
 */
export const ExercisePickerList: React.FC<ExercisePickerListProps> = ({
  sections,
  isLoading,
  emptyMessage,
  showCategory,
  selectedRefs,
  onToggle,
}) => (
  <List modifiers={LIST_MODIFIERS}>
    {isLoading ? (
      <Section modifiers={UNTITLED_SECTION_MODIFIERS}>
        <HStack modifiers={PLACEHOLDER_ROW_MODIFIERS}>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={mods.bodyLabel}>Placeholder Exercise</Text>
            <Text modifiers={mods.footnoteSecondary}>Category · Strength</Text>
          </VStack>
          <Spacer />
        </HStack>
      </Section>
    ) : sections.length === 0 ? (
      <Section modifiers={UNTITLED_SECTION_MODIFIERS}>
        <Text modifiers={mods.bodySecondary}>{emptyMessage}</Text>
      </Section>
    ) : (
      sections.map((section) => (
        <Section
          key={section.key}
          modifiers={
            section.title === null
              ? UNTITLED_SECTION_MODIFIERS
              : SECTION_MODIFIERS
          }
          title={section.title ?? undefined}
        >
          {section.exercises.map((exercise) => {
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
                      {formatSubtitle(exercise, showCategory)}
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
