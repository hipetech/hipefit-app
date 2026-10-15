import type { UnitSystem } from '@/lib/units';
import type {
  ExerciseType,
  TemplateExercise,
  TemplateSet,
  WorkoutTemplate,
} from '@hipefit/schemas';

import {
  fromStoredDistance,
  fromStoredDuration,
  fromStoredWeight,
  getUnitLabels,
} from '@/lib/units';

const formatCount = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

/** Total planned sets across every exercise in a template. */
export const countTemplateSets = (template: WorkoutTemplate): number =>
  template.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0
  );

/** "1 exercise", "8 exercises". */
export const formatExerciseCount = (count: number): string =>
  formatCount(count, 'exercise', 'exercises');

/** "1 set", "24 sets". */
export const formatSetCount = (count: number): string =>
  formatCount(count, 'set', 'sets');

/** Adjacent exercises of one superset, or a single exercise, in template order. */
export interface TemplateExerciseGroup {
  /** The superset id, or the exercise's index for a single exercise. */
  key: string;
  supersetId: string | null;
  /** The superset's note, from its first exercise. */
  supersetNotes: string | null;
  exercises: TemplateExercise[];
}

/** Splits a template's exercises into supersets and single exercises, keeping their order. */
export const groupTemplateExercises = (
  exercises: TemplateExercise[]
): TemplateExerciseGroup[] => {
  const groups: TemplateExerciseGroup[] = [];
  exercises.forEach((exercise, index) => {
    const last = groups[groups.length - 1];
    if (
      exercise.supersetId !== null &&
      last !== undefined &&
      last.supersetId === exercise.supersetId
    ) {
      last.exercises.push(exercise);
      return;
    }
    groups.push({
      key: exercise.supersetId ?? `exercise-${index}`,
      supersetId: exercise.supersetId,
      supersetNotes: exercise.supersetNotes ?? null,
      exercises: [exercise],
    });
  });
  return groups;
};

/** At most two decimals, without trailing zeros: 60, 62.5, 1.61. */
const formatAmount = (value: number): string =>
  String(Math.round(value * 100) / 100);

/**
 * One set's targets in the user's units: "60 kg × 10", "10 reps",
 * "20 min · 5 km". A set with no targets reads "No targets".
 */
export const formatTemplateSet = (
  set: TemplateSet,
  type: ExerciseType,
  units: UnitSystem
): string => {
  const labels = getUnitLabels(units);
  const weight =
    set.weight === undefined
      ? null
      : `${formatAmount(fromStoredWeight(set.weight, units))} ${labels.weight}`;
  const reps = set.reps === undefined ? null : String(set.reps);
  const duration =
    set.duration === undefined
      ? null
      : `${formatAmount(fromStoredDuration(set.duration))} ${labels.duration}`;
  const distance =
    set.distance === undefined
      ? null
      : `${formatAmount(fromStoredDistance(set.distance, units))} ${labels.distance}`;

  let text: string | null;
  if (type === 'cardio') {
    text = [duration, distance].filter((part) => part !== null).join(' · ');
  } else if (weight !== null && reps !== null) {
    text = `${weight} × ${reps}`;
  } else {
    text = weight ?? (reps === null ? null : `${reps} reps`);
  }
  return text === null || text === '' ? 'No targets' : text;
};
