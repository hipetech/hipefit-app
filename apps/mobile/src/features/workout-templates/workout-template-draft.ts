import type { MergedExercise } from '@/features/exercises/exercise-catalogue';
import type { UnitSystem } from '@/lib/units';
import type {
  ExerciseType,
  Ref,
  TemplateExercise,
  TemplateSet,
} from '@hipefit/schemas';

import {
  toStoredDistance,
  toStoredDuration,
  toStoredWeight,
} from '@/lib/units';

/**
 * Field limits. `@hipefit/schemas` and `firebase/firestore.rules` enforce these
 * and export none of them, so the values are repeated here. Keep each equal to
 * its source.
 */

/** `NAME_MAX_LENGTH` in `packages/schemas/src/validation.ts`, private to that module. */
export const WORKOUT_TEMPLATE_NAME_MAX_LENGTH = 100;

/** `LONG_TEXT_MAX_LENGTH` in `packages/schemas/src/validation.ts`, the limit on set and superset notes. */
export const WORKOUT_TEMPLATE_NOTES_MAX_LENGTH = 2000;

/**
 * `EXERCISES_MAX_LENGTH` in `packages/schemas/src/validation.ts`, and
 * `validWorkoutTemplate` in `firebase/firestore.rules`.
 */
export const WORKOUT_TEMPLATE_EXERCISES_MAX_COUNT = 50;

/** The numeric fields of a set. Its note is kept apart, as `TemplateSetDraft.notes`. */
export type TemplateSetField = Exclude<keyof TemplateSet, 'notes'>;

/** The set fields each exercise type uses, in display order. No other field is written. */
export const TEMPLATE_SET_FIELDS: Record<ExerciseType, TemplateSetField[]> = {
  strength: ['weight', 'reps'],
  bodyweight: ['reps'],
  cardio: ['duration', 'distance'],
};

const SET_FIELD_NAMES: Record<TemplateSetField, string> = {
  weight: 'Weight',
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
};

/** One set's values as typed, in the user's units. An empty string is an empty field. */
export type TemplateSetValues = Record<TemplateSetField, string>;

export interface TemplateSetDraft extends TemplateSetValues {
  /** The set's note as typed. Empty when the set has none. */
  notes: string;
  /** Stable client key, unchanged when sets around it are added or removed. */
  key: string;
}

export interface TemplateExerciseDraft {
  /** Stable client key, unchanged when the exercise moves. */
  key: string;
  ref: Ref;
  name: string;
  type: ExerciseType;
  /** Shared by adjacent exercises in one superset; `null` outside a superset. */
  supersetId: string | null;
  sets: TemplateSetDraft[];
}

/** The editor's values as the user left them, before trimming and conversion. */
export interface WorkoutTemplateDraft {
  name: string;
  /** The planned day, `YYYY-MM-DD`, or `null` for none. */
  plannedDate: string | null;
  exercises: TemplateExerciseDraft[];
  /** Each superset's note as typed, keyed by superset id. A missing entry is an empty note. */
  supersetNotes: Record<string, string>;
  /** Next value of the counter that exercise keys, set keys, and superset ids come from. */
  nextId: number;
}

/** The catalogue fields a draft exercise copies. */
export type TemplateExerciseSource = Pick<
  MergedExercise,
  'ref' | 'name' | 'type'
>;

/**
 * One item of the editor's list: a single exercise, or every exercise of one
 * superset. The list drags blocks, so a superset always moves as a whole.
 */
export interface TemplateExerciseBlock {
  /** The superset id, or the exercise key for a single exercise. Stable across moves. */
  key: string;
  supersetId: string | null;
  exercises: TemplateExerciseDraft[];
}

/**
 * A valid draft, trimmed and in stored units. Matches `WorkoutTemplateInput` in
 * `services/workout-template-service.ts`, the argument of
 * `useWorkoutTemplateStore`'s `createWorkoutTemplate`.
 */
export interface WorkoutTemplateFields {
  name: string;
  plannedDate: string | null;
  exercises: TemplateExercise[];
}

/** Messages for the fields that block saving. A `null` or missing entry has no problem. */
export interface WorkoutTemplateDraftErrors {
  name: string | null;
  /** Set when the draft has no exercises or more than the maximum. */
  exerciseCount: string | null;
  /** The first problem in each exercise, keyed by exercise key. */
  exercises: Record<string, string>;
  /** Problems in each set's fields, keyed by set key. Only the exercise type's fields are checked. */
  sets: Record<string, Partial<Record<TemplateSetField, string>>>;
}

const EMPTY_SET_VALUES: TemplateSetValues & Pick<TemplateSetDraft, 'notes'> = {
  weight: '',
  reps: '',
  duration: '',
  distance: '',
  notes: '',
};

/**
 * Keys and superset ids come from a counter carried in the draft instead of a
 * random source, so each operation is a pure function of its arguments. React
 * may run a state updater twice, and both runs must produce the same keys. The
 * counter only increases, so no generated id repeats within one template.
 */
const formatId = (prefix: string, counter: number): string =>
  `${prefix}-${counter}`;

/**
 * Brings superset ids back to the validator's rule: every non-null id covers
 * exactly one run of at least two adjacent exercises. A second run of an id
 * that already ran earlier gets a fresh id, so removing the middle of a
 * superset splits it in two. A run left with one exercise dissolves.
 */
const normalizeSupersets = (
  exercises: TemplateExerciseDraft[],
  nextId: number
): { exercises: TemplateExerciseDraft[]; nextId: number } => {
  const startedIds = new Set<string>();
  let counter = nextId;
  let runId: string | null = null;

  const split = exercises.map((exercise, index) => {
    const supersetId = exercise.supersetId;
    if (supersetId === null) {
      return exercise;
    }
    if (exercises[index - 1]?.supersetId !== supersetId) {
      if (startedIds.has(supersetId)) {
        runId = formatId('superset', counter);
        counter += 1;
      } else {
        runId = supersetId;
      }
      startedIds.add(runId);
    }
    return runId === supersetId ? exercise : { ...exercise, supersetId: runId };
  });

  const dissolved = split.map((exercise, index) => {
    const supersetId = exercise.supersetId;
    if (
      supersetId === null ||
      split[index - 1]?.supersetId === supersetId ||
      split[index + 1]?.supersetId === supersetId
    ) {
      return exercise;
    }
    return { ...exercise, supersetId: null };
  });

  return { exercises: dissolved, nextId: counter };
};

/** Replaces the draft's exercises and normalizes their supersets. */
const withExercises = (
  draft: WorkoutTemplateDraft,
  exercises: TemplateExerciseDraft[]
): WorkoutTemplateDraft => {
  const normalized = normalizeSupersets(exercises, draft.nextId);
  // A note stays only while its superset does.
  const supersetIds = new Set(
    normalized.exercises.map((exercise) => exercise.supersetId)
  );
  const supersetNotes = Object.fromEntries(
    Object.entries(draft.supersetNotes).filter(([supersetId]) =>
      supersetIds.has(supersetId)
    )
  );
  return {
    ...draft,
    exercises: normalized.exercises,
    supersetNotes,
    nextId: normalized.nextId,
  };
};

/** Applies `update` to the exercise with `exerciseKey`. Returns the draft unchanged when no exercise has it. */
const updateExercise = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string,
  update: (exercise: TemplateExerciseDraft) => TemplateExerciseDraft
): WorkoutTemplateDraft => {
  if (!draft.exercises.some((exercise) => exercise.key === exerciseKey)) {
    return draft;
  }
  return withExercises(
    draft,
    draft.exercises.map((exercise) =>
      exercise.key === exerciseKey ? update(exercise) : exercise
    )
  );
};

/**
 * An empty draft planned for `plannedDate`. The caller passes today's day ID,
 * so this module stays free of the clock and every operation stays pure.
 */
export const createWorkoutTemplateDraft = (
  plannedDate: string | null = null
): WorkoutTemplateDraft => ({
  name: '',
  plannedDate,
  exercises: [],
  supersetNotes: {},
  nextId: 1,
});

/**
 * Every operation below returns a new draft and leaves its input untouched.
 * One that finds nothing to change, such as a key no exercise has, returns the
 * input itself, so a caller can compare identities to tell whether the draft
 * changed.
 */

/** Appends each source as an exercise with one empty set, outside any superset. */
export const addExercises = (
  draft: WorkoutTemplateDraft,
  sources: TemplateExerciseSource[]
): WorkoutTemplateDraft => {
  if (sources.length === 0) {
    return draft;
  }
  const added = sources.map((source, index): TemplateExerciseDraft => ({
    key: formatId('exercise', draft.nextId + index * 2),
    ref: source.ref,
    name: source.name,
    type: source.type,
    supersetId: null,
    sets: [
      {
        ...EMPTY_SET_VALUES,
        key: formatId('set', draft.nextId + index * 2 + 1),
      },
    ],
  }));
  return withExercises(
    { ...draft, nextId: draft.nextId + sources.length * 2 },
    [...draft.exercises, ...added]
  );
};

export const removeExercise = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string
): WorkoutTemplateDraft => {
  const exercises = draft.exercises.filter(
    (exercise) => exercise.key !== exerciseKey
  );
  return exercises.length === draft.exercises.length
    ? draft
    : withExercises(draft, exercises);
};

/**
 * Splits the exercises into the editor's list items. Adjacent exercises with
 * one superset id form one block; every other exercise is a block of its own.
 */
export const groupExerciseBlocks = (
  exercises: TemplateExerciseDraft[]
): TemplateExerciseBlock[] => {
  const blocks: TemplateExerciseBlock[] = [];
  for (const exercise of exercises) {
    const last = blocks[blocks.length - 1];
    if (
      exercise.supersetId !== null &&
      last !== undefined &&
      last.supersetId === exercise.supersetId
    ) {
      last.exercises.push(exercise);
    } else {
      blocks.push({
        key: exercise.supersetId ?? exercise.key,
        supersetId: exercise.supersetId,
        exercises: [exercise],
      });
    }
  }
  return blocks;
};

/**
 * Commits the block order `SortableList` hands to `onReorder`. Only the order
 * of `ordered` is read: each block's exercises come from `draft`, so an edit
 * made after the list rendered survives. An `ordered` that is not a
 * permutation of the draft's blocks is ignored.
 */
export const reorderBlocks = (
  draft: WorkoutTemplateDraft,
  ordered: Pick<TemplateExerciseBlock, 'key'>[]
): WorkoutTemplateDraft => {
  const remaining = new Map(
    groupExerciseBlocks(draft.exercises).map((block) => [block.key, block])
  );
  const exercises: TemplateExerciseDraft[] = [];
  for (const { key } of ordered) {
    const block = remaining.get(key);
    if (block === undefined) {
      return draft;
    }
    remaining.delete(key);
    exercises.push(...block.exercises);
  }
  return remaining.size > 0 ? draft : withExercises(draft, exercises);
};

/**
 * Moves the superset member with `exerciseKey` to `toIndex`, counted within the
 * superset. The superset keeps its place in the list. A member already at
 * `toIndex` leaves the draft unchanged, so repeating a drop is harmless.
 */
export const reorderSupersetMembers = (
  draft: WorkoutTemplateDraft,
  supersetId: string,
  exerciseKey: string,
  toIndex: number
): WorkoutTemplateDraft => {
  const start = draft.exercises.findIndex(
    (exercise) => exercise.supersetId === supersetId
  );
  if (start === -1) {
    return draft;
  }
  let end = start;
  while (draft.exercises[end + 1]?.supersetId === supersetId) {
    end += 1;
  }
  const members = draft.exercises.slice(start, end + 1);
  const fromIndex = members.findIndex((member) => member.key === exerciseKey);
  if (
    fromIndex === -1 ||
    fromIndex === toIndex ||
    toIndex < 0 ||
    toIndex >= members.length
  ) {
    return draft;
  }
  const [moved] = members.splice(fromIndex, 1);
  if (moved === undefined) {
    return draft;
  }
  members.splice(toIndex, 0, moved);
  return withExercises(draft, [
    ...draft.exercises.slice(0, start),
    ...members,
    ...draft.exercises.slice(end + 1),
  ]);
};

/** Appends a set that copies the exercise's last set, or an empty set when it has none. */
export const addSet = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string
): WorkoutTemplateDraft => {
  const updated = updateExercise(draft, exerciseKey, (exercise) => {
    const previous = exercise.sets[exercise.sets.length - 1];
    // The values carry over; the note does not, since it describes one set.
    const set: TemplateSetDraft = {
      ...(previous ?? EMPTY_SET_VALUES),
      notes: '',
      key: formatId('set', draft.nextId),
    };
    return { ...exercise, sets: [...exercise.sets, set] };
  });
  return updated === draft ? draft : { ...updated, nextId: updated.nextId + 1 };
};

/** Removes a set. Removing the last one is allowed; validation then asks for a set. */
export const removeSet = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string,
  setKey: string
): WorkoutTemplateDraft =>
  updateExercise(draft, exerciseKey, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((set) => set.key !== setKey),
  }));

/** Stores `value` exactly as typed. Parsing happens in validation and conversion. */
export const editSetField = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string,
  setKey: string,
  field: TemplateSetField,
  value: string
): WorkoutTemplateDraft =>
  updateExercise(draft, exerciseKey, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) =>
      set.key === setKey ? { ...set, [field]: value } : set
    ),
  }));

/** Stores a set's note exactly as typed. Trimming happens in conversion. */
export const editSetNotes = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string,
  setKey: string,
  notes: string
): WorkoutTemplateDraft =>
  updateExercise(draft, exerciseKey, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) =>
      set.key === setKey ? { ...set, notes } : set
    ),
  }));

/** Stores a superset's note exactly as typed. A superset id the draft does not have is ignored. */
export const editSupersetNotes = (
  draft: WorkoutTemplateDraft,
  supersetId: string,
  notes: string
): WorkoutTemplateDraft =>
  draft.exercises.some((exercise) => exercise.supersetId === supersetId)
    ? {
        ...draft,
        supersetNotes: { ...draft.supersetNotes, [supersetId]: notes },
      }
    : draft;

/** The index of the block holding the exercise, or -1. */
const findBlockIndex = (
  blocks: TemplateExerciseBlock[],
  exerciseKey: string
): number =>
  blocks.findIndex((block) =>
    block.exercises.some((exercise) => exercise.key === exerciseKey)
  );

/**
 * Whether Superset with Next applies: the exercise is the last of its block
 * and another block follows.
 */
export const canLinkWithNext = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string
): boolean => {
  const blocks = groupExerciseBlocks(draft.exercises);
  const index = findBlockIndex(blocks, exerciseKey);
  const block = blocks[index];
  return (
    block !== undefined &&
    block.exercises[block.exercises.length - 1]?.key === exerciseKey &&
    blocks[index + 1] !== undefined
  );
};

/**
 * Merges the exercise's block with the block after it into one superset. The
 * merged superset keeps the first block's id, then the second's, and otherwise
 * gets a new one.
 */
export const linkWithNext = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string
): WorkoutTemplateDraft => {
  if (!canLinkWithNext(draft, exerciseKey)) {
    return draft;
  }
  const blocks = groupExerciseBlocks(draft.exercises);
  const index = findBlockIndex(blocks, exerciseKey);
  const current = blocks[index];
  const next = blocks[index + 1];
  if (current === undefined || next === undefined) {
    return draft;
  }
  const existingId = current.supersetId ?? next.supersetId;
  const supersetId = existingId ?? formatId('superset', draft.nextId);
  const nextId = existingId === null ? draft.nextId + 1 : draft.nextId;
  // The merged superset keeps the first block's note, or else the second's.
  const mergedNotes =
    (current.supersetId === null
      ? undefined
      : draft.supersetNotes[current.supersetId]) ||
    (next.supersetId === null
      ? undefined
      : draft.supersetNotes[next.supersetId]);
  const supersetNotes =
    mergedNotes === undefined
      ? draft.supersetNotes
      : { ...draft.supersetNotes, [supersetId]: mergedNotes };
  const linkedKeys = new Set(
    [...current.exercises, ...next.exercises].map((exercise) => exercise.key)
  );

  return withExercises(
    { ...draft, supersetNotes, nextId },
    draft.exercises.map((exercise) =>
      linkedKeys.has(exercise.key) ? { ...exercise, supersetId } : exercise
    )
  );
};

/**
 * Takes the exercise out of its superset and places it right after the
 * superset, so the remaining members stay one block. A superset left with one
 * member dissolves.
 */
export const unlinkExercise = (
  draft: WorkoutTemplateDraft,
  exerciseKey: string
): WorkoutTemplateDraft => {
  const blocks = groupExerciseBlocks(draft.exercises);
  const index = findBlockIndex(blocks, exerciseKey);
  const block = blocks[index];
  const exercise = block?.exercises.find((entry) => entry.key === exerciseKey);
  if (
    block === undefined ||
    exercise === undefined ||
    block.supersetId === null
  ) {
    return draft;
  }
  return withExercises(
    draft,
    blocks.flatMap((entry, position) =>
      position === index
        ? [
            ...entry.exercises.filter((member) => member.key !== exerciseKey),
            { ...exercise, supersetId: null },
          ]
        : entry.exercises
    )
  );
};

const DECIMAL_PATTERN = /^-?(\d+([.,]\d*)?|[.,]\d+)$/;

/**
 * Reads a typed value. Returns `null` for an empty field and `NaN` for text
 * that is not a plain decimal. A comma is accepted as the decimal separator,
 * which the iOS decimal pad types in some locales. Exponents, hex, and
 * `Infinity` are not.
 */
const parseSetValue = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return DECIMAL_PATTERN.test(trimmed)
    ? Number(trimmed.replace(',', '.'))
    : Number.NaN;
};

const validateSetValue = (
  field: TemplateSetField,
  value: string
): string | null => {
  const parsed = parseSetValue(value);
  if (parsed === null) {
    return null;
  }
  const label = SET_FIELD_NAMES[field];
  if (!Number.isFinite(parsed)) {
    return `${label} must be a number`;
  }
  if (parsed < 0) {
    return `${label} can't be negative`;
  }
  if (field === 'reps' && !Number.isInteger(parsed)) {
    return `${label} must be a whole number`;
  }
  return null;
};

export const validateWorkoutTemplateDraft = (
  draft: WorkoutTemplateDraft
): WorkoutTemplateDraftErrors => {
  const name = draft.name.trim();
  const count = draft.exercises.length;

  const errors: WorkoutTemplateDraftErrors = {
    name:
      name.length === 0
        ? 'Enter a name'
        : name.length > WORKOUT_TEMPLATE_NAME_MAX_LENGTH
          ? `Use at most ${WORKOUT_TEMPLATE_NAME_MAX_LENGTH} characters`
          : null,
    exerciseCount:
      count === 0
        ? 'Add at least one exercise'
        : count > WORKOUT_TEMPLATE_EXERCISES_MAX_COUNT
          ? `Use at most ${WORKOUT_TEMPLATE_EXERCISES_MAX_COUNT} exercises`
          : null,
    exercises: {},
    sets: {},
  };

  for (const exercise of draft.exercises) {
    if (exercise.sets.length === 0) {
      errors.exercises[exercise.key] = 'Add at least one set';
    }
    exercise.sets.forEach((set, index) => {
      const setErrors: Partial<Record<TemplateSetField, string>> = {};
      for (const field of TEMPLATE_SET_FIELDS[exercise.type]) {
        const message = validateSetValue(field, set[field]);
        if (message === null) {
          continue;
        }
        setErrors[field] = message;
        if (errors.exercises[exercise.key] === undefined) {
          errors.exercises[exercise.key] = `Set ${index + 1}: ${message}`;
        }
      }
      if (Object.keys(setErrors).length > 0) {
        errors.sets[set.key] = setErrors;
      }
    });
  }

  return errors;
};

export const hasWorkoutTemplateDraftErrors = (
  errors: WorkoutTemplateDraftErrors
): boolean =>
  errors.name !== null ||
  errors.exerciseCount !== null ||
  Object.keys(errors.exercises).length > 0 ||
  Object.keys(errors.sets).length > 0;

const toStoredValue = (
  field: TemplateSetField,
  value: number,
  units: UnitSystem
): number => {
  switch (field) {
    case 'weight':
      return toStoredWeight(value, units);
    case 'distance':
      return toStoredDistance(value, units);
    case 'duration':
      return toStoredDuration(value);
    case 'reps':
      return value;
  }
};

const toTemplateSet = (
  set: TemplateSetDraft,
  type: ExerciseType,
  units: UnitSystem
): TemplateSet => {
  const stored: TemplateSet = {};
  for (const field of TEMPLATE_SET_FIELDS[type]) {
    const parsed = parseSetValue(set[field]);
    if (parsed !== null) {
      stored[field] = toStoredValue(field, parsed, units);
    }
  }
  const notes = set.notes.trim();
  if (notes.length > 0) {
    stored.notes = notes;
  }
  return stored;
};

/**
 * Trims, validates, and converts a draft to stored units. Returns `null` when
 * `validateWorkoutTemplateDraft` reports any problem. Empty fields, and fields
 * the exercise's type does not use, are left out of each `TemplateSet`.
 */
export const toWorkoutTemplateInput = (
  draft: WorkoutTemplateDraft,
  units: UnitSystem
): WorkoutTemplateFields | null => {
  if (hasWorkoutTemplateDraftErrors(validateWorkoutTemplateDraft(draft))) {
    return null;
  }
  // The operations keep supersets normalized; this covers a draft assembled
  // without them, so the output always passes `assertWorkoutTemplateWrite`.
  const { exercises } = normalizeSupersets(draft.exercises, draft.nextId);

  return {
    name: draft.name.trim(),
    plannedDate: draft.plannedDate,
    exercises: exercises.map((exercise, index): TemplateExercise => {
      const converted: TemplateExercise = {
        exerciseRef: exercise.ref,
        nameSnapshot: exercise.name,
        type: exercise.type,
        sets: exercise.sets.map((set) =>
          toTemplateSet(set, exercise.type, units)
        ),
        supersetId: exercise.supersetId,
      };
      // The superset's note goes on its first exercise only.
      const startsSuperset =
        exercise.supersetId !== null &&
        exercises[index - 1]?.supersetId !== exercise.supersetId;
      const supersetNotes = startsSuperset
        ? (draft.supersetNotes[exercise.supersetId ?? '']?.trim() ?? '')
        : '';
      return supersetNotes.length > 0
        ? { ...converted, supersetNotes }
        : converted;
    }),
  };
};

/**
 * Whether the user has entered anything that discarding would lose. The
 * planned date does not count: every draft starts with one, and a date alone
 * is not worth a confirmation.
 */
export const hasUnsavedInput = (draft: WorkoutTemplateDraft): boolean =>
  draft.name.trim().length > 0 || draft.exercises.length > 0;
