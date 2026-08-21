import type { MergedExercise } from '@hipefit/domain';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Host } from '@expo/ui';
import {
  BottomSheet,
  Button,
  Group,
  HStack,
  RNHostView,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  fixedSize,
  font,
  foregroundStyle,
  padding,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { Chip, Separator } from '@hipefit/ui';

import { Image } from '@/components/image';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

/** The sheet's content inset, plus the grabber that says it can be dragged. */
const SHEET_CONTENT_MODIFIERS = [
  padding({ leading: 16, trailing: 16, top: 8, bottom: 24 }),
  presentationDragIndicator('visible'),
];

/**
 * Exercise description. The `fixedSize` lets it wrap to its natural height
 * instead of being compressed to a single truncated line.
 */
const DESCRIPTION_MODIFIERS = [
  foregroundStyle(colors.secondaryLabel),
  fixedSize({ horizontal: false, vertical: true }),
];

const styles = StyleSheet.create({
  /**
   * The `Host` is a self-presenting overlay: the `BottomSheet` inside it draws
   * itself, so the host view must take no space in the layout.
   */
  host: { position: 'absolute' },
  /**
   * No `borderCurve` here: expo-image's `ImageStyle` has no such key (it lives
   * on `ViewStyle`), so setting it fails tsc.
   */
  artwork: {
    height: 200,
    borderRadius: 10,
  },
});

export interface ExerciseDetailSheetProps {
  /** Exercise to show, or `null` when nothing is selected. */
  exercise: MergedExercise | null;
  /** Whether the sheet is presented. */
  isPresented: boolean;
  /** Dismiss the sheet (Close button, swipe-down, or overlay tap). */
  onClose: () => void;
  /** "Add to Workout" action (currently just dismisses). */
  onAdd: () => void;
}

/**
 * Exercise detail sheet — a SwiftUI `BottomSheet` in its own `Host` island
 * (a self-presenting overlay). Replaces the heroui `Dialog`. The remote artwork
 * is the one piece SwiftUI can't render natively, so it is embedded via
 * `RNHostView` (expo-image); everything else is native SwiftUI.
 */
export const ExerciseDetailSheet = ({
  exercise,
  isPresented,
  onClose,
  onAdd,
}: ExerciseDetailSheetProps) => {
  const colorScheme = useAppColorScheme();
  const { width } = useWindowDimensions();
  const imageWidth = width - 32;

  return (
    <Host style={styles.host} pointerEvents="none" colorScheme={colorScheme}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
        fitToContents
      >
        <Group modifiers={SHEET_CONTENT_MODIFIERS}>
          {exercise ? (
            <VStack alignment="leading" spacing={16}>
              <VStack alignment="leading" spacing={4}>
                <Text
                  modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}
                >
                  {exercise.name}
                </Text>
                <Text modifiers={mods.footnoteSecondary}>
                  {`${exercise.categoryName} • ${
                    exercise.equipment.length > 0
                      ? exercise.equipment.join(', ')
                      : 'No equipment'
                  }`}
                </Text>
              </VStack>

              <RNHostView matchContents>
                <Image
                  source={{
                    uri: exercise.imageURL ?? EXERCISE_PLACEHOLDER_IMAGE,
                  }}
                  style={[styles.artwork, { width: imageWidth }]}
                  contentFit="cover"
                  transition={200}
                />
              </RNHostView>

              <Separator />

              {exercise.description ? (
                <VStack alignment="leading" spacing={8}>
                  <Text modifiers={[font({ textStyle: 'headline' })]}>
                    Description
                  </Text>
                  <Text modifiers={DESCRIPTION_MODIFIERS}>
                    {exercise.description}
                  </Text>
                </VStack>
              ) : null}

              {exercise.isCustom ? <Chip label="Custom Exercise" /> : null}

              <HStack spacing={12}>
                <Button
                  label="Close"
                  onPress={onClose}
                  modifiers={mods.secondaryActionButton}
                />
                {/* Disabled until a workout player exists. `onAdd` currently only
                  dismisses the sheet, and dismissal is the normal success
                  affordance — leaving this enabled reads as a successful add.
                  See `mods.primaryActionButtonDisabled`. */}
                <Button
                  label="Add to Workout"
                  onPress={onAdd}
                  modifiers={mods.primaryActionButtonDisabled}
                />
              </HStack>
            </VStack>
          ) : (
            <VStack>
              <Text> </Text>
            </VStack>
          )}
        </Group>
      </BottomSheet>
    </Host>
  );
};
