import type { WithId } from '@/database';
import type { Workout } from '@/database/types';
import { useCallback } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRoutineStore } from '@/features/routines/store/use-routine-store';
import { ActiveWorkoutBanner } from '@/features/workouts/active-workout-banner';
import { ChipBadge } from '@/features/workouts/chip-badge';
import { EmptyCard } from '@/features/workouts/empty-card';
import { RoutineCard } from '@/features/workouts/routine-card';
import { useWorkoutStore } from '@/features/workouts/store/use-workout-store';
import { WorkoutHistoryCard } from '@/features/workouts/workout-history-card';
import { WorkoutsSkeleton } from '@/features/workouts/workouts-skeleton';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { colors } from '@/theme/colors';
import { Text } from '@/ui/text';

const ItemSeparator = () => <View style={{ height: 12 }} />;

export default function Workouts() {
  const {
    workouts,
    inProgressWorkout,
    isLoading: workoutsLoading,
  } = useWorkoutStore();
  const { activeRoutines, isLoading: routinesLoading } = useRoutineStore();

  const colorScheme = useAppColorScheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - 40;

  const isLoading = workoutsLoading || routinesLoading;
  const completedWorkouts = workouts.filter(
    (w) => w.data.status !== 'in_progress'
  );

  const renderWorkoutItem = useCallback(
    ({ item: workout }: { item: WithId<Workout> }) => (
      <WorkoutHistoryCard
        workout={workout}
        width={contentWidth}
        colorScheme={colorScheme}
      />
    ),
    [contentWidth, colorScheme]
  );

  const ListHeader = useCallback(
    () => (
      <View>
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text variant="h1" style={{ marginBottom: 8, textAlign: 'left' }}>
            Workouts
          </Text>
          <Text variant="muted">Track your progress</Text>
        </View>

        {/* Active Workout Banner */}
        {inProgressWorkout && (
          <View style={{ marginBottom: 24 }}>
            <ActiveWorkoutBanner
              workout={inProgressWorkout}
              width={contentWidth}
              colorScheme={colorScheme}
            />
          </View>
        )}

        {/* Routines Section */}
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text variant="h4">My Routines</Text>
            <ChipBadge
              label={String(activeRoutines.length)}
              colorScheme={colorScheme}
            />
          </View>
          {activeRoutines.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {activeRoutines.map((routine) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    colorScheme={colorScheme}
                  />
                ))}
              </View>
            </ScrollView>
          ) : (
            <EmptyCard
              message="No routines yet"
              actionLabel="Create your first routine"
              width={contentWidth}
              colorScheme={colorScheme}
            />
          )}
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: colors.separator,
            marginBottom: 24,
          }}
        />

        {/* History Title */}
        <Text variant="h4" style={{ marginBottom: 16 }}>
          History
        </Text>
      </View>
    ),
    [inProgressWorkout, activeRoutines, contentWidth, colorScheme]
  );

  const ListEmpty = useCallback(
    () => (
      <EmptyCard
        message="No workouts yet"
        width={contentWidth}
        colorScheme={colorScheme}
      />
    ),
    [contentWidth, colorScheme]
  );

  if (isLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentContainerStyle={{
          paddingTop: 60,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 80,
        }}
      >
        <WorkoutsSkeleton width={contentWidth} colorScheme={colorScheme} />
      </ScrollView>
    );
  }

  return (
    <LegendList
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      contentContainerStyle={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 80,
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
