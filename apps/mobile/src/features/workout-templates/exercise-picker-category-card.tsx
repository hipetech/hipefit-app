import type { ExercisePickerCategoryTile } from './exercise-picker-catalogue';
import type React from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  background,
  buttonStyle,
  clipShape,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { formatExerciseCount } from '@/features/workouts/workout-template-summary';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

/** Shown for a custom category saved without a symbol. */
const FALLBACK_SYMBOL: SFSymbol = 'dumbbell';

/**
 * The card surface, in the order `Card` in `@hipefit/ui` documents: `frame`
 * after `padding` and before `background`, so the fill covers the full cell.
 * Kept local rather than using `Card`, whose `width` is fixed: a grid cell
 * needs `maxWidth: Infinity` so both columns share the row equally. The fill
 * matches the picker's list rows, which stay visible on the opaque sheet.
 */
const CARD_MODIFIERS = [
  padding({ all: 14 }),
  frame({ maxWidth: Infinity, alignment: 'leading' }),
  background(colors.tertiarySystemFill),
  cornerRadius(12),
];

/**
 * `plain`, so the card keeps its own look: the default style would tint every
 * label with the accent color. A plain button still dims on press.
 */
const BUTTON_STYLE = buttonStyle('plain');

/**
 * SF Symbols differ in height, so the symbol row gets a minimum height that
 * every seeded symbol fits at the default text size. Without it the names in
 * one grid row sit at different heights.
 */
const SYMBOL_MODIFIERS = [
  font({ textStyle: 'title3' }),
  foregroundStyle(colors.accent),
  frame({ minHeight: 28, alignment: 'leading' }),
  accessibilityHidden(true),
];

/**
 * The selected count, white on an accent capsule. A standalone figure that
 * changes in place, so it takes `monospacedDigit()` after the font.
 */
const BADGE_MODIFIERS = [
  font({ textStyle: 'caption', weight: 'semibold' }),
  monospacedDigit(),
  foregroundStyle(colors.onAccentSolid),
  padding({ horizontal: 7, vertical: 2 }),
  background(colors.accent),
  clipShape('capsule'),
  accessibilityHidden(true),
];

const describe = (tile: ExercisePickerCategoryTile): string => {
  const count = formatExerciseCount(tile.exerciseCount);
  return tile.selectedCount > 0
    ? `${tile.name}, ${count}, ${tile.selectedCount} selected`
    : `${tile.name}, ${count}`;
};

export interface ExercisePickerCategoryCardProps {
  /** The category, its counts, and how many of its exercises are selected. */
  tile: ExercisePickerCategoryTile;
  /** Opens the category's exercise list. */
  onPress: () => void;
}

/**
 * One card in the picker's category grid: the category symbol, its name, how
 * many exercises it holds, and a badge with the selected count once any are
 * selected. Host-less. The name is clamped to one line so the cards in a row
 * keep one height.
 */
export const ExercisePickerCategoryCard: React.FC<
  ExercisePickerCategoryCardProps
> = ({ tile, onPress }) => (
  <Button
    onPress={onPress}
    modifiers={[BUTTON_STYLE, accessibilityLabel(describe(tile))]}
  >
    <VStack alignment="leading" spacing={10} modifiers={CARD_MODIFIERS}>
      <HStack>
        <Image
          systemName={(tile.icon ?? FALLBACK_SYMBOL) as SFSymbol}
          modifiers={SYMBOL_MODIFIERS}
        />
        <Spacer />
        {tile.selectedCount > 0 ? (
          <Text modifiers={BADGE_MODIFIERS}>{String(tile.selectedCount)}</Text>
        ) : null}
      </HStack>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={mods.headlineLabelOneLine}>{tile.name}</Text>
        <Text modifiers={mods.footnoteSecondary}>
          {formatExerciseCount(tile.exerciseCount)}
        </Text>
      </VStack>
    </VStack>
  </Button>
);
