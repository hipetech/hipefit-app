import type { Difficulty } from '@/database';
import type { MergedExercise } from '@/features/exercises/store/use-exercise-store';
import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { Stack } from 'expo-router';

import { ExerciseDetailSheet } from '@/features/exercises/exercise-detail-sheet';
import { ExerciseRow } from '@/features/exercises/exercise-row';
import { ExercisesEmpty } from '@/features/exercises/exercises-empty';
import {
  GROUPED_SECTION_MARGIN,
  GROUPED_SEPARATOR_INSET,
} from '@/features/exercises/row-metrics';
import { useExerciseStore } from '@/features/exercises/store/use-exercise-store';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { layout } from '@/theme/styles';

type DifficultyFilterValue = Difficulty | 'all';

/**
 * Six redacted rows stand in for the catalogue while it loads: the real row
 * structure, disabled and `redacted('placeholder')` on iOS. One code path, no
 * skeleton component, no early return.
 */
const PLACEHOLDER_EXERCISES: MergedExercise[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `placeholder-${index}`,
    isCustom: false,
    name: 'Barbell Bench Press',
    description: 'Loading the exercise description.',
    type: 'strength',
    groupId: 'placeholder',
    groupName: 'Chest',
    equipment: ['barbell'],
    difficulty: 'intermediate',
    imageURL: null,
  })
);

const styles = StyleSheet.create({
  /** Row surface the hairline is painted on, inset past the leading glyph. */
  separatorRow: {
    backgroundColor: colors.secondarySystemGroupedBackground,
    paddingLeft: GROUPED_SEPARATOR_INSET,
  },
  /** The hairline itself — `hairlineWidth` stays symbolic, never frozen to a number. */
  separatorLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  /**
   * No bottom padding for the create affordance any more. It used to be a
   * circle floating *above* the tab bar, which `contentInsetAdjustmentBehavior`
   * knows nothing about, so the last row needed extra clearance to avoid
   * scrolling underneath it. The button is now a tab bar item beside the bar, so
   * the automatic inset already covers everything on screen.
   */
  listContent: {
    paddingHorizontal: GROUPED_SECTION_MARGIN,
    paddingTop: 8,
  },
});

/**
 * Hairline between rows, inset past the leading glyph and painted on the row
 * surface so the flat list reads as one continuous `insetGrouped` section.
 */
const ItemSeparator = () => (
  <View style={styles.separatorRow}>
    <View style={styles.separatorLine} />
  </View>
);

export default function Exercises() {
  const { exercises, isLoading } = useExerciseStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilterValue>('all');
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

  const rows = isLoading ? PLACEHOLDER_EXERCISES : filteredExercises;
  const isFiltered = searchQuery.length > 0 || difficultyFilter !== 'all';

  // Collapse any expanded row when the visible list changes
  const handleSearchChange = useCallback(
    (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setSearchQuery(event.nativeEvent.text);
      setExpandedId(null);
    },
    []
  );

  const handleDifficultyChange = useCallback(
    (value: DifficultyFilterValue) => {
      // Re-picking the option that already has the checkmark changes nothing,
      // so it earns no tick — haptics mark state changes, not taps.
      if (value !== difficultyFilter) {
        hapticSelection();
      }
      setDifficultyFilter(value);
      setExpandedId(null);
    },
    [difficultyFilter]
  );

  const renderExerciseItem = useCallback(
    ({ item, index }: { item: MergedExercise; index: number }) => (
      <ExerciseRow
        exercise={item}
        isFirst={index === 0}
        isLast={index === rows.length - 1}
        isExpanded={expandedId === item.id}
        isPlaceholder={isLoading}
        // The redacted rows are `disabled(true)`, so neither callback can fire
        // while loading — the `isLoading` guards keep that true even if a
        // platform variant ever stops disabling them.
        onToggle={(nextExpanded) => {
          if (!isLoading) {
            hapticSelection();
          }
          setExpandedId(nextExpanded ? item.id : null);
        }}
        onSelect={(selected) => {
          if (!isLoading) {
            hapticImpact();
          }
          setSelectedExercise(selected);
        }}
      />
    ),
    [expandedId, isLoading, rows.length]
  );

  const ListEmpty = useCallback(
    () => <ExercisesEmpty isFiltered={isFiltered} />,
    [isFiltered]
  );

  return (
    <>
      <LegendList
        style={layout.groupedScreen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        data={rows}
        renderItem={renderExerciseItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={64}
        extraData={expandedId}
        maintainVisibleContentPosition={false}
        ListEmptyComponent={ListEmpty}
        ItemSeparatorComponent={ItemSeparator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      <Stack.Screen.Title large>Exercises</Stack.Screen.Title>
      {/*
        Difficulty filter, moved out of its hand-drawn labeled card into the
        native place for a list filter (the Files / Photos idiom): a trailing
        header menu with a checkmark on the active option. Every
        `Stack.Toolbar.*` child must be declared inline, not via a wrapper
        component, so the four options are written out rather than mapped.
      */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            difficultyFilter === 'all'
              ? 'line.3.horizontal.decrease.circle'
              : 'line.3.horizontal.decrease.circle.fill'
          }
          title="Difficulty"
          accessibilityLabel="Filter by difficulty"
        >
          <Stack.Toolbar.MenuAction
            isOn={difficultyFilter === 'all'}
            onPress={() => handleDifficultyChange('all')}
          >
            All
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            isOn={difficultyFilter === 'beginner'}
            onPress={() => handleDifficultyChange('beginner')}
          >
            Beginner
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            isOn={difficultyFilter === 'intermediate'}
            onPress={() => handleDifficultyChange('intermediate')}
          >
            Intermediate
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            isOn={difficultyFilter === 'advanced'}
            onPress={() => handleDifficultyChange('advanced')}
          >
            Advanced
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      {/*
        `hideWhenScrolling` must be false. UIKit's default (true) hides the
        search bar on first appearance and only reveals it when the user drags
        past the top — and that drag never lands here, because the SwiftUI
        exercise rows swallow the upward pan. The result is a search bar that
        renders nowhere. Pinning it visible is also the better fit for a screen
        whose whole purpose is finding an exercise.
      */}
      <Stack.SearchBar
        hideWhenScrolling={false}
        placeholder="Search exercises"
        onChangeText={handleSearchChange}
      />

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
