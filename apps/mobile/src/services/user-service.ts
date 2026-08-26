import type {
  BodyMeasurement,
  UserProfile,
  UserSettings,
  WithId,
} from '@hipefit/schemas';
import { bodyMeasurementsRef, userRef } from '@hipefit/firebase/react-native';
import {
  assertBodyMeasurementWrite,
  assertUserProfileWrite,
  decodeBodyMeasurement,
  decodeUserProfile,
} from '@hipefit/schemas';
import {
  addDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from '@react-native-firebase/firestore';

export interface UserProfileUpdate {
  displayName?: string;
  birthDate?: string | null;
  heightCm?: number | null;
  purpose?: string | null;
}

export interface WeighInInput {
  recordedAt: Date;
  weightKg: number;
  note?: string;
}

export interface UserSubscriptionHandlers {
  getCurrentProfile: () => UserProfile | null;
  onProfile: (profile: UserProfile | null) => void;
  onMeasurement: (measurement: WithId<BodyMeasurement> | null) => void;
  onProfileError: (error: Error) => void;
  onMeasurementError: (error: Error) => void;
}

export const subscribeToUserData = (
  uid: string,
  handlers: UserSubscriptionHandlers
): (() => void) => {
  const unsubscribeProfile = onSnapshot(
    userRef(uid),
    (snapshot) => {
      let data = snapshot.exists()
        ? snapshot.data({ serverTimestamps: 'previous' })
        : null;
      if (data && snapshot.metadata.hasPendingWrites) {
        const currentProfile = handlers.getCurrentProfile();
        const pendingTimestamp = Timestamp.now();
        data = {
          ...data,
          createdAt:
            data.createdAt ?? currentProfile?.createdAt ?? pendingTimestamp,
          updatedAt: currentProfile?.updatedAt ?? pendingTimestamp,
        };
      }
      handlers.onProfile(data ? decodeUserProfile(data) : null);
    },
    handlers.onProfileError
  );

  const measurementQuery = query(
    bodyMeasurementsRef(uid),
    orderBy('recordedAt', 'desc'),
    limit(1)
  );
  const unsubscribeMeasurement = onSnapshot(
    measurementQuery,
    (snapshot) => {
      const document = snapshot.docs[0];
      const data = document
        ? decodeBodyMeasurement(document.data({ serverTimestamps: 'estimate' }))
        : null;
      handlers.onMeasurement(
        document && data ? { id: document.id, data } : null
      );
    },
    handlers.onMeasurementError
  );

  return () => {
    unsubscribeProfile();
    unsubscribeMeasurement();
  };
};

export const updateUserSettings = async (
  uid: string,
  profile: UserProfile,
  partial: Partial<UserSettings>
): Promise<void> => {
  const nextProfile: UserProfile = {
    ...profile,
    settings: { ...profile.settings, ...partial },
    updatedAt: profile.updatedAt,
  };
  assertUserProfileWrite(nextProfile);

  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  for (const [key, value] of Object.entries(partial)) {
    updates[`settings.${key}`] = value;
  }
  await updateDoc(userRef(uid), updates);
};

export const updateUserProfile = async (
  uid: string,
  profile: UserProfile,
  fields: UserProfileUpdate
): Promise<void> => {
  const body = {
    birthDate:
      fields.birthDate !== undefined
        ? fields.birthDate
        : profile.body.birthDate,
    heightCm:
      fields.heightCm !== undefined ? fields.heightCm : profile.body.heightCm,
  };
  const nextProfile: UserProfile = {
    ...profile,
    displayName: fields.displayName ?? profile.displayName,
    purpose: fields.purpose !== undefined ? fields.purpose : profile.purpose,
    body,
    updatedAt: profile.updatedAt,
  };
  assertUserProfileWrite(nextProfile);

  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (fields.displayName !== undefined) {
    updates.displayName = fields.displayName;
  }
  if (fields.birthDate !== undefined) {
    updates['body.birthDate'] = fields.birthDate;
  }
  if (fields.heightCm !== undefined) {
    updates['body.heightCm'] = fields.heightCm;
  }
  if (fields.purpose !== undefined) updates.purpose = fields.purpose;
  await updateDoc(userRef(uid), updates);
};

export const addUserWeighIn = async (
  uid: string,
  { recordedAt, weightKg, note }: WeighInInput
): Promise<void> => {
  if (!Number.isFinite(recordedAt.getTime())) {
    throw new Error('Weigh-in date must be valid');
  }

  const measurement: BodyMeasurement = {
    recordedAt: Timestamp.fromDate(recordedAt),
    weightKg,
    ...(note === undefined ? {} : { note }),
  };
  assertBodyMeasurementWrite(measurement);
  await addDoc(bodyMeasurementsRef(uid), measurement);
};
