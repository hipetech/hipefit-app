import { ScrollView, View } from 'react-native';
import { Avatar, Button, Card, Chip, Skeleton } from 'heroui-native';

import { useRoutineStore } from '@/features/routines/store/use-routine-store';
import { useUserStore } from '@/features/user/store/use-user-store';
import { useWorkoutStore } from '@/features/workouts/store/use-workout-store';
import {
  formatDuration,
  formatRelativeDate,
  getGreeting,
  getInitials,
} from '@/lib/format';
import { Text } from '@/ui/text';

export default function Home() {
  const { profile, isLoading: userLoading } = useUserStore();
  const { recentWorkouts, isLoading: workoutsLoading } = useWorkoutStore();
  const { activeRoutines, isLoading: routinesLoading } = useRoutineStore();

  const isLoading = userLoading || workoutsLoading || routinesLoading;
  const displayName = profile?.displayName ?? '';
  const firstName = displayName.split(' ')[0] || 'there';
  const photoURL = profile?.photoURL ?? null;
  const stats = profile?.stats;
  const featuredRoutine = activeRoutines[0] ?? null;

  if (isLoading) {
    return (
      <ScrollView className="bg-background flex-1">
        <View className="p-5 pt-15">
          <View className="mb-6 flex-row items-center justify-between">
            <View className="flex-1 gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-36" />
            </View>
            <Skeleton className="h-12 w-12 rounded-full" />
          </View>
          <View className="mb-8 flex-row gap-3">
            <Skeleton className="h-[100px] flex-1 rounded-lg" />
            <Skeleton className="h-[100px] flex-1 rounded-lg" />
            <Skeleton className="h-[100px] flex-1 rounded-lg" />
          </View>
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="mb-6 h-[120px] w-full rounded-lg" />
          <Skeleton className="mb-4 h-6 w-40" />
          <View className="gap-3">
            <Skeleton className="h-[80px] w-full rounded-lg" />
            <Skeleton className="h-[80px] w-full rounded-lg" />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="bg-background flex-1">
      <View className="p-5 pt-15">
        {/* Header with Avatar */}
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-1">
            <Text variant="h1" className="mb-2 text-left">
              {getGreeting()}, {firstName}!
            </Text>
            <Text variant="muted">Ready for your workout?</Text>
          </View>
          <Avatar size="md" alt="User avatar">
            {photoURL ? <Avatar.Image source={{ uri: photoURL }} /> : null}
            <Avatar.Fallback>
              {displayName ? getInitials(displayName) : '?'}
            </Avatar.Fallback>
          </Avatar>
        </View>

        {/* Stats Cards */}
        <View className="mb-8 flex-row justify-between gap-3">
          <Card className="min-h-[100px] flex-1 justify-center">
            <Card.Body className="items-center justify-center p-4">
              <Text className="mb-1 text-2xl font-bold">
                {stats?.totalWorkouts ?? 0}
              </Text>
              <Text variant="small" className="text-center text-xs uppercase">
                Workouts
              </Text>
              <Text variant="muted" className="mt-0.5 text-[10px]">
                total
              </Text>
            </Card.Body>
          </Card>
          <Card className="min-h-[100px] flex-1 justify-center">
            <Card.Body className="items-center justify-center p-4">
              <Text className="mb-1 text-2xl font-bold">
                {stats?.currentStreak ?? 0}
              </Text>
              <Text variant="small" className="text-center text-xs uppercase">
                Streak
              </Text>
              <Text variant="muted" className="mt-0.5 text-[10px]">
                days
              </Text>
            </Card.Body>
          </Card>
          <Card className="min-h-[100px] flex-1 justify-center">
            <Card.Body className="items-center justify-center p-4">
              <Text className="mb-1 text-2xl font-bold">
                {stats?.longestStreak ?? 0}
              </Text>
              <Text variant="small" className="text-center text-xs uppercase">
                Best Streak
              </Text>
              <Text variant="muted" className="mt-0.5 text-[10px]">
                days
              </Text>
            </Card.Body>
          </Card>
        </View>

        {/* Featured Routine */}
        <View className="mb-8">
          <Text variant="h4" className="mb-4">
            Featured Routine
          </Text>
          {featuredRoutine ? (
            <Card className="overflow-hidden p-0">
              <View className="p-5">
                <Text className="mb-2 text-xl font-bold">
                  {featuredRoutine.data.name}
                </Text>
                {featuredRoutine.data.description ? (
                  <Text variant="muted" className="mb-3 text-sm">
                    {featuredRoutine.data.description}
                  </Text>
                ) : null}
                <View className="mb-4 flex-row gap-4">
                  <Text variant="muted">
                    {featuredRoutine.data.exercises.length} exercises
                  </Text>
                  {featuredRoutine.data.estimatedDuration ? (
                    <Text variant="muted">
                      {formatDuration(
                        featuredRoutine.data.estimatedDuration * 60
                      )}
                    </Text>
                  ) : null}
                </View>
                <Button className="self-start">
                  <Button.Label>Start Workout</Button.Label>
                </Button>
              </View>
            </Card>
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

        {/* Recent Workouts */}
        <View className="mb-8">
          <Text variant="h4" className="mb-4">
            Recent Workouts
          </Text>
          {recentWorkouts.length > 0 ? (
            <View className="gap-3">
              {recentWorkouts.map((workout) => (
                <Card key={workout.id} className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="mb-1 text-base font-semibold">
                        {workout.data.routineName ?? 'Quick Workout'}
                      </Text>
                      <View className="flex-row items-center gap-3">
                        <Text variant="muted" className="text-xs">
                          {formatDuration(workout.data.duration)}
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {workout.data.totalExercises} exercises
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {formatRelativeDate(workout.data.startedAt)}
                        </Text>
                      </View>
                    </View>
                    <Chip
                      variant={
                        workout.data.status === 'completed'
                          ? 'primary'
                          : 'secondary'
                      }
                      size="sm"
                    >
                      <Chip.Label className="text-[10px]">
                        {workout.data.status === 'completed'
                          ? 'Completed'
                          : 'Abandoned'}
                      </Chip.Label>
                    </Chip>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card className="p-5">
              <Text variant="muted" className="text-center">
                No workouts yet. Start your first workout!
              </Text>
            </Card>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
