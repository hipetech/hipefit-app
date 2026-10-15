import type {
  ExercisePickerCategoryTile,
  ExercisePickerScope,
  ExercisePickerSection,
} from './exercise-picker-catalogue';
import type { Ref } from '@hipefit/schemas';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  Button,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  disabled,
  font,
  lineLimit,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { CustomExerciseBottomSheet } from '@/features/exercises/custom-exercise-bottom-sheet';
import { useExerciseStore } from '@/stores/use-exercise-store';

import {
  buildCategoryTiles,
  groupByCategory,
  matchesQuery,
} from './exercise-picker-catalogue';
import { ExercisePickerCategoryGrid } from './exercise-picker-category-grid';
import { ExercisePickerList } from './exercise-picker-list';
import { ExercisePickerSearchField } from './exercise-picker-search-field';

/**
 * The header row stands in for a navigation bar, which the sheet has no stack
 * to draw. The top inset clears the drag indicator.
 */
const HEADER_MODIFIERS = [padding({ horizontal: 16, top: 20, bottom: 8 })];

const TITLE_MODIFIERS = [font({ textStyle: 'headline' }), lineLimit(1)];

const ADD_LABEL_MODIFIERS = [font({ textStyle: 'body', weight: 'semibold' })];

/**
 * Icon only, so VoiceOver needs the label. The native `Button` draws
 * `systemImage` only beside a `label`, so the glyph is an `Image` child.
 */
const NEW_EXERCISE_BUTTON_MODIFIERS = [accessibilityLabel('New Exercise')];

const NEW_EXERCISE_GLYPH_MODIFIERS = [
  font({ textStyle: 'body', weight: 'semibold' }),
];

export interface ExercisePickerContentProps {
  /** Refs of the exercises currently selected in the picker. */
  selectedRefs: ReadonlySet<Ref>;
  /** How many selected exercises are still in the catalogue. */
  selectedCount: number;
  /** Adds the exercise to the selection, or removes it if already selected. */
  onToggle: (ref: Ref) => void;
  /** Closes the picker without adding anything. */
  onCancel: () => void;
  /** Adds the selection to the draft and closes the picker. */
  onAdd: () => void;
  /** Adds an exercise the user just created to the selection. */
  onCreated: (ref: Ref) => void;
}

/**
 * The picker's body: a header row, a search field, and either the category
 * grid or a list of exercises. Host-less, and mounted by
 * `exercise-picker-sheet.tsx` only while the sheet is presented, so every
 * presentation starts on the grid with an empty search.
 *
 * On the grid, typing replaces the cards with every matching exercise. Tapping
 * a card opens that category's exercises, or the whole catalogue for All, and
 * Back in place of Cancel returns to the grid. The search field then covers
 * only that list. Changing view clears the search: the field is keyed by the
 * scope, so it remounts empty.
 *
 * The + in the header presents `CustomExerciseBottomSheet` over the picker,
 * started with the search text as the name and, inside a category, that
 * category. The picker stays as it was underneath, and a save selects the new
 * exercise.
 */
export const ExercisePickerContent: React.FC<ExercisePickerContentProps> = ({
  selectedRefs,
  selectedCount,
  onToggle,
  onCancel,
  onAdd,
  onCreated,
}) => {
  const exercises = useExerciseStore((state) => state.exercises);
  const categories = useExerciseStore((state) => state.categories);
  const isLoading = useExerciseStore((state) => state.isLoading);
  const [scope, setScope] = useState<ExercisePickerScope | null>(null);
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const tiles = useMemo(
    () => buildCategoryTiles(exercises, categories, selectedRefs),
    [exercises, categories, selectedRefs]
  );

  const showsGrid =
    scope === null &&
    query.trim() === '' &&
    (isLoading || exercises.length > 0);

  const sections = useMemo((): ExercisePickerSection[] => {
    if (showsGrid) return [];
    const matching = exercises.filter(
      (exercise) =>
        (scope === null || scope === 'all' || exercise.categoryRef === scope) &&
        matchesQuery(exercise, query)
    );
    if (scope === 'all') return groupByCategory(matching);
    return matching.length > 0
      ? [{ key: scope ?? 'results', title: null, exercises: matching }]
      : [];
  }, [exercises, query, scope, showsGrid]);

  const scopeName =
    scope === null
      ? null
      : scope === 'all'
        ? 'All Exercises'
        : (tiles.find((tile) => tile.scope === scope)?.name ?? 'Exercises');

  const openTile = (tile: ExercisePickerCategoryTile) => {
    setQuery('');
    setScope(tile.scope);
  };

  const goBack = () => {
    setQuery('');
    setScope(null);
  };

  // The nested `BottomSheet` draws a hidden `Rectangle` that would take a share
  // of the `VStack`'s height, so it sits behind the picker in a `ZStack`.
  // Rendered inside this sheet's content, it presents over the picker rather
  // than from the editor, which is already presenting the picker.
  return (
    <ZStack>
      <VStack spacing={0}>
        <HStack modifiers={HEADER_MODIFIERS}>
          {scope === null ? (
            <Button label="Cancel" onPress={onCancel} />
          ) : (
            <Button
              label="Back"
              systemImage="chevron.backward"
              onPress={goBack}
            />
          )}
          <Spacer />
          <Text modifiers={TITLE_MODIFIERS}>
            {scopeName ?? 'Add Exercises'}
          </Text>
          <Spacer />
          <HStack spacing={20}>
            <Button
              onPress={() => setIsCreating(true)}
              modifiers={NEW_EXERCISE_BUTTON_MODIFIERS}
            >
              <Image
                systemName="plus"
                modifiers={NEW_EXERCISE_GLYPH_MODIFIERS}
              />
            </Button>
            <Button onPress={onAdd} modifiers={[disabled(selectedCount === 0)]}>
              <Text modifiers={ADD_LABEL_MODIFIERS}>
                {selectedCount > 0 ? `Add (${selectedCount})` : 'Add'}
              </Text>
            </Button>
          </HStack>
        </HStack>
        <ExercisePickerSearchField
          key={scope ?? 'grid'}
          placeholder={
            scope === null || scope === 'all' ? 'Search' : `Search ${scopeName}`
          }
          hasText={query !== ''}
          onTextChange={setQuery}
        />
        {showsGrid ? (
          <ExercisePickerCategoryGrid
            tiles={tiles}
            isLoading={isLoading}
            onSelect={openTile}
          />
        ) : (
          <ExercisePickerList
            sections={sections}
            isLoading={isLoading}
            emptyMessage={
              exercises.length === 0
                ? 'No exercises available'
                : 'No matching exercises'
            }
            showCategory={scope === null}
            selectedRefs={selectedRefs}
            onToggle={onToggle}
          />
        )}
      </VStack>
      <CustomExerciseBottomSheet
        isPresented={isCreating}
        onClose={() => setIsCreating(false)}
        onSaved={onCreated}
        initialName={query.trim()}
        initialCategoryRef={scope === null || scope === 'all' ? null : scope}
      />
    </ZStack>
  );
};
