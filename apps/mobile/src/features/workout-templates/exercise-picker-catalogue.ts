import type {
  MergedCategory,
  MergedExercise,
} from '@/features/exercises/exercise-catalogue';
import type { Ref } from '@hipefit/schemas';

/** What the picker lists below the search field after a card is tapped. */
export type ExercisePickerScope = 'all' | Ref;

/** One card in the picker's category grid. */
export interface ExercisePickerCategoryTile {
  scope: ExercisePickerScope;
  name: string;
  /** An SF Symbol name. Custom categories can carry none. */
  icon: string | null;
  exerciseCount: number;
  selectedCount: number;
}

/** One section of the picker's exercise list. */
export interface ExercisePickerSection {
  key: string;
  /** Section heading. `null` draws a section without one. */
  title: string | null;
  exercises: MergedExercise[];
}

/** Whether the exercise name contains the query, ignoring case and padding. */
export const matchesQuery = (exercise: MergedExercise, query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  return !needle || exercise.name.toLocaleLowerCase().includes(needle);
};

/**
 * The grid's cards: All first, then each published category that holds at
 * least one visible exercise, in the order the exercise store publishes them.
 * A category with nothing to pick is left out.
 */
export const buildCategoryTiles = (
  exercises: MergedExercise[],
  categories: MergedCategory[],
  selectedRefs: ReadonlySet<Ref>
): ExercisePickerCategoryTile[] => {
  const counts = new Map<Ref, { exercises: number; selected: number }>();
  let selectedTotal = 0;
  for (const exercise of exercises) {
    const isSelected = selectedRefs.has(exercise.ref);
    if (isSelected) selectedTotal += 1;
    const count = counts.get(exercise.categoryRef) ?? {
      exercises: 0,
      selected: 0,
    };
    count.exercises += 1;
    if (isSelected) count.selected += 1;
    counts.set(exercise.categoryRef, count);
  }

  const categoryTiles = categories.flatMap((category) => {
    const count = counts.get(category.ref);
    return count
      ? [
          {
            scope: category.ref,
            name: category.name,
            icon: category.icon,
            exerciseCount: count.exercises,
            selectedCount: count.selected,
          },
        ]
      : [];
  });

  return [
    {
      scope: 'all',
      name: 'All',
      icon: 'square.grid.2x2',
      exerciseCount: exercises.length,
      selectedCount: selectedTotal,
    },
    ...categoryTiles,
  ];
};

/**
 * Groups exercises by category in the order the store publishes them. The
 * store sorts by category order, then name, but exercises whose category is not
 * published share one sort key and interleave by name, so groups are keyed by
 * ref rather than built from consecutive runs.
 */
export const groupByCategory = (
  exercises: MergedExercise[]
): ExercisePickerSection[] => {
  const sections = new Map<Ref, ExercisePickerSection>();
  for (const exercise of exercises) {
    const section = sections.get(exercise.categoryRef);
    if (section) {
      section.exercises.push(exercise);
    } else {
      sections.set(exercise.categoryRef, {
        key: exercise.categoryRef,
        title: exercise.categoryName,
        exercises: [exercise],
      });
    }
  }
  return [...sections.values()];
};
