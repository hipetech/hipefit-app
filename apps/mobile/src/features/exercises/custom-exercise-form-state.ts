import type { MergedCategory } from './exercise-catalogue';
import type { ExerciseType, Ref } from '@hipefit/schemas';

/**
 * Field limits. `@hipefit/schemas` and `firebase/firestore.rules` enforce these
 * and export none of them, so the values are repeated here. Keep each equal to
 * its source.
 */

/** `NAME_MAX_LENGTH` in `packages/schemas/src/validation.ts`, private to that module. */
export const CUSTOM_EXERCISE_NAME_MAX_LENGTH = 100;

/** `LONG_TEXT_MAX_LENGTH` in `packages/schemas/src/validation.ts`, private to that module. */
export const CUSTOM_EXERCISE_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * `validCustomExercise` in `firebase/firestore.rules` caps the equipment list.
 * `createCustomExercise` in `services/exercise-service.ts` rejects a longer one.
 */
export const CUSTOM_EXERCISE_EQUIPMENT_MAX_COUNT = 20;

/**
 * Tag of the category picker option that stands for no selection. A SwiftUI
 * `Picker` whose selection matches no tag renders blank, so the unselected state
 * needs a tag of its own. No category ref can equal it: a `Ref` always starts
 * with `global:` or `custom:`.
 */
export const NO_CATEGORY_TAG = '';

export const DEFAULT_EXERCISE_TYPE: ExerciseType = 'strength';

export interface ExerciseTypeOption {
  value: ExerciseType;
  label: string;
}

export const EXERCISE_TYPE_OPTIONS: ExerciseTypeOption[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

/** The form's values as the user left them, before trimming. */
export interface CustomExerciseDraft {
  name: string;
  description: string;
  type: ExerciseType;
  categoryRef: Ref | null;
  equipment: Ref[];
}

/** A valid draft, trimmed. Matches the argument of `useExerciseStore`'s `createCustomExercise`. */
export interface CustomExerciseFields {
  name: string;
  description: string;
  type: ExerciseType;
  categoryRef: Ref;
  equipment: Ref[];
}

/**
 * Maps a category picker tag to the ref of a category the store still
 * publishes. `NO_CATEGORY_TAG`, and a ref whose category has since been hidden,
 * archived, or retired, both resolve to `null`.
 */
export const resolveCategoryRef = (
  tag: string | null,
  categories: MergedCategory[]
): Ref | null =>
  categories.find((category) => category.ref === tag)?.ref ?? null;

/**
 * Adds `ref` to the selection, or removes it when it is already there. Returns
 * the same array, unchanged, when adding would exceed
 * `CUSTOM_EXERCISE_EQUIPMENT_MAX_COUNT`, so a caller can compare identities to
 * tell whether the selection changed.
 */
export const toggleEquipmentRef = (selection: Ref[], ref: Ref): Ref[] => {
  if (selection.includes(ref)) {
    return selection.filter((selected) => selected !== ref);
  }
  if (selection.length >= CUSTOM_EXERCISE_EQUIPMENT_MAX_COUNT) {
    return selection;
  }
  return [...selection, ref];
};

/** Trims and validates a draft. Returns `null` when the draft cannot be saved. */
export const toCustomExerciseFields = (
  draft: CustomExerciseDraft
): CustomExerciseFields | null => {
  const name = draft.name.trim();
  const description = draft.description.trim();

  if (
    name.length === 0 ||
    name.length > CUSTOM_EXERCISE_NAME_MAX_LENGTH ||
    description.length > CUSTOM_EXERCISE_DESCRIPTION_MAX_LENGTH ||
    draft.categoryRef === null ||
    draft.equipment.length > CUSTOM_EXERCISE_EQUIPMENT_MAX_COUNT
  ) {
    return null;
  }

  return {
    name,
    description,
    type: draft.type,
    categoryRef: draft.categoryRef,
    equipment: draft.equipment,
  };
};

/** Whether the user has entered anything that dismissing the sheet would discard. */
export const hasUnsavedInput = (draft: CustomExerciseDraft): boolean =>
  draft.name.trim().length > 0 ||
  draft.description.trim().length > 0 ||
  draft.type !== DEFAULT_EXERCISE_TYPE ||
  draft.categoryRef !== null ||
  draft.equipment.length > 0;
