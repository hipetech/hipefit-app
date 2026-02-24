import type { UserProfile, UserSettings } from '@/database';
import { onSnapshot, updateDoc } from '@react-native-firebase/firestore';
import { create } from 'zustand';

import { userRef } from '@/database';

interface UserState {
  _uid: string | null;
  profile: UserProfile | null;
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  updateProfile: (fields: { displayName: string }) => Promise<void>;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  _uid: null,
  profile: null,
  isLoading: true,

  subscribe: (uid) => {
    set({ _uid: uid, isLoading: true });

    const unsub = onSnapshot(
      userRef(uid),
      (snapshot) => {
        if (snapshot.exists()) {
          set({ profile: snapshot.data() as UserProfile, isLoading: false });
        } else {
          set({ profile: null, isLoading: false });
        }
      },
      (error) => {
        console.error('[UserStore]', error);
        set({ isLoading: false });
      }
    );

    return () => {
      unsub();
      set({ _uid: null, profile: null, isLoading: true });
    };
  },

  updateSettings: async (partial) => {
    const uid = get()._uid;
    if (!uid) return;
    const dotNotation: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(partial)) {
      dotNotation[`settings.${key}`] = value;
    }
    await updateDoc(userRef(uid), dotNotation);
  },

  updateProfile: async ({ displayName }) => {
    const uid = get()._uid;
    if (!uid) return;
    await updateDoc(userRef(uid), { displayName });
  },

  reset: () => set({ _uid: null, profile: null, isLoading: true }),
}));
