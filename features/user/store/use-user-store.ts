import type {
  BodyMeasurement,
  UserProfile,
  UserSettings,
  WithId,
} from '@/database';
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
import { create } from 'zustand';

import {
  assertBodyMeasurementWrite,
  assertUserProfileWrite,
  bodyMeasurementsRef,
  decodeBodyMeasurement,
  decodeUserProfile,
  userRef,
} from '@/database';

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

interface UserState {
  _uid: string | null;
  profile: UserProfile | null;
  currentBodyMeasurement: WithId<BodyMeasurement> | null;
  currentWeight: number | null;
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  updateProfile: (fields: UserProfileUpdate) => Promise<void>;
  addWeighIn: (input: WeighInInput) => Promise<void>;
}

interface WritableState {
  uid: string;
  profile: UserProfile;
}

const writableState = (state: UserState): WritableState => {
  if (!state._uid) throw new Error('Cannot write user data while signed out');
  if (!state.profile) throw new Error('Cannot write before the profile loads');
  return { uid: state._uid, profile: state.profile };
};

export const useUserStore = create<UserState>((set, get) => ({
  _uid: null,
  profile: null,
  currentBodyMeasurement: null,
  currentWeight: null,
  isLoading: true,

  subscribe: (uid) => {
    const firedListeners = new Set<'profile' | 'measurement'>();
    const finish = (listener: 'profile' | 'measurement') => {
      firedListeners.add(listener);
      set({ isLoading: firedListeners.size < 2 });
    };

    set({ _uid: uid, isLoading: true });

    const unsubscribeProfile = onSnapshot(
      userRef(uid),
      (snapshot) => {
        let data = snapshot.exists()
          ? snapshot.data({ serverTimestamps: 'previous' })
          : null;
        if (data && snapshot.metadata.hasPendingWrites) {
          const currentProfile = get().profile;
          const pendingTimestamp = Timestamp.now();
          data = {
            ...data,
            createdAt:
              data.createdAt ?? currentProfile?.createdAt ?? pendingTimestamp,
            updatedAt: currentProfile?.updatedAt ?? pendingTimestamp,
          };
        }
        const profile = data ? decodeUserProfile(data) : null;
        set({ profile });
        finish('profile');
      },
      (error) => {
        console.error('[UserStore:profile]', error);
        finish('profile');
      }
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
          ? decodeBodyMeasurement(
              document.data({ serverTimestamps: 'estimate' })
            )
          : null;
        const currentBodyMeasurement =
          document && data ? { id: document.id, data } : null;
        set({
          currentBodyMeasurement,
          currentWeight: currentBodyMeasurement?.data.weightKg ?? null,
        });
        finish('measurement');
      },
      (error) => {
        console.error('[UserStore:measurement]', error);
        finish('measurement');
      }
    );

    return () => {
      unsubscribeProfile();
      unsubscribeMeasurement();
      set({
        _uid: null,
        profile: null,
        currentBodyMeasurement: null,
        currentWeight: null,
        isLoading: true,
      });
    };
  },

  updateSettings: async (partial) => {
    const { uid, profile } = writableState(get());
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
  },

  updateProfile: async (fields) => {
    const { uid, profile } = writableState(get());
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
  },

  addWeighIn: async ({ recordedAt, weightKg, note }) => {
    const uid = get()._uid;
    if (!uid) throw new Error('Cannot add a weigh-in while signed out');
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
  },
}));
