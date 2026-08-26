import { useEffect } from 'react';

import { useAuthStore } from '@/stores/use-auth-store';
import { useExerciseStore } from '@/stores/use-exercise-store';
import { useUserStore } from '@/stores/use-user-store';

export const useFirestoreSubscriptions = (): void => {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    const unsubs = [
      useUserStore.getState().subscribe(uid),
      useExerciseStore.getState().subscribe(uid),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [user]);
};
