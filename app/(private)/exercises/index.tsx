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

/**
 * Six redacted rows stand in for the catalogue while it loads: the real row
 * structure, disabled and `redacted('placeholder')` on iOS. One code path, no
 * skeleton component, no early return.
 */
const PLACEHOLDER_EXERCISES: MergedExercise[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `placeholder-${index}`,
    ref: `global:placeholder-${index}`,
    isCustom: false,
    name: 'Barbell Bench Press',
    description: 'Loading the exercise description.',
    type: 'strength',
    categoryRef: 'global:placeholder',
    categoryName: 'Chest',
    equipmentRefs: ['global:barbell'],
    equipment: ['Barbell'],
    imageURL: null,
    isRetired: false,
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
  const [selectedExercise, setSelectedExercise] =
    useState<MergedExercise | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dialogOpen = selectedExercise !== null;

  const filteredExercises = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const rows = isLoading ? PLACEHOLDER_EXERCISES : filteredExercises;
  const isFiltered = searchQuery.length > 0;

  // Collapse any expanded row when the visible list changes
  const handleSearchChange = useCallback(
    (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setSearchQuery(event.nativeEvent.text);
      setExpandedId(null);
    },
    []
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
