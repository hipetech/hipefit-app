import type { ExercisePickerCategoryTile } from './exercise-picker-catalogue';
import type React from 'react';
import { Grid, ScrollView } from '@expo/ui/swift-ui';
import {
  disabled,
  padding,
  redacted,
  scrollDismissesKeyboard,
} from '@expo/ui/swift-ui/modifiers';

import { ExercisePickerCategoryCard } from './exercise-picker-category-card';

const COLUMN_COUNT = 2;
const CARD_SPACING = 12;

const SCROLL_MODIFIERS = [scrollDismissesKeyboard('immediately')];

const GRID_MODIFIERS = [padding({ horizontal: 16, top: 8, bottom: 24 })];

/** Redaction over cards of the real shape, disabled so none can be tapped. */
const PLACEHOLDER_GRID_MODIFIERS = [
  ...GRID_MODIFIERS,
  redacted('placeholder'),
  disabled(true),
];

const PLACEHOLDER_TILES: ExercisePickerCategoryTile[] = [1, 2, 3, 4].map(
  (index) => ({
    scope: `global:placeholder-${index}`,
    name: 'Category',
    icon: null,
    exerciseCount: 12,
    selectedCount: 0,
  })
);

const toRows = (
  tiles: ExercisePickerCategoryTile[]
): ExercisePickerCategoryTile[][] => {
  const rows: ExercisePickerCategoryTile[][] = [];
  for (let index = 0; index < tiles.length; index += COLUMN_COUNT) {
    rows.push(tiles.slice(index, index + COLUMN_COUNT));
  }
  return rows;
};

export interface ExercisePickerCategoryGridProps {
  /** The cards, All first. */
  tiles: ExercisePickerCategoryTile[];
  /** Whether the catalogue is still loading. Draws redacted placeholder cards. */
  isLoading: boolean;
  /** Opens the tapped card's exercise list. */
  onSelect: (tile: ExercisePickerCategoryTile) => void;
}

/**
 * The picker's landing view: category cards two to a row in a scroll view.
 * Host-less. A SwiftUI `Grid` rather than an `HStack` per row, so a lone card
 * in the last row keeps the column width of the rows above it.
 */
export const ExercisePickerCategoryGrid: React.FC<
  ExercisePickerCategoryGridProps
> = ({ tiles, isLoading, onSelect }) => (
  <ScrollView modifiers={SCROLL_MODIFIERS}>
    <Grid
      horizontalSpacing={CARD_SPACING}
      verticalSpacing={CARD_SPACING}
      modifiers={isLoading ? PLACEHOLDER_GRID_MODIFIERS : GRID_MODIFIERS}
    >
      {toRows(isLoading ? PLACEHOLDER_TILES : tiles).map((row) => (
        <Grid.Row key={row.map((tile) => tile.scope).join()}>
          {row.map((tile) => (
            <ExercisePickerCategoryCard
              key={tile.scope}
              tile={tile}
              onPress={() => onSelect(tile)}
            />
          ))}
        </Grid.Row>
      ))}
    </Grid>
  </ScrollView>
);
