import type {
  TemplateExercise,
  WithId,
  WorkoutTemplate,
} from '@hipefit/schemas';
import { workoutTemplatesRef } from '@hipefit/firebase/react-native';
import {
  assertWorkoutTemplateWrite,
  decodeWorkoutTemplate,
} from '@hipefit/schemas';
import {
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';

import { decodeDocuments, fillPendingTimestamps } from './firestore-timestamps';

export interface WorkoutTemplateSubscriptionHandlers {
  onData: (templates: WithId<WorkoutTemplate>[]) => void;
  onError: (error: Error) => void;
}

export interface WorkoutTemplateInput {
  name: string;
  /** The local day the template is planned for, `YYYY-MM-DD`, or `null` for none. */
  plannedDate: string | null;
  exercises: TemplateExercise[];
}

export const subscribeToWorkoutTemplates = (
  uid: string,
  { onData, onError }: WorkoutTemplateSubscriptionHandlers
): (() => void) =>
  onSnapshot(
    query(workoutTemplatesRef(uid), orderBy('updatedAt', 'desc')),
    (snapshot) =>
      onData(
        decodeDocuments(
          snapshot.docs,
          decodeWorkoutTemplate,
          fillPendingTimestamps
        )
      ),
    onError
  );

export const createWorkoutTemplate = async (
  uid: string,
  { name, plannedDate, exercises }: WorkoutTemplateInput
): Promise<void> => {
  const validationTimestamp = Timestamp.now();
  const template: WorkoutTemplate = {
    name: name.trim(),
    // The editor has no description field; the stored key stays for the rules
    // and the validator, which require it.
    description: null,
    exercises,
    // Left out rather than stored as `null`: the key is optional, so templates
    // written before it existed stay valid.
    ...(plannedDate === null ? {} : { plannedDate }),
    estimatedDuration: null,
    isArchived: false,
    lastPerformedAt: null,
    timesPerformed: 0,
    createdAt: validationTimestamp,
    updatedAt: validationTimestamp,
  };
  assertWorkoutTemplateWrite(template);

  const now = serverTimestamp();
  await addDoc(workoutTemplatesRef(uid), {
    ...template,
    createdAt: now,
    updatedAt: now,
  });
};
