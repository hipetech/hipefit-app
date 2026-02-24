import {
  collection,
  doc,
  getFirestore,
} from '@react-native-firebase/firestore';

const db = getFirestore();

// ─── Global Collections (read-only) ────────────────────────────────────────

export const exercisesRef = () => collection(db, 'exercises');

export const exerciseRef = (exerciseId: string) =>
  doc(db, 'exercises', exerciseId);

export const globalGroupsRef = () => collection(db, 'exerciseGroups');

export const globalGroupRef = (groupId: string) =>
  doc(db, 'exerciseGroups', groupId);

// ─── User Document ──────────────────────────────────────────────────────────

export const userRef = (uid: string) => doc(db, 'users', uid);

// ─── User Subcollections ────────────────────────────────────────────────────

export const userGroupsRef = (uid: string) =>
  collection(db, 'users', uid, 'exerciseGroups');

export const userGroupRef = (uid: string, groupId: string) =>
  doc(db, 'users', uid, 'exerciseGroups', groupId);

export const userOverridesRef = (uid: string) =>
  collection(db, 'users', uid, 'exerciseOverrides');

export const userOverrideRef = (uid: string, exerciseId: string) =>
  doc(db, 'users', uid, 'exerciseOverrides', exerciseId);

export const customExercisesRef = (uid: string) =>
  collection(db, 'users', uid, 'customExercises');

export const customExerciseRef = (uid: string, exerciseId: string) =>
  doc(db, 'users', uid, 'customExercises', exerciseId);

export const routinesRef = (uid: string) =>
  collection(db, 'users', uid, 'routines');

export const routineRef = (uid: string, routineId: string) =>
  doc(db, 'users', uid, 'routines', routineId);

export const workoutsRef = (uid: string) =>
  collection(db, 'users', uid, 'workouts');

export const workoutRef = (uid: string, workoutId: string) =>
  doc(db, 'users', uid, 'workouts', workoutId);

export const exerciseHistoryRef = (uid: string) =>
  collection(db, 'users', uid, 'exerciseHistory');

export const exerciseHistoryEntryRef = (uid: string, entryId: string) =>
  doc(db, 'users', uid, 'exerciseHistory', entryId);
