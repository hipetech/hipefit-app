import type { ExerciseCardProps } from './exercise-card';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Chip } from '@/ui/chip';
import { Image } from '@/ui/Image';
import { Progress } from '@/ui/progress';
import { Separator } from '@/ui/separator';
import { Text } from '@/ui/text';

/**
 * Exercise card (Android fallback): RN card keeping the original Reanimated
 * expand/collapse (chevron rotation + fade). SwiftUI is iOS-only.
 */
export const ExerciseCard = ({
  exercise,
  onSelect,
  isExpanded,
  onToggle,
}: ExerciseCardProps) => {
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
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            overflow: 'hidden',
            borderRadius: 16,
          }}
        >
          <Image
            source={{ uri: exercise.imageURL ?? EXERCISE_PLACEHOLDER_IMAGE }}
            style={{ width: 120, height: 140 }}
            contentFit="cover"
            transition={200}
          />
          <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View
              style={{
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <Text variant="h4" style={{ marginRight: 8, flex: 1 }}>
                {exercise.name}
              </Text>
              <Chip label={capitalize(exercise.difficulty)} />
            </View>
            <View style={{ width: '100%', gap: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  variant="muted"
                  style={{ fontSize: 12, fontWeight: '500' }}
                >
                  Muscle Group:
                </Text>
                <Text variant="small" style={{ fontWeight: '600' }}>
                  {exercise.groupName}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  variant="muted"
                  style={{ fontSize: 12, fontWeight: '500' }}
                >
                  Equipment:
                </Text>
                <Text variant="small" style={{ fontWeight: '600' }}>
                  {equipment}
                </Text>
              </View>
              <View
                style={{
                  marginTop: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text variant="muted" style={{ fontSize: 12 }}>
                  Difficulty Level
                </Text>
                <Text variant="small" style={{ fontWeight: '600' }}>
                  {capitalize(exercise.difficulty)}
                </Text>
              </View>
              <Progress value={getDifficultyValue(exercise.difficulty)} />
            </View>
          </View>
        </View>
        <Animated.View style={[chevronStyle, { marginLeft: 8 }]}>
          <Text style={{ fontSize: 16, color: colors.secondaryLabel }}>⌄</Text>
        </Animated.View>
      </Pressable>
      {isExpanded ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ paddingHorizontal: 16, paddingBottom: 16 }}
        >
          <Separator />
          <View style={{ gap: 12, marginTop: 16 }}>
            <View style={{ gap: 8 }}>
              <Text variant="h4" style={{ fontSize: 14 }}>
                Description
              </Text>
              <Text variant="muted" style={{ fontSize: 14 }}>
                {exercise.description || 'No description available.'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => onSelect(exercise)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.separator,
                }}
              >
                <Text style={{ fontWeight: '600' }}>View Details</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.brand,
                }}
              >
                <Text
                  style={{ color: colors.brandForeground, fontWeight: '600' }}
                >
                  Add to Workout
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
};
