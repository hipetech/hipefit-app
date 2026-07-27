import type { ExerciseType } from '@/database';
import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import type { SFSymbol } from 'sf-symbols-typescript';
import { View } from 'react-native';
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
  buttonStyle,
  disabled,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  redacted,
} from '@expo/ui/swift-ui/modifiers';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { capitalize, humanizeKey } from '@/lib/format';
import { colors } from '@/theme/colors';

import { GROUPED_ROW_RADIUS, ROW_GLYPH_SIZE } from './row-metrics';

/** Leading glyph per exercise type — SF Symbols, so nothing is fetched. */
const typeSymbol: Record<ExerciseType, SFSymbol> = {
  strength: 'dumbbell',
  cardio: 'figure.run',
  bodyweight: 'figure.strengthtraining.functional',
};

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
      style={{
        backgroundColor: colors.secondarySystemGroupedBackground,
        borderCurve: 'continuous',
        borderTopLeftRadius: isFirst ? GROUPED_ROW_RADIUS : 0,
        borderTopRightRadius: isFirst ? GROUPED_ROW_RADIUS : 0,
        borderBottomLeftRadius: isLast ? GROUPED_ROW_RADIUS : 0,
        borderBottomRightRadius: isLast ? GROUPED_ROW_RADIUS : 0,
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <Host matchContents={{ vertical: true }} colorScheme={colorScheme}>
        <DisclosureGroup
          isExpanded={isExpanded}
          onIsExpandedChange={onToggle}
          modifiers={
            isPlaceholder
              ? [redacted('placeholder'), disabled(true)]
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
                modifiers={[
                  font({ textStyle: 'body' }),
                  frame({ width: ROW_GLYPH_SIZE, alignment: 'center' }),
                ]}
              />
              <VStack
                alignment="leading"
                spacing={2}
                modifiers={[
                  frame({ maxWidth: Infinity, alignment: 'leading' }),
                ]}
              >
                <Text
                  modifiers={[
                    font({ textStyle: 'body' }),
                    foregroundStyle(colors.label),
                    frame({ maxWidth: Infinity, alignment: 'leading' }),
                  ]}
                >
                  {exercise.name}
                </Text>
                <Text
                  modifiers={[
                    font({ textStyle: 'footnote' }),
                    foregroundStyle(colors.secondaryLabel),
                    lineLimit(1),
                    frame({ maxWidth: Infinity, alignment: 'leading' }),
                  ]}
                >
                  {`${humanizeKey(exercise.groupName)} • ${capitalize(
                    exercise.difficulty
                  )}`}
                </Text>
              </VStack>
            </HStack>
          </DisclosureGroup.Label>

          <VStack
            alignment="leading"
            spacing={12}
            modifiers={[padding({ top: 10, bottom: 4 })]}
          >
            <Text
              modifiers={[
                font({ textStyle: 'footnote' }),
                foregroundStyle(colors.secondaryLabel),
                // Let the description wrap to its natural height instead of
                // being compressed to a single truncated line.
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              {exercise.description || 'No description available.'}
            </Text>

            <HStack>
              <Text
                modifiers={[
                  font({ textStyle: 'footnote' }),
                  foregroundStyle(colors.secondaryLabel),
                ]}
              >
                Equipment
              </Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ textStyle: 'footnote' }),
                  foregroundStyle(colors.label),
                  lineLimit(1),
                ]}
              >
                {equipment}
              </Text>
            </HStack>

            <HStack spacing={8}>
              <Button
                label="View Details"
                onPress={() => onSelect(exercise)}
                modifiers={[
                  buttonStyle('bordered'),
                  frame({ maxWidth: Infinity }),
                  // The row's own accessibilityLabel combines its children, so
                  // both buttons otherwise announce as "<name>, expanded" and are
                  // only tellable apart by position. Give each a stable selector.
                  accessibilityIdentifier(`exercise-details-${exercise.id}`),
                ]}
              />
              {/*
                Adding an exercise to a workout is not built yet, so the button
                carries no `onPress`. `disabled(true)` makes that legible — the
                system greys it out and it stops taking taps — instead of
                rendering a fully prominent button that silently does nothing.
                Drop the modifier when the action lands.
              */}
              <Button
                label="Add to Workout"
                modifiers={[
                  buttonStyle('borderedProminent'),
                  frame({ maxWidth: Infinity }),
                  disabled(true),
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
