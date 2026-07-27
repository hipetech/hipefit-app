import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import { useCallback, useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { Host } from '@expo/ui';
import { LegendList } from '@legendapp/list/react-native';
import { SymbolView } from 'expo-symbols';

import { DifficultyFilter } from '@/features/exercises/difficulty-filter';
import { ExerciseCard } from '@/features/exercises/exercise-card';
import { ExerciseDetailSheet } from '@/features/exercises/exercise-detail-sheet';
import { useExerciseStore } from '@/features/exercises/store/use-exercise-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { BRAND_SEED, colors } from '@/theme/colors';
import { Skeleton } from '@/ui/skeleton';
import { Text } from '@/ui/text';

const ItemSeparator = () => <View style={{ height: 12 }} />;

const LoadingState = () => {
  const colorScheme = useAppColorScheme();
  const { width } = useWindowDimensions();
  const contentWidth = width - 40;

  const block = (w: number, h: number, radius?: number) => (
    <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
      <Skeleton width={w} height={h} radius={radius} />
    </Host>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <View style={{ padding: 20, paddingTop: 60 }}>
        <View style={{ marginBottom: 24, gap: 8 }}>
          {block(128, 32)}
          {block(192, 16)}
        </View>
        <View style={{ marginBottom: 16 }}>{block(contentWidth, 40, 8)}</View>
        <View style={{ marginBottom: 16 }}>{block(contentWidth, 64, 8)}</View>
        <View style={{ gap: 12 }}>
          {block(contentWidth, 160, 16)}
          {block(contentWidth, 160, 16)}
          {block(contentWidth, 160, 16)}
        </View>
      </View>
    </ScrollView>
  );
};

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
      // The segmented control does not re-fire for the active segment, so this
      // guard is harmless; it also protects against redundant updates.
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
      <View
        style={{
          padding: 32,
          borderRadius: 16,
          backgroundColor: colors.secondarySystemBackground,
        }}
      >
        <Text variant="muted" style={{ textAlign: 'center' }}>
          No exercises found
        </Text>
      </View>
    ),
    []
  );

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
        {/* Fixed header: title, search, and difficulty filter stay pinned */}
        <View style={{ paddingHorizontal: 20, paddingTop: 60 }}>
          <View style={{ marginBottom: 24 }}>
            <Text variant="h1" style={{ marginBottom: 8 }}>
              Exercises
            </Text>
            <Text variant="muted">Build your exercise library</Text>
          </View>

          {/* Search Input */}
          <View style={{ marginBottom: 16, justifyContent: 'center' }}>
            <View
              style={{
                position: 'absolute',
                left: 12,
                zIndex: 10,
              }}
            >
              <SymbolView
                name="magnifyingglass"
                size={18}
                tintColor={colors.tertiaryLabel}
              />
            </View>
            <TextInput
              placeholder="Search exercises..."
              placeholderTextColor={colors.tertiaryLabel}
              value={searchQuery}
              onChangeText={handleSearchChange}
              style={{
                height: 44,
                paddingLeft: 40,
                paddingRight: 12,
                borderRadius: 12,
                backgroundColor: colors.secondarySystemBackground,
                color: colors.label,
                fontSize: 16,
              }}
            />
          </View>

          {/* Difficulty Filter */}
          <View
            style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.secondarySystemBackground,
              gap: 12,
            }}
          >
            <Text
              variant="small"
              style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Filter by Difficulty
            </Text>
            <DifficultyFilter
              value={difficultyFilter}
              onValueChange={handleDifficultyChange}
            />
          </View>
        </View>

        <LegendList
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: 0,
            paddingHorizontal: 20,
            paddingBottom: 24,
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

      {/* Exercise Detail Sheet */}
      <ExerciseDetailSheet
        exercise={selectedExercise}
        isPresented={dialogOpen}
        onClose={() => setSelectedExercise(null)}
        onAdd={() => setSelectedExercise(null)}
      />
    </>
  );
}
