import type { WorkoutTemplateInput } from '@/services/workout-template-service';
import type { WithId, WorkoutTemplate } from '@hipefit/schemas';
import { create } from 'zustand';

import {
  createWorkoutTemplate,
  subscribeToWorkoutTemplates,
} from '@/services/workout-template-service';

interface WorkoutTemplateState {
  _uid: string | null;
  templates: WithId<WorkoutTemplate>[];
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  createWorkoutTemplate: (input: WorkoutTemplateInput) => Promise<void>;
}

export const useWorkoutTemplateStore = create<WorkoutTemplateState>(
  (set, get) => ({
    _uid: null,
    templates: [],
    isLoading: true,

    subscribe: (uid) => {
      set({ _uid: uid, isLoading: true });
      const unsubscribe = subscribeToWorkoutTemplates(uid, {
        onData: (templates) => {
          set({
            templates: templates.filter(({ data }) => !data.isArchived),
            isLoading: false,
          });
        },
        onError: (error) => {
          console.error('[WorkoutTemplateStore]', error);
          set({ isLoading: false });
        },
      });

      return () => {
        unsubscribe();
        set({ _uid: null, templates: [], isLoading: true });
      };
    },

    createWorkoutTemplate: async (input) => {
      const uid = get()._uid;
      if (!uid) {
        throw new Error('Cannot create a workout template while signed out');
      }
      await createWorkoutTemplate(uid, input);
    },
  })
);
