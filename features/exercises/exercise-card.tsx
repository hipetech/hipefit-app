import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import { Pressable, View } from 'react-native';
import { Button, Chip, Separator } from 'heroui-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import { Image } from '@/ui/Image';
import { Progress } from '@/ui/progress';
import { Text } from '@/ui/text';

interface ExerciseCardProps {
  exercise: MergedExercise;
  onSelect: (exercise: MergedExercise) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  onSelect,
  isExpanded,
  onToggle,
}) => {
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: withTiming(isExpanded ? '180deg' : '0deg', { duration: 200 }) },
    ],
  }));

  return (
    <View className="bg-surface rounded-2xl border-0 px-4 py-2 shadow-sm">
      <Pressable onPress={onToggle} className="flex-row items-center py-2">
        <View className="flex-1 flex-row overflow-hidden rounded-2xl">
          <Image
            className="h-[140px] w-[120px]"
            source={{
              uri: exercise.imageURL ?? EXERCISE_PLACEHOLDER_IMAGE,
            }}
            contentFit="cover"
            transition={200}
          />
          <View className="flex-1 px-3 py-2">
            <View className="mb-2 flex-row items-start justify-between">
              <Text variant="h4" className="mr-2 flex-1">
                {exercise.name}
              </Text>
              <Chip variant="secondary" size="sm">
                <Chip.Label className="text-[10px]">
                  {capitalize(exercise.difficulty)}
                </Chip.Label>
              </Chip>
            </View>
            <View className="w-full gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="muted" className="text-xs font-medium">
                  Muscle Group:
                </Text>
                <Text variant="small" className="font-semibold">
                  {exercise.groupName}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="muted" className="text-xs font-medium">
                  Equipment:
                </Text>
                <Text variant="small" className="font-semibold">
                  {exercise.equipment.length > 0
                    ? exercise.equipment.join(', ')
                    : 'None'}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center justify-between">
                <Text variant="muted" className="text-xs">
                  Difficulty Level
                </Text>
                <Text variant="small" className="font-semibold">
                  {capitalize(exercise.difficulty)}
                </Text>
              </View>
              <Progress value={getDifficultyValue(exercise.difficulty)} />
            </View>
          </View>
        </View>
        <Animated.View style={chevronStyle} className="ml-2">
          <ChevronDown size={16} className="text-muted" />
        </Animated.View>
      </Pressable>
      {isExpanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          className="px-4 pb-4"
        >
          <Separator className="mb-4" />
          <View className="gap-3">
            <View className="gap-2">
              <Text variant="h4" className="text-sm">
                Description
              </Text>
              <Text variant="muted" className="text-sm">
                {exercise.description || 'No description available.'}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => onSelect(exercise)}
              >
                <Button.Label>View Details</Button.Label>
              </Button>
              <Button className="flex-1">
                <Button.Label>Add to Workout</Button.Label>
              </Button>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};
