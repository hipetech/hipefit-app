import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Button, Host } from '@expo/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FeaturedRoutineCard,
  HomeSkeleton,
  MessageCard,
  StatsRow,
  WorkoutRow,
} from '@/features/home/native';
import { useRoutineStore } from '@/features/routines/store/use-routine-store';
import { useUserStore } from '@/features/user/store/use-user-store';
import { useWorkoutStore } from '@/features/workouts/store/use-workout-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { formatDuration, formatRelativeDate, getGreeting } from '@/lib/format';
import { BRAND_SEED, colors } from '@/theme/colors';
import { Avatar } from '@/ui/avatar';
import { Text } from '@/ui/text';

const H_PADDING = 20;
const STAT_GAP = 12;

export default function Home() {
  const { profile, isLoading: userLoading } = useUserStore();
  const { recentWorkouts, isLoading: workoutsLoading } = useWorkoutStore();
  const { activeRoutines, isLoading: routinesLoading } = useRoutineStore();

  const colorScheme = useAppColorScheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const contentWidth = screenWidth - H_PADDING * 2;
  const statCardWidth = (contentWidth - STAT_GAP * 2) / 3;

  const isLoading = userLoading || workoutsLoading || routinesLoading;
  const displayName = profile?.displayName ?? '';
  const firstName = displayName.split(' ')[0] || 'there';
  const photoURL = profile?.photoURL ?? null;
  const stats = profile?.stats;
  const featuredRoutine = activeRoutines[0] ?? null;

  const contentContainerStyle = {
    padding: H_PADDING,
    paddingTop: insets.top + 20,
    paddingBottom: insets.bottom + 32,
    gap: 32,
  };

  if (isLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentContainerStyle={contentContainerStyle}
      >
        <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
          <HomeSkeleton
            contentWidth={contentWidth}
            statCardWidth={statCardWidth}
          />
        </Host>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      contentContainerStyle={contentContainerStyle}
    >
      {/* Header with Avatar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="h1" style={{ textAlign: 'left', marginBottom: 8 }}>
            {getGreeting()}, {firstName}!
          </Text>
          <Text variant="muted">Ready for your workout?</Text>
        </View>
        <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
          <Avatar source={photoURL} fallback={displayName || '?'} size={48} />
        </Host>
      </View>

      {/* Stats */}
      <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
        <StatsRow
          totalWorkouts={stats?.totalWorkouts ?? 0}
          currentStreak={stats?.currentStreak ?? 0}
          longestStreak={stats?.longestStreak ?? 0}
          cardWidth={statCardWidth}
        />
      </Host>

      {/* Featured Routine */}
      <View style={{ gap: 16 }}>
        <Text variant="h4">Featured Routine</Text>
        {featuredRoutine ? (
          <View style={{ gap: 12, alignItems: 'flex-start' }}>
            <Host
              matchContents
              seedColor={BRAND_SEED}
              colorScheme={colorScheme}
            >
              <FeaturedRoutineCard
                name={featuredRoutine.data.name}
                description={featuredRoutine.data.description}
                exercisesLabel={`${featuredRoutine.data.exercises.length} exercises`}
                durationLabel={
                  featuredRoutine.data.estimatedDuration
                    ? formatDuration(
                        featuredRoutine.data.estimatedDuration * 60
                      )
                    : undefined
                }
                width={contentWidth}
              />
            </Host>
            <Host
              matchContents
              seedColor={BRAND_SEED}
              colorScheme={colorScheme}
            >
              <Button variant="filled" label="Start Workout" />
            </Host>
          </View>
        ) : (
          <View style={{ gap: 12, alignItems: 'center' }}>
            <Host
              matchContents
              seedColor={BRAND_SEED}
              colorScheme={colorScheme}
            >
              <MessageCard message="No routines yet" width={contentWidth} />
            </Host>
            <Host
              matchContents
              seedColor={BRAND_SEED}
              colorScheme={colorScheme}
            >
              <Button variant="outlined" label="Create your first routine" />
            </Host>
          </View>
        )}
      </View>

      {/* Recent Workouts */}
      <View style={{ gap: 16 }}>
        <Text variant="h4">Recent Workouts</Text>
        {recentWorkouts.length > 0 ? (
          <View style={{ gap: 12 }}>
            {recentWorkouts.map((workout) => (
              <Host
                key={workout.id}
                matchContents
                seedColor={BRAND_SEED}
                colorScheme={colorScheme}
              >
                <WorkoutRow
                  title={workout.data.routineName ?? 'Quick Workout'}
                  durationLabel={formatDuration(workout.data.duration)}
                  exercisesLabel={`${workout.data.totalExercises} exercises`}
                  dateLabel={formatRelativeDate(workout.data.startedAt)}
                  statusLabel={
                    workout.data.status === 'completed'
                      ? 'Completed'
                      : 'Abandoned'
                  }
                  statusPrimary={workout.data.status === 'completed'}
                  width={contentWidth}
                />
              </Host>
            ))}
          </View>
        ) : (
          <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
            <MessageCard
              message="No workouts yet. Start your first workout!"
              width={contentWidth}
            />
          </Host>
        )}
      </View>
    </ScrollView>
  );
}
