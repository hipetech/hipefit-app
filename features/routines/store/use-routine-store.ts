import type { Routine, WithId } from '@/database';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { onSnapshot } from '@react-native-firebase/firestore';
import { create } from 'zustand';

import { routinesRef } from '@/database';

interface RoutineState {
  routines: WithId<Routine>[];
  activeRoutines: WithId<Routine>[];
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  reset: () => void;
}

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: [],
  activeRoutines: [],
  isLoading: true,

  subscribe: (uid) => {
    const unsub = onSnapshot(
      routinesRef(uid),
      (snap) => {
        const routines: WithId<Routine>[] = snap.docs.map(
          (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
            id: d.id,
            data: d.data() as Routine,
          })
        );
        const activeRoutines = routines.filter((r) => !r.data.isArchived);

        set({ routines, activeRoutines, isLoading: false });
      },
      (error) => {
        console.error('[RoutineStore]', error);
        set({ isLoading: false });
      }
    );

    return () => {
      unsub();
      set({ routines: [], activeRoutines: [], isLoading: true });
    };
  },

  reset: () => set({ routines: [], activeRoutines: [], isLoading: true }),
}));
