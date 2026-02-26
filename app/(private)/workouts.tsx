import type { WithId } from '@/database';
import type { Workout } from '@/database/types';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { LegendList } from '@legendapp/list';
import { Button, Card, Chip, Separator, Skeleton } from 'heroui-native';

import { useRoutineStore } from '@/features/routines/store/use-routine-store';
import { useWorkoutStore } from '@/features/workouts/store/use-workout-store';
import { formatDuration, formatShortDate, formatVolume } from '@/lib/format';
import { Text } from '@/ui/text';

const ItemSeparator = () => <View className="h-3" />;

export default function Workouts() {
  const {
    workouts,
    inProgressWorkout,
    isLoading: workoutsLoading,
  } = useWorkoutStore();
  const { activeRoutines, isLoading: routinesLoading } = useRoutineStore();

  const isLoading = workoutsLoading || routinesLoading;
  const completedWorkouts = workouts.filter(
    (w) => w.data.status !== 'in_progress'
  );

  const renderWorkoutItem = useCallback(
    ({ item: workout }: { item: WithId<Workout> }) => (
      <Card className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="mb-1 text-base font-semibold">
              {workout.data.routineName ?? 'Quick Workout'}
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              {formatShortDate(workout.data.startedAt)}
            </Text>
            <View className="flex-row items-center gap-3">
              <Text variant="muted" className="text-xs">
                {formatDuration(workout.data.duration)}
              </Text>
              <Text variant="muted" className="text-xs">
                {workout.data.totalExercises} exercises
              </Text>
              <Text variant="muted" className="text-xs">
                {formatVolume(workout.data.totalVolume)}
              </Text>
            </View>
          </View>
          <Chip
            variant={
              workout.data.status === 'completed' ? 'primary' : 'secondary'
            }
            size="sm"
          >
            <Chip.Label className="text-[10px]">
              {workout.data.status === 'completed' ? 'Completed' : 'Abandoned'}
            </Chip.Label>
          </Chip>
        </View>
      </Card>
    ),
    []
  );

  const ListHeader = useCallback(
    () => (
      <View>
        {/* Header */}
        <View className="mb-6">
          <Text variant="h1" className="mb-2">
            Workouts
          </Text>
          <Text variant="muted">Track your progress</Text>
        </View>

        {/* Active Workout Banner */}
        {inProgressWorkout && (
          <Card className="border-accent mb-6 border-2 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-bold">Workout in progress</Text>
                <Text variant="muted" className="text-sm">
                  {inProgressWorkout.data.routineName ?? 'Quick Workout'} •{' '}
                  {inProgressWorkout.data.totalExercises} exercises
                </Text>
              </View>
              <Button>
                <Button.Label>Continue</Button.Label>
              </Button>
            </View>
          </Card>
        )}

        {/* Routines Section */}
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text variant="h4">My Routines</Text>
            <Chip variant="secondary" size="sm">
              <Chip.Label>{activeRoutines.length}</Chip.Label>
            </Chip>
          </View>
          {activeRoutines.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-2"
            >
              <View className="flex-row gap-3">
                {activeRoutines.map((routine) => (
                  <Card key={routine.id} className="w-[200px] p-4">
                    <Text
                      className="mb-2 text-base font-bold"
                      numberOfLines={1}
                    >
                      {routine.data.name}
                    </Text>
                    <View className="gap-1">
                      <Text variant="muted" className="text-xs">
                        {routine.data.exercises.length} exercises
                      </Text>
                      {routine.data.estimatedDuration ? (
                        <Text variant="muted" className="text-xs">
                          ~{routine.data.estimatedDuration} min
                        </Text>
                      ) : null}
                      <Text variant="muted" className="text-xs">
                        Performed {routine.data.timesPerformed} times
                      </Text>
                    </View>
                    <Button className="mt-3" size="sm">
                      <Button.Label>Start</Button.Label>
                    </Button>
                  </Card>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Card className="p-5">
              <Text variant="muted" className="mb-3 text-center">
                No routines yet
              </Text>
              <Button variant="outline" className="self-center">
                <Button.Label>Create your first routine</Button.Label>
              </Button>
            </Card>
          )}
        </View>

        <Separator className="mb-6" />

        {/* History Title */}
        <Text variant="h4" className="mb-4">
          History
        </Text>
      </View>
    ),
    [inProgressWorkout, activeRoutines]
  );

  const ListEmpty = useCallback(
    () => (
      <Card className="p-5">
        <Text variant="muted" className="text-center">
          No workouts yet
        </Text>
      </Card>
    ),
    []
  );

  if (isLoading) {
    return (
      <ScrollView className="bg-background flex-1">
        <View className="p-5 pt-15">
          <View className="mb-6 gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </View>
          <Skeleton className="mb-4 h-6 w-32" />
          <View className="mb-6 flex-row gap-3">
            <Skeleton className="h-[120px] w-[200px] rounded-lg" />
            <Skeleton className="h-[120px] w-[200px] rounded-lg" />
          </View>
          <Skeleton className="mb-4 h-6 w-24" />
          <View className="gap-3">
            <Skeleton className="h-[80px] w-full rounded-lg" />
            <Skeleton className="h-[80px] w-full rounded-lg" />
            <Skeleton className="h-[80px] w-full rounded-lg" />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <LegendList
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 32,
      }}
      data={completedWorkouts}
      renderItem={renderWorkoutItem}
      keyExtractor={(item) => item.id}
      estimatedItemSize={90}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      ItemSeparatorComponent={ItemSeparator}
    />
  );
}
