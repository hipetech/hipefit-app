import type { ExerciseDetailSheetProps } from './exercise-detail-sheet';
import { useWindowDimensions } from 'react-native';
import { Host } from '@expo/ui';
import {
  BottomSheet,
  Button,
  Group,
  HStack,
  ProgressView,
  RNHostView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundColor,
  frame,
  padding,
  presentationDragIndicator,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import { BRAND_SEED, colors } from '@/theme/colors';
import { Chip } from '@/ui/chip';
import { Image } from '@/ui/Image';
import { Separator } from '@/ui/separator';

/**
 * Exercise detail sheet (SwiftUI `BottomSheet`). Replaces the heroui `Dialog`.
 * The remote artwork is the one piece SwiftUI can't render natively, so it is
 * embedded via `RNHostView` (expo-image); everything else is native SwiftUI.
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
    <Host
      style={{ position: 'absolute' }}
      pointerEvents="none"
      seedColor={BRAND_SEED}
      colorScheme={colorScheme}
    >
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
        fitToContents
      >
        <Group
          modifiers={[
            padding({ leading: 16, trailing: 16, top: 8, bottom: 24 }),
            presentationDragIndicator('visible'),
          ]}
        >
          {exercise ? (
            <VStack alignment="leading" spacing={16}>
              <VStack alignment="leading" spacing={4}>
                <Text modifiers={[font({ size: 22, weight: 'bold' })]}>
                  {exercise.name}
                </Text>
                <Text
                  modifiers={[
                    font({ textStyle: 'footnote' }),
                    foregroundColor(colors.secondaryLabel),
                  ]}
                >
                  {`${exercise.groupName} • ${
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
                  style={{ width: imageWidth, height: 200, borderRadius: 8 }}
                  contentFit="cover"
                  transition={200}
                />
              </RNHostView>

              <Separator />

              <HStack>
                <Text modifiers={[foregroundColor(colors.secondaryLabel)]}>
                  Difficulty
                </Text>
                <Spacer />
                <Chip label={capitalize(exercise.difficulty)} />
              </HStack>
              <ProgressView
                value={getDifficultyValue(exercise.difficulty) / 100}
                modifiers={[tint(colors.brand)]}
              />

              {exercise.description ? (
                <VStack alignment="leading" spacing={8}>
                  <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>
                    Description
                  </Text>
                  <Text modifiers={[foregroundColor(colors.secondaryLabel)]}>
                    {exercise.description}
                  </Text>
                </VStack>
              ) : null}

              {exercise.isCustom ? <Chip label="Custom Exercise" /> : null}

              <HStack spacing={12}>
                <Button
                  label="Close"
                  onPress={onClose}
                  modifiers={[
                    buttonStyle('bordered'),
                    frame({ maxWidth: Infinity }),
                  ]}
                />
                <Button
                  label="Add to Workout"
                  onPress={onAdd}
                  modifiers={[
                    buttonStyle('borderedProminent'),
                    tint(colors.brand),
                    frame({ maxWidth: Infinity }),
                  ]}
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
