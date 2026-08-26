import type { MergedExercise } from './exercise-catalogue';
import type { ExerciseType } from '@hipefit/schemas';
import type { SFSymbol } from 'sf-symbols-typescript';
import { StyleSheet, View } from 'react-native';
import { Host } from '@expo/ui';
import {
  Button,
  DisclosureGroup,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel,
  disabled,
  fixedSize,
  font,
  frame,
  lineLimit,
  padding,
  redacted,
} from '@expo/ui/swift-ui/modifiers';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

import { GROUPED_ROW_RADIUS, ROW_GLYPH_SIZE } from './row-metrics';

/** Leading glyph per exercise type — SF Symbols, so nothing is fetched. */
const typeSymbol: Record<ExerciseType, SFSymbol> = {
  strength: 'dumbbell',
  cardio: 'figure.run',
  bodyweight: 'figure.strengthtraining.functional',
};

/**
 * Stretch to the full row width and left-align — the shape the text column and
 * each of its lines share, so a short name still fills its line and the
 * disclosure chevron stays pinned to the trailing edge.
 *
 * Not the same shape as `mods.secondaryActionButton`'s
 * `frame({ maxWidth: Infinity })`, which has no `alignment`. Never merge them.
 */
const FILL_LEADING = frame({ maxWidth: Infinity, alignment: 'leading' });

/**
 * The loading row. `disabled(true)` accompanies the redaction so a placeholder
 * cannot be tapped while it shimmers.
 */
const PLACEHOLDER_MODIFIERS = [redacted('placeholder'), disabled(true)];

/** Leading type glyph, in a fixed frame so every row's text starts flush. */
const GLYPH_MODIFIERS = [
  font({ textStyle: 'body' }),
  frame({ width: ROW_GLYPH_SIZE, alignment: 'center' }),
];

/** The name + subtitle column, filling the width beside the glyph. */
const TITLE_COLUMN_MODIFIERS = [FILL_LEADING];

/** Exercise name. */
const NAME_MODIFIERS = [...mods.bodyLabel, FILL_LEADING];

/** Resolved category name under the exercise name. */
const SUBTITLE_MODIFIERS = [...mods.footnoteSecondaryOneLine, FILL_LEADING];

/** The disclosure's revealed content, spaced off the label above it. */
const EXPANDED_CONTENT_MODIFIERS = [padding({ top: 10, bottom: 4 })];

/**
 * Exercise description. The `fixedSize` lets it wrap to its natural height
 * instead of being compressed to a single truncated line.
 */
const DESCRIPTION_MODIFIERS = [
  ...mods.footnoteSecondary,
  fixedSize({ horizontal: false, vertical: true }),
  FILL_LEADING,
];

/** The equipment list itself — primary content, kept to one line. */
const EQUIPMENT_VALUE_MODIFIERS = [...mods.footnoteLabel, lineLimit(1)];

const styles = StyleSheet.create({
  /**
   * The hand-rolled `insetGrouped` cell surface.
   *
   * `borderCurve: 'continuous'` is load-bearing: `GROUPED_ROW_RADIUS` was
   * measured against SwiftUI's squircle, not a circular arc, so dropping it
   * changes the corner shape at the same radius.
   *
   * `paddingHorizontal: 16` is a documented input to
   * `GROUPED_SEPARATOR_INSET` (16 + `ROW_GLYPH_SIZE` 22 + the label `HStack`'s
   * spacing 12 = 50). Nothing type-checks that relationship, and
   * `row-metrics.ts` records its values as measured rather than derived — so if
   * this padding changes, re-measure the inset, don't recompute it.
   *
   * The four corner radii are deliberately absent: `roundedTop` /
   * `roundedBottom` layer them on for the first and last row, and a list with a
   * single row gets both.
   */
  row: {
    backgroundColor: colors.secondarySystemGroupedBackground,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  roundedTop: {
    borderTopLeftRadius: GROUPED_ROW_RADIUS,
    borderTopRightRadius: GROUPED_ROW_RADIUS,
  },
  roundedBottom: {
    borderBottomLeftRadius: GROUPED_ROW_RADIUS,
    borderBottomRightRadius: GROUPED_ROW_RADIUS,
  },
});

export interface ExerciseRowProps {
  /** Exercise rendered by this row. */
  exercise: MergedExercise;
  /** Whether this is the first row of the group (rounds the top corners). */
  isFirst: boolean;
  /** Whether this is the last row of the group (rounds the bottom corners). */
  isLast: boolean;
  /** Whether the row's disclosure is open. */
  isExpanded: boolean;
  /**
   * Render as a redacted placeholder while the catalogue loads. The row keeps
   * its real structure and is disabled, so there is one code path and no
   * skeleton component.
   */
  isPlaceholder?: boolean;
  /** Fired with the disclosure's new expansion state. */
  onToggle: (isExpanded: boolean) => void;
  /** Open the detail sheet for this exercise. */
  onSelect: (exercise: MergedExercise) => void;
}

/**
 * One row of the exercise catalogue, styled as an `insetGrouped` cell.
 *
 * One `Host` per row wrapping a SwiftUI `DisclosureGroup`: the chevron rotation
 * and the reveal are UIKit's own animation, replacing the Reanimated
 * `useAnimatedStyle` + `FadeIn`/`FadeOut` pair that had to be kept in sync with
 * `LegendList`'s recycling — so nothing here can desync when the row is
 * recycled.
 *
 * The screen deliberately keeps `LegendList` instead of a SwiftUI `List` (the
 * catalogue is unbounded and `List` is not virtualized), so this row reproduces
 * the `insetGrouped` cell by hand — see `row-metrics.ts`.
 *
 * The remote artwork that used to sit in the collapsed row is gone: every seeded
 * exercise has `imageURL: null`, so the list rendered the *same* placeholder
 * photo dozens of times. The image lives in the detail sheet, which is where a
 * grouped list sends you for detail anyway.
 */
export const ExerciseRow = ({
  exercise,
  isFirst,
  isLast,
  isExpanded,
  isPlaceholder = false,
  onToggle,
  onSelect,
}: ExerciseRowProps) => {
  const colorScheme = useAppColorScheme();

  const equipment =
    exercise.equipment.length > 0
      ? exercise.equipment.join(', ')
      : 'No equipment';

  return (
    <View
      style={[
        styles.row,
        isFirst && styles.roundedTop,
        isLast && styles.roundedBottom,
      ]}
    >
      <Host matchContents={{ vertical: true }} colorScheme={colorScheme}>
        <DisclosureGroup
          isExpanded={isExpanded}
          onIsExpandedChange={onToggle}
          modifiers={
            isPlaceholder
              ? PLACEHOLDER_MODIFIERS
              : [
                  accessibilityLabel(
                    `${exercise.name}, ${isExpanded ? 'expanded' : 'collapsed'}`
                  ),
                  accessibilityIdentifier(`exercise-row-${exercise.id}`),
                ]
          }
        >
          <DisclosureGroup.Label>
            <HStack spacing={12}>
              <Image
                systemName={typeSymbol[exercise.type]}
                color={colors.secondaryLabel}
                modifiers={GLYPH_MODIFIERS}
              />
              <VStack
                alignment="leading"
                spacing={2}
                modifiers={TITLE_COLUMN_MODIFIERS}
              >
                <Text modifiers={NAME_MODIFIERS}>{exercise.name}</Text>
                <Text modifiers={SUBTITLE_MODIFIERS}>
                  {exercise.categoryName}
                </Text>
              </VStack>
            </HStack>
          </DisclosureGroup.Label>

          <VStack
            alignment="leading"
            spacing={12}
            modifiers={EXPANDED_CONTENT_MODIFIERS}
          >
            <Text modifiers={DESCRIPTION_MODIFIERS}>
              {exercise.description || 'No description available.'}
            </Text>

            <HStack>
              <Text modifiers={mods.footnoteSecondary}>Equipment</Text>
              <Spacer />
              <Text modifiers={EQUIPMENT_VALUE_MODIFIERS}>{equipment}</Text>
            </HStack>

            <HStack spacing={8}>
              <Button
                label="View Details"
                onPress={() => onSelect(exercise)}
                modifiers={[
                  ...mods.secondaryActionButton,
                  // The row's own accessibilityLabel combines its children, so
                  // both buttons otherwise announce as "<name>, expanded" and are
                  // only tellable apart by position. Give each a stable selector.
                  accessibilityIdentifier(`exercise-details-${exercise.id}`),
                ]}
              />
              {/* Carries no `onPress` — see `mods.primaryActionButtonDisabled`. */}
              <Button
                label="Add to Workout"
                modifiers={[
                  ...mods.primaryActionButtonDisabled,
                  accessibilityIdentifier(`exercise-add-${exercise.id}`),
                ]}
              />
            </HStack>
          </VStack>
        </DisclosureGroup>
      </Host>
    </View>
  );
};
