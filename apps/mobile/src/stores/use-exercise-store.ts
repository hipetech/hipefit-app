import type { ExerciseListenerName } from '@/services/exercise-service';
import type { ExerciseCatalogueSource } from '@hipefit/domain';
import { buildExerciseCatalogue } from '@hipefit/domain';
import { create } from 'zustand';

import { subscribeToExerciseCatalogue } from '@/services/exercise-service';

import { useUserStore } from './use-user-store';

export type {
  MergedCategory,
  MergedEquipment,
  MergedExercise,
} from '@hipefit/domain';

interface ExerciseState {
  exercises: ReturnType<typeof buildExerciseCatalogue>['exercises'];
  categories: ReturnType<typeof buildExerciseCatalogue>['categories'];
  equipment: ReturnType<typeof buildExerciseCatalogue>['equipment'];
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
}

interface RawData extends ExerciseCatalogueSource {
  firedListeners: Set<ExerciseListenerName>;
}

const LISTENER_COUNT = 5;

export const useExerciseStore = create<ExerciseState>((set) => {
  const raw: RawData = {
    globalExercises: [],
    globalCategories: [],
    equipment: [],
    customExercises: [],
    customCategories: [],
    firedListeners: new Set(),
  };

  const recompute = () => {
    const userState = useUserStore.getState();
    if (!userState.profile) {
      // A null profile means either "still loading" or "loaded, and there is no
      // usable profile" (missing document, or one the decoder rejected). Defer to
      // the user store so the second case falls through to the empty state rather
      // than holding the catalogue in a placeholder that never resolves.
      set({
        exercises: [],
        categories: [],
        equipment: [],
        isLoading: userState.isLoading,
      });
      return;
    }

    set({
      ...buildExerciseCatalogue(raw, userState.profile.settings),
      isLoading:
        raw.firedListeners.size < LISTENER_COUNT || userState.isLoading,
    });
  };

  const markFailed = (listener: ExerciseListenerName, error: Error) => {
    console.error(`[ExerciseStore:${listener}]`, error);
    raw.firedListeners.add(listener);
    recompute();
  };

  return {
    exercises: [],
    categories: [],
    equipment: [],
    isLoading: true,

    subscribe: (uid) => {
      raw.firedListeners.clear();
      const unsubscribeCatalogue = subscribeToExerciseCatalogue(uid, {
        onData: (listener, data) => {
          Object.assign(raw, data);
          raw.firedListeners.add(listener);
          recompute();
        },
        onError: markFailed,
      });
      const unsubscribeSettings = useUserStore.subscribe((state, previous) => {
        const settings = state.profile?.settings;
        const previousSettings = previous.profile?.settings;
        if (
          settings?.language !== previousSettings?.language ||
          settings?.hiddenExerciseRefs !==
            previousSettings?.hiddenExerciseRefs ||
          settings?.hiddenCategoryRefs !==
            previousSettings?.hiddenCategoryRefs ||
          state.isLoading !== previous.isLoading
        ) {
          recompute();
        }
      });

      return () => {
        unsubscribeCatalogue();
        unsubscribeSettings();
        raw.globalExercises = [];
        raw.globalCategories = [];
        raw.equipment = [];
        raw.customExercises = [];
        raw.customCategories = [];
        raw.firedListeners.clear();
        set({
          exercises: [],
          categories: [],
          equipment: [],
          isLoading: true,
        });
      };
    },
  };
});
