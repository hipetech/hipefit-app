import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import { View } from 'react-native';

import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/ui/accordion';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { CardContent } from '@/ui/card';
import { Image } from '@/ui/Image';
import { Progress } from '@/ui/progress';
import { Separator } from '@/ui/separator';
import { Text } from '@/ui/text';

interface ExerciseCardProps {
  exercise: MergedExercise;
  onSelect: (exercise: MergedExercise) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  onSelect,
}) => {
  return (
    <AccordionItem
      value={`exercise-${exercise.id}`}
      className="rounded-2xl border-0 bg-card px-4 py-2 shadow-sm"
    >
      <AccordionTrigger className="px-0">
        <Button
          variant="ghost"
          className="h-auto flex-1 flex-row overflow-hidden rounded-2xl bg-transparent p-0 shadow-none"
          onPress={() => onSelect(exercise)}
        >
          <Image
            className="h-[140px] w-[120px]"
            source={{
              uri: exercise.imageURL ?? EXERCISE_PLACEHOLDER_IMAGE,
            }}
            contentFit="cover"
            transition={200}
          />
          <CardContent className="flex-1 px-3 py-2">
            <View className="mb-2 flex-row items-start justify-between">
              <Text variant="h4" className="mr-2 flex-1">
                {exercise.name}
              </Text>
              <Badge variant="secondary">
                <Text variant="small" className="text-[10px]">
                  {capitalize(exercise.difficulty)}
                </Text>
              </Badge>
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
          </CardContent>
        </Button>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
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
              <Text>View Details</Text>
            </Button>
            <Button className="flex-1">
              <Text>Add to Workout</Text>
            </Button>
          </View>
        </View>
      </AccordionContent>
    </AccordionItem>
  );
};
