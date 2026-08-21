import type {
  GlobalLocalizedText,
  Locale,
  Ref,
  Timestamp,
  UserLocalizedText,
} from './shared';

export type ExerciseType = 'strength' | 'cardio' | 'bodyweight';

export interface ExerciseCategory {
  name: GlobalLocalizedText;
  order: number;
  icon: string;
  isRetired: boolean;
}

export interface Equipment {
  name: GlobalLocalizedText;
  icon: string | null;
  isRetired: boolean;
}

export interface Exercise {
  categoryRef: Ref;
  name: GlobalLocalizedText;
  description: GlobalLocalizedText;
  type: ExerciseType;
  equipment: Ref[];
  imageURL: string | null;
  isRetired: boolean;
}

export interface CustomExerciseCategory {
  name: UserLocalizedText;
  defaultLocale: Locale;
  order: number;
  icon: string | null;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomExercise {
  categoryRef: Ref;
  forkedFromRef: Ref | null;
  name: UserLocalizedText;
  description: UserLocalizedText;
  defaultLocale: Locale;
  type: ExerciseType;
  equipment: Ref[];
  imageURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export {
  assertCustomExerciseCategoryWrite,
  assertCustomExerciseWrite,
  assertEquipmentWrite,
  assertExerciseCategoryWrite,
  assertExerciseWrite,
  decodeCustomExercise,
  decodeCustomExerciseCategory,
  decodeEquipment,
  decodeExercise,
  decodeExerciseCategory,
} from './validation';
