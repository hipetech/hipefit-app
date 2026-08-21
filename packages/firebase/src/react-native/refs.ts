import {
  bodyMeasurementsPath,
  customExerciseCategoriesPath,
  customExercisesPath,
  EQUIPMENT_PATH,
  EXERCISE_CATEGORIES_PATH,
  EXERCISES_PATH,
  userPath,
} from '@hipefit/schemas';
import { collection, doc } from '@react-native-firebase/firestore';

import { getFirebaseFirestore } from './instances';

export const exerciseCategoriesRef = () =>
  collection(getFirebaseFirestore(), EXERCISE_CATEGORIES_PATH);

export const equipmentRef = () =>
  collection(getFirebaseFirestore(), EQUIPMENT_PATH);

export const exercisesRef = () =>
  collection(getFirebaseFirestore(), EXERCISES_PATH);

export const userRef = (uid: string) =>
  doc(getFirebaseFirestore(), userPath(uid));

export const customExerciseCategoriesRef = (uid: string) =>
  collection(getFirebaseFirestore(), customExerciseCategoriesPath(uid));

export const customExercisesRef = (uid: string) =>
  collection(getFirebaseFirestore(), customExercisesPath(uid));

export const bodyMeasurementsRef = (uid: string) =>
  collection(getFirebaseFirestore(), bodyMeasurementsPath(uid));
