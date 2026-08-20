import { useEffect } from 'react';

import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useExerciseStore } from '@/features/exercises/store/use-exercise-store';
import { useUserStore } from '@/features/user/store/use-user-store';

export function useFirestoreSubscriptions() {
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
}
