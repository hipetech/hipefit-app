import type { WithId } from '@hipefit/schemas';
import type { SnapshotOptions } from '@react-native-firebase/firestore';
import { Timestamp } from '@react-native-firebase/firestore';

export interface SnapshotDocument {
  id: string;
  metadata: { hasPendingWrites: boolean };
  data: (options?: SnapshotOptions) => unknown;
}

/**
 * Gives a locally written document the timestamps the server has not set yet.
 *
 * `createCustomExercise` in `exercise-service.ts` and `createWorkoutTemplate` in
 * `workout-template-service.ts` write `serverTimestamp()` into `createdAt` and
 * `updatedAt`. Until the server acknowledges the write, the listener's snapshot
 * carries `null` in both: `DocumentSnapshot.data()` in
 * @react-native-firebase/firestore 25.1.0 returns the stored data and ignores
 * its `serverTimestamps` option unless a converter is attached. The decoder
 * rejects `null`, so without this the new document is dropped, and logged as
 * malformed, until the acknowledged snapshot arrives. The user service does the
 * same for the profile document.
 */
export const fillPendingTimestamps = (
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

/**
 * Decodes a snapshot's documents and omits the ones the decoder rejects, so one
 * malformed document does not hide the rest. The exercise catalogue listeners
 * and the workout template listener share it. `prepare` adjusts the raw data
 * before decoding; listeners on collections the app writes pass
 * `fillPendingTimestamps`.
 */
export const decodeDocuments = <T>(
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
