import type { ExerciseCatalogueSource } from '@/features/exercises/exercise-catalogue';
import type {
  CustomExercise,
  ExerciseType,
  Locale,
  Ref,
  WithId,
} from '@hipefit/schemas';
import type { SnapshotOptions } from '@react-native-firebase/firestore';
import {
  customExerciseCategoriesRef,
  customExercisesRef,
  equipmentRef,
  exerciseCategoriesRef,
  exercisesRef,
} from '@hipefit/firebase/react-native';
import {
  assertCustomExerciseWrite,
  decodeCustomExercise,
  decodeCustomExerciseCategory,
  decodeEquipment,
  decodeExercise,
  decodeExerciseCategory,
} from '@hipefit/schemas';
import {
  addDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';

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

export interface CustomExerciseInput {
  locale: Locale;
  name: string;
  description: string;
  type: ExerciseType;
  categoryRef: Ref;
  equipment: Ref[];
}

// firebase/firestore.rules rejects a custom exercise with more than 20 equipment entries, and
// assertCustomExerciseWrite does not bound the list. Keep this equal to the rules value.
const CUSTOM_EXERCISE_EQUIPMENT_MAX_LENGTH = 20;

interface SnapshotDocument {
  id: string;
  metadata: { hasPendingWrites: boolean };
  data: (options?: SnapshotOptions) => unknown;
}

/**
 * Gives a locally written document the timestamps the server has not set yet.
 *
 * `createCustomExercise` writes `serverTimestamp()` into `createdAt` and
 * `updatedAt`. Until the server acknowledges the write, the listener's snapshot
 * carries `null` in both: `DocumentSnapshot.data()` in
 * @react-native-firebase/firestore 25.1.0 returns the stored data and ignores
 * its `serverTimestamps` option unless a converter is attached. The decoder
 * rejects `null`, so without this the new exercise is dropped, and logged as
 * malformed, until the acknowledged snapshot arrives. The user service does the
 * same for the profile document.
 */
const fillPendingTimestamps = (
  data: unknown,
  hasPendingWrites: boolean
): unknown => {
  if (!hasPendingWrites || typeof data !== 'object' || data === null) {
    return data;
  }
  const document: Record<string, unknown> = { ...data };
  const pendingTimestamp = Timestamp.now();
  return {
    ...document,
    createdAt: document.createdAt ?? pendingTimestamp,
    updatedAt: document.updatedAt ?? pendingTimestamp,
  };
};

const decodeDocuments = <T>(
  documents: readonly SnapshotDocument[],
  decode: (value: unknown) => T | null,
  prepare?: (data: unknown, hasPendingWrites: boolean) => unknown
): WithId<T>[] => {
  const decoded: WithId<T>[] = [];
  for (const document of documents) {
    const raw = document.data({ serverTimestamps: 'estimate' });
    const data = decode(
      prepare ? prepare(raw, document.metadata.hasPendingWrites) : raw
    );
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
          customExercises: decodeDocuments(
            snapshot.docs,
            decodeCustomExercise,
            fillPendingTimestamps
          ),
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

export const createCustomExercise = async (
  uid: string,
  {
    locale,
    name,
    description,
    type,
    categoryRef,
    equipment,
  }: CustomExerciseInput
): Promise<void> => {
  if (equipment.length > CUSTOM_EXERCISE_EQUIPMENT_MAX_LENGTH) {
    throw new Error(
      `A custom exercise can have at most ${CUSTOM_EXERCISE_EQUIPMENT_MAX_LENGTH} equipment entries`
    );
  }

  const validationTimestamp = Timestamp.now();
  const exercise: CustomExercise = {
    categoryRef,
    forkedFromRef: null,
    name: { [locale]: name.trim() },
    // An empty description keeps its locale key: the validator and the rules require the default
    // locale in both maps.
    description: { [locale]: description.trim() },
    defaultLocale: locale,
    type,
    equipment,
    imageURL: null,
    createdAt: validationTimestamp,
    updatedAt: validationTimestamp,
  };
  assertCustomExerciseWrite(exercise);

  const now = serverTimestamp();
  await addDoc(customExercisesRef(uid), {
    ...exercise,
    createdAt: now,
    updatedAt: now,
  });
};
