import {
  collection,
  doc,
  getFirestore,
} from '@react-native-firebase/firestore';

const db = getFirestore();

export const exerciseCategoriesRef = () => collection(db, 'exerciseCategories');

export const equipmentRef = () => collection(db, 'equipment');

export const exercisesRef = () => collection(db, 'exercises');

export const userRef = (uid: string) => doc(db, 'users', uid);

export const customExerciseCategoriesRef = (uid: string) =>
  collection(db, 'users', uid, 'customExerciseCategories');

export const customExercisesRef = (uid: string) =>
  collection(db, 'users', uid, 'customExercises');

export const bodyMeasurementsRef = (uid: string) =>
  collection(db, 'users', uid, 'bodyMeasurements');
