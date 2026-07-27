import type { ExerciseCardProps } from './exercise-card';
import { Pressable, View } from 'react-native';
import { Host } from '@expo/ui';
import {
  Button,
  HStack,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundColor,
  frame,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import { BRAND_SEED, colors } from '@/theme/colors';
import { Chip } from '@/ui/chip';
import { Image } from '@/ui/Image';
import { Separator } from '@/ui/separator';

/**
 * Exercise card (iOS, hybrid). The card surface, remote artwork (expo-image),
 * and the Reanimated expand/collapse (chevron rotation + FadeIn/FadeOut) stay in
 * RN — reliable inside the recycled `LegendList`. The native text column and the
 * expanded actions are each their own `Host` island (no RNHostView, no
 * remote-image-in-SwiftUI). Prop contract unchanged.
 */
export const ExerciseCard = ({
  exercise,
  onSelect,
  isExpanded,
  onToggle,
}: ExerciseCardProps) => {
  const colorScheme = useAppColorScheme();

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: withTiming(isExpanded ? '180deg' : '0deg', { duration: 200 }) },
    ],
  }));

  const equipment =
    exercise.equipment.length > 0 ? exercise.equipment.join(', ') : 'None';

  return (
    <View
      style={{
        backgroundColor: colors.secondarySystemBackground,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
        }}
      >
        <Image
          source={{ uri: exercise.imageURL ?? EXERCISE_PLACEHOLDER_IMAGE }}
          style={{ width: 120, height: 140, borderRadius: 16 }}
          contentFit="cover"
          transition={200}
        />

        {/* Native text column — Host island #1 */}
        <Host
          style={{ flex: 1, marginLeft: 12 }}
          matchContents={{ vertical: true }}
          seedColor={BRAND_SEED}
          colorScheme={colorScheme}
        >
          <VStack alignment="leading" spacing={8}>
            <HStack alignment="top" spacing={8}>
              <Text
                modifiers={[
                  font({ size: 17, weight: 'semibold' }),
                  frame({ maxWidth: Infinity, alignment: 'leading' }),
                ]}
              >
                {exercise.name}
              </Text>
              <Chip label={capitalize(exercise.difficulty)} />
            </HStack>

            <HStack>
              <Text
                modifiers={[
                  font({ size: 12, weight: 'medium' }),
                  foregroundColor(colors.secondaryLabel),
                ]}
              >
                Muscle Group:
              </Text>
              <Spacer />
              <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>
                {exercise.groupName}
              </Text>
            </HStack>

            <HStack>
              <Text
                modifiers={[
                  font({ size: 12, weight: 'medium' }),
                  foregroundColor(colors.secondaryLabel),
                ]}
              >
                Equipment:
              </Text>
              <Spacer />
              <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>
                {equipment}
              </Text>
            </HStack>

            <HStack>
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundColor(colors.secondaryLabel),
                ]}
              >
                Difficulty Level
              </Text>
              <Spacer />
              <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>
                {capitalize(exercise.difficulty)}
              </Text>
            </HStack>

            <ProgressView
              value={getDifficultyValue(exercise.difficulty) / 100}
              modifiers={[tint(colors.label)]}
            />
          </VStack>
        </Host>

        <Animated.View style={[chevronStyle, { marginLeft: 8 }]}>
          <SymbolView
            name="chevron.down"
            size={16}
            tintColor={colors.secondaryLabel}
          />
        </Animated.View>
      </Pressable>

      {isExpanded ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ paddingHorizontal: 16, paddingBottom: 16 }}
        >
          {/* Divider + description + actions — Host island #2 */}
          <Host
            matchContents={{ vertical: true }}
            seedColor={BRAND_SEED}
            colorScheme={colorScheme}
          >
            <VStack alignment="leading" spacing={12}>
              <Separator />
              <VStack alignment="leading" spacing={8}>
                <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>
                  Description
                </Text>
                <Text
                  modifiers={[
                    font({ size: 14 }),
                    foregroundColor(colors.secondaryLabel),
                  ]}
                >
                  {exercise.description || 'No description available.'}
                </Text>
              </VStack>
              <HStack spacing={8}>
                <Button
                  label="View Details"
                  onPress={() => onSelect(exercise)}
                  modifiers={[
                    buttonStyle('bordered'),
                    frame({ maxWidth: Infinity }),
                  ]}
                />
                <Button
                  label="Add to Workout"
                  modifiers={[
                    buttonStyle('borderedProminent'),
                    tint(colors.brand),
                    frame({ maxWidth: Infinity }),
                  ]}
                />
              </HStack>
            </VStack>
          </Host>
        </Animated.View>
      ) : null}
    </View>
  );
};
