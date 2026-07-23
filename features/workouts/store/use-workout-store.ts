import type { WithId, Workout } from '@/database';
import type { QueryDocumentSnapshot } from '@react-native-firebase/firestore';
import { onSnapshot, orderBy, query } from '@react-native-firebase/firestore';
import { create } from 'zustand';

import { workoutsRef } from '@/database';
import { RECENT_WORKOUTS_LIMIT } from '@/lib/constants';

interface WorkoutState {
  workouts: WithId<Workout>[];
  recentWorkouts: WithId<Workout>[];
  inProgressWorkout: WithId<Workout> | null;
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  reset: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  workouts: [],
  recentWorkouts: [],
  inProgressWorkout: null,
  isLoading: true,

  subscribe: (uid) => {
    const q = query(workoutsRef(uid), orderBy('startedAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const workouts: WithId<Workout>[] = snap.docs.map(
          (d: QueryDocumentSnapshot) => ({
            id: d.id,
            data: d.data() as Workout,
          })
        );

        const inProgress =
          workouts.find((w) => w.data.status === 'in_progress') ?? null;
        const completed = workouts.filter(
          (w) => w.data.status !== 'in_progress'
        );

        set({
          workouts,
          recentWorkouts: completed.slice(0, RECENT_WORKOUTS_LIMIT),
          inProgressWorkout: inProgress,
          isLoading: false,
        });
      },
      (error) => {
        console.error('[WorkoutStore]', error);
        set({ isLoading: false });
      }
    );

    return () => {
      unsub();
      set({
        workouts: [],
        recentWorkouts: [],
        inProgressWorkout: null,
        isLoading: true,
      });
    };
  },

  reset: () =>
    set({
      workouts: [],
      recentWorkouts: [],
      inProgressWorkout: null,
      isLoading: true,
    }),
}));
