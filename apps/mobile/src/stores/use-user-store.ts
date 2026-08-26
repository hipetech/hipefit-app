import type { UserProfileUpdate, WeighInInput } from '@/services/user-service';
import type {
  BodyMeasurement,
  UserProfile,
  UserSettings,
  WithId,
} from '@hipefit/schemas';
import { create } from 'zustand';

import {
  addUserWeighIn,
  subscribeToUserData,
  updateUserProfile,
  updateUserSettings,
} from '@/services/user-service';

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
    const unsubscribe = subscribeToUserData(uid, {
      getCurrentProfile: () => get().profile,
      onProfile: (profile) => {
        set({ profile });
        finish('profile');
      },
      onMeasurement: (currentBodyMeasurement) => {
        set({
          currentBodyMeasurement,
          currentWeight: currentBodyMeasurement?.data.weightKg ?? null,
        });
        finish('measurement');
      },
      onProfileError: (error) => {
        console.error('[UserStore:profile]', error);
        finish('profile');
      },
      onMeasurementError: (error) => {
        console.error('[UserStore:measurement]', error);
        finish('measurement');
      },
    });

    return () => {
      unsubscribe();
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
    await updateUserSettings(uid, profile, partial);
  },

  updateProfile: async (fields) => {
    const { uid, profile } = writableState(get());
    await updateUserProfile(uid, profile, fields);
  },

  addWeighIn: async (input) => {
    const uid = get()._uid;
    if (!uid) throw new Error('Cannot add a weigh-in while signed out');
    await addUserWeighIn(uid, input);
  },
}));
