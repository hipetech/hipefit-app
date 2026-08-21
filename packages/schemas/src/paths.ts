export const EXERCISE_CATEGORIES_PATH = 'exerciseCategories';
export const EQUIPMENT_PATH = 'equipment';
export const EXERCISES_PATH = 'exercises';
export const USERS_PATH = 'users';

export const userPath = (uid: string): string => `${USERS_PATH}/${uid}`;

export const customExerciseCategoriesPath = (uid: string): string =>
  `${userPath(uid)}/customExerciseCategories`;

export const customExercisesPath = (uid: string): string =>
  `${userPath(uid)}/customExercises`;

export const bodyMeasurementsPath = (uid: string): string =>
  `${userPath(uid)}/bodyMeasurements`;
