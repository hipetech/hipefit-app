import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  Input,
  RadioGroup,
  Separator,
  Skeleton,
  TextField,
} from 'heroui-native';
import { Search } from 'lucide-react-native';

import { ExerciseCard } from '@/features/exercises/exercise-card';
import { useExerciseStore } from '@/features/exercises/store/use-exercise-store';
import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import { Image } from '@/ui/Image';
import { Progress } from '@/ui/progress';
import { TAB_BAR_TOTAL_HEIGHT } from '@/ui/tab-bar';
import { Text } from '@/ui/text';

const ItemSeparator = () => <View className="h-3" />;

export default function Exercises() {
  const { exercises, isLoading } = useExerciseStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedExercise, setSelectedExercise] =
    useState<MergedExercise | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dialogOpen = selectedExercise !== null;

  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch = exercise.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === 'all' || exercise.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  // Collapse any expanded card when the visible list changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setExpandedId(null);
  }, []);

  const handleDifficultyChange = useCallback(
    (value: string) => {
      // RadioGroup fires on every tap, including re-taps of the active value.
      // Bail early so re-tapping the current filter leaves the card expanded.
      if (value === difficultyFilter) return;
      setDifficultyFilter(value);
      setExpandedId(null);
    },
    [difficultyFilter]
  );

  const renderExerciseItem = useCallback(
    ({ item: exercise }: { item: MergedExercise }) => (
      <ExerciseCard
        exercise={exercise}
        onSelect={setSelectedExercise}
        isExpanded={expandedId === exercise.id}
        onToggle={() =>
          setExpandedId((prev) => (prev === exercise.id ? null : exercise.id))
        }
      />
    ),
    [expandedId]
  );

  const ListEmpty = useCallback(
    () => (
      <Card className="p-8">
        <Text variant="muted" className="text-center">
          No exercises found
        </Text>
      </Card>
    ),
    []
  );

  if (isLoading) {
    return (
      <ScrollView
        className="bg-background flex-1"
        contentContainerStyle={{ paddingBottom: TAB_BAR_TOTAL_HEIGHT }}
      >
        <View className="p-5 pt-15">
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
    <>
      <View className="bg-background flex-1">
        {/* Fixed header: title, search, and difficulty filter stay pinned */}
        <View className="px-5 pt-15">
          <View className="mb-6">
            <Text variant="h1" className="mb-2">
              Exercises
            </Text>
            <Text variant="muted">Build your exercise library</Text>
          </View>

          {/* Search Input */}
          <View className="mb-4">
            <TextField>
              <View className="relative">
                <View className="absolute top-3 left-3 z-10">
                  <Search size={20} className="text-muted" />
                </View>
                <Input
                  className="pl-10"
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                />
              </View>
            </TextField>
          </View>

          {/* Difficulty Filter with Radio Group */}
          <Card className="mb-4 p-4">
            <Text variant="small" className="mb-3 tracking-wide uppercase">
              Filter by Difficulty
            </Text>
            <RadioGroup
              value={difficultyFilter}
              onValueChange={handleDifficultyChange}
            >
              <View className="flex-row flex-wrap gap-4">
                <RadioGroup.Item value="all">All</RadioGroup.Item>
                <RadioGroup.Item value="beginner">Beginner</RadioGroup.Item>
                <RadioGroup.Item value="intermediate">
                  Intermediate
                </RadioGroup.Item>
                <RadioGroup.Item value="advanced">Advanced</RadioGroup.Item>
              </View>
            </RadioGroup>
          </Card>
        </View>

        <LegendList
          className="flex-1"
          contentContainerStyle={{
            paddingTop: 0,
            paddingHorizontal: 20,
            paddingBottom: TAB_BAR_TOTAL_HEIGHT,
          }}
          data={filteredExercises}
          renderItem={renderExerciseItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={180}
          extraData={expandedId}
          maintainVisibleContentPosition={false}
          ListEmptyComponent={ListEmpty}
          ItemSeparatorComponent={ItemSeparator}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </View>

      {/* Exercise Detail Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedExercise(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            {selectedExercise && (
              <>
                <Dialog.Title>{selectedExercise.name}</Dialog.Title>
                <Dialog.Description>
                  {selectedExercise.groupName} •{' '}
                  {selectedExercise.equipment.length > 0
                    ? selectedExercise.equipment.join(', ')
                    : 'No equipment'}
                </Dialog.Description>
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
                      <Chip variant="secondary" size="sm">
                        <Chip.Label>
                          {capitalize(selectedExercise.difficulty)}
                        </Chip.Label>
                      </Chip>
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
                    <Chip variant="secondary" className="self-start">
                      <Chip.Label>Custom Exercise</Chip.Label>
                    </Chip>
                  ) : null}
                </View>
                <View className="mt-4 flex-row justify-end gap-3">
                  <Button
                    variant="outline"
                    onPress={() => setSelectedExercise(null)}
                  >
                    <Button.Label>Close</Button.Label>
                  </Button>
                  <Button onPress={() => setSelectedExercise(null)}>
                    <Button.Label>Add to Workout</Button.Label>
                  </Button>
                </View>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
