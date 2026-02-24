import { useEffect } from 'react';

import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useExerciseStore } from '@/features/exercises/store/use-exercise-store';
import { useRoutineStore } from '@/features/routines/store/use-routine-store';
import { useUserStore } from '@/features/user/store/use-user-store';
import { useWorkoutStore } from '@/features/workouts/store/use-workout-store';

export function useFirestoreSubscriptions() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    const unsubs = [
      useUserStore.getState().subscribe(uid),
      useExerciseStore.getState().subscribe(uid),
      useWorkoutStore.getState().subscribe(uid),
      useRoutineStore.getState().subscribe(uid),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [user]);
}
