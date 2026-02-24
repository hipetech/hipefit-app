import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Search } from 'lucide-react-native';

import { ExerciseCard } from '@/features/exercises/exercise-card';
import { useExerciseStore } from '@/features/exercises/store/use-exercise-store';
import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import { Accordion } from '@/ui/accordion';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Image } from '@/ui/Image';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Progress } from '@/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import { Separator } from '@/ui/separator';
import { Skeleton } from '@/ui/skeleton';
import { Text } from '@/ui/text';

export default function Exercises() {
  const { exercises, isLoading } = useExerciseStore();
  const [searchQuery, setSearchQuery] = useState('');

  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedExercise, setSelectedExercise] =
    useState<MergedExercise | null>(null);

  const dialogOpen = selectedExercise !== null;

  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch = exercise.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === 'all' || exercise.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-muted">
        <View className="pt-15 p-5">
          <View className="mb-6 gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </View>
          <Skeleton className="mb-4 h-10 w-full rounded-lg" />
          <Skeleton className="mb-4 h-16 w-full rounded-lg" />
          <View className="gap-3">
            <Skeleton className="h-[160px] w-full rounded-2xl" />
            <Skeleton className="h-[160px] w-full rounded-2xl" />
            <Skeleton className="h-[160px] w-full rounded-2xl" />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-muted">
      <View className="pt-15 p-5">
        <View className="mb-6">
          <Text variant="h1" className="mb-2">
            Exercises
          </Text>
          <Text variant="muted">Build your exercise library</Text>
        </View>

        {/* Search Input */}
        <View className="mb-4">
          <View className="relative">
            <View className="absolute left-3 top-3 z-10">
              <Search size={20} className="text-muted-foreground" />
            </View>
            <Input
              className="bg-card pl-10"
              placeholder="Search exercises..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Difficulty Filter with Radio Group */}
        <Card className="mb-4 p-4">
          <Text variant="small" className="mb-3 uppercase tracking-wide">
            Filter by Difficulty
          </Text>
          <RadioGroup
            value={difficultyFilter}
            onValueChange={setDifficultyFilter}
          >
            <View className="flex-row flex-wrap gap-4">
              <View className="flex-row items-center gap-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="ml-0">
                  <Text variant="small">All</Text>
                </Label>
              </View>
              <View className="flex-row items-center gap-2">
                <RadioGroupItem value="beginner" id="beginner" />
                <Label htmlFor="beginner" className="ml-0">
                  <Text variant="small">Beginner</Text>
                </Label>
              </View>
              <View className="flex-row items-center gap-2">
                <RadioGroupItem value="intermediate" id="intermediate" />
                <Label htmlFor="intermediate" className="ml-0">
                  <Text variant="small">Intermediate</Text>
                </Label>
              </View>
              <View className="flex-row items-center gap-2">
                <RadioGroupItem value="advanced" id="advanced" />
                <Label htmlFor="advanced" className="ml-0">
                  <Text variant="small">Advanced</Text>
                </Label>
              </View>
            </View>
          </RadioGroup>
        </Card>

        {/* Exercise List */}
        {filteredExercises.length === 0 ? (
          <Card className="p-8">
            <Text variant="muted" className="text-center">
              No exercises found
            </Text>
          </Card>
        ) : (
          <View className="gap-4">
            <Accordion type="single" collapsible className="gap-3">
              {filteredExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onSelect={setSelectedExercise}
                />
              ))}
            </Accordion>
          </View>
        )}

        {/* Exercise Detail Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) setSelectedExercise(null);
          }}
        >
          <DialogContent className="max-w-md">
            {selectedExercise && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedExercise.name}</DialogTitle>
                  <DialogDescription>
                    {selectedExercise.groupName} •{' '}
                    {selectedExercise.equipment.length > 0
                      ? selectedExercise.equipment.join(', ')
                      : 'No equipment'}
                  </DialogDescription>
                </DialogHeader>
                <View className="gap-4">
                  <Image
                    className="h-[200px] w-full rounded-lg"
                    source={{
                      uri:
                        selectedExercise.imageURL ?? EXERCISE_PLACEHOLDER_IMAGE,
                    }}
                    contentFit="cover"
                    transition={200}
                  />
                  <Separator />
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text variant="muted">Difficulty</Text>
                      <Badge variant="secondary">
                        <Text variant="small">
                          {capitalize(selectedExercise.difficulty)}
                        </Text>
                      </Badge>
                    </View>
                    <Progress
                      value={getDifficultyValue(selectedExercise.difficulty)}
                      className="h-2"
                    />
                  </View>
                  {selectedExercise.description ? (
                    <View className="gap-2">
                      <Text variant="h4" className="mb-2">
                        Description
                      </Text>
                      <Text variant="muted">
                        {selectedExercise.description}
                      </Text>
                    </View>
                  ) : null}
                  {selectedExercise.isCustom ? (
                    <Badge variant="secondary" className="self-start">
                      <Text variant="small">Custom Exercise</Text>
                    </Badge>
                  ) : null}
                </View>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onPress={() => setSelectedExercise(null)}
                  >
                    <Text>Close</Text>
                  </Button>
                  <Button onPress={() => setSelectedExercise(null)}>
                    <Text>Add to Workout</Text>
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </View>
    </ScrollView>
  );
}
