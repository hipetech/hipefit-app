import type { ExerciseCatalogueSource } from '@hipefit/domain';
import type { WithId } from '@hipefit/schemas';
import type { SnapshotOptions } from '@react-native-firebase/firestore';
import {
  customExerciseCategoriesRef,
  customExercisesRef,
  equipmentRef,
  exerciseCategoriesRef,
  exercisesRef,
} from '@hipefit/firebase/react-native';
import {
  decodeCustomExercise,
  decodeCustomExerciseCategory,
  decodeEquipment,
  decodeExercise,
  decodeExerciseCategory,
} from '@hipefit/schemas';
import { onSnapshot } from '@react-native-firebase/firestore';

export type ExerciseListenerName =
  | 'globalExercises'
  | 'globalCategories'
  | 'equipment'
  | 'customExercises'
  | 'customCategories';

export interface ExerciseSubscriptionHandlers {
  onData: (
    listener: ExerciseListenerName,
    data: Partial<ExerciseCatalogueSource>
  ) => void;
  onError: (listener: ExerciseListenerName, error: Error) => void;
}

const decodeDocuments = <T>(
  documents: readonly {
    id: string;
    data: (options?: SnapshotOptions) => unknown;
  }[],
  decode: (value: unknown) => T | null
): WithId<T>[] => {
  const decoded: WithId<T>[] = [];
  for (const document of documents) {
    const data = decode(document.data({ serverTimestamps: 'estimate' }));
    if (data) decoded.push({ id: document.id, data });
  }
  return decoded;
};

export const subscribeToExerciseCatalogue = (
  uid: string,
  handlers: ExerciseSubscriptionHandlers
): (() => void) => {
  const unsubscribes = [
    onSnapshot(
      exercisesRef(),
      (snapshot) =>
        handlers.onData('globalExercises', {
          globalExercises: decodeDocuments(snapshot.docs, decodeExercise),
        }),
      (error) => handlers.onError('globalExercises', error)
    ),
    onSnapshot(
      exerciseCategoriesRef(),
      (snapshot) =>
        handlers.onData('globalCategories', {
          globalCategories: decodeDocuments(
            snapshot.docs,
            decodeExerciseCategory
          ),
        }),
      (error) => handlers.onError('globalCategories', error)
    ),
    onSnapshot(
      equipmentRef(),
      (snapshot) =>
        handlers.onData('equipment', {
          equipment: decodeDocuments(snapshot.docs, decodeEquipment),
        }),
      (error) => handlers.onError('equipment', error)
    ),
    onSnapshot(
      customExercisesRef(uid),
      (snapshot) =>
        handlers.onData('customExercises', {
          customExercises: decodeDocuments(snapshot.docs, decodeCustomExercise),
        }),
      (error) => handlers.onError('customExercises', error)
    ),
    onSnapshot(
      customExerciseCategoriesRef(uid),
      (snapshot) =>
        handlers.onData('customCategories', {
          customCategories: decodeDocuments(
            snapshot.docs,
            decodeCustomExerciseCategory
          ),
        }),
      (error) => handlers.onError('customCategories', error)
    ),
  ];

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
};
