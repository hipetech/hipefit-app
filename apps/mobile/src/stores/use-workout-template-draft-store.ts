import type { WorkoutTemplateDraft } from '@/features/workout-templates/workout-template-draft';
import { create } from 'zustand';

import { createWorkoutTemplateDraft } from '@/features/workout-templates/workout-template-draft';
import { toLocalDateId } from '@/lib/format';

interface WorkoutTemplateDraftData {
  /** The template being created, or `null` when none is. */
  draft: WorkoutTemplateDraft | null;
  /** Whether the user has edited the name, which shows its error before Save. */
  isNameEdited: boolean;
  /** Exercises whose sets the user has edited, by exercise key. Their errors show before Save. */
  editedExerciseKeys: ReadonlySet<string>;
  /**
   * Which note fields the user has opened, by set key or superset id. UI
   * state, not draft: an empty note that is closed again leaves no trace.
   */
  openNoteKeys: ReadonlySet<string>;
  /** Whether Save has been pressed, which shows every field error. */
  didPressSave: boolean;
  /**
   * Whether a save of this draft is in flight. Held here rather than in the
   * editor so a minimize and reopen during the write cannot start a second one.
   */
  isSaving: boolean;
}

interface WorkoutTemplateDraftState extends WorkoutTemplateDraftData {
  start: () => void;
  updateDraft: (
    update: (current: WorkoutTemplateDraft) => WorkoutTemplateDraft
  ) => void;
  markNameEdited: () => void;
  markExerciseEdited: (exerciseKey: string) => void;
  toggleNote: (noteKey: string) => void;
  setDidPressSave: (didPressSave: boolean) => void;
  setIsSaving: (isSaving: boolean) => void;
  discard: () => void;
}

/**
 * The sets are never mutated, only replaced, so every reset can share these.
 */
const INITIAL_STATE: WorkoutTemplateDraftData = {
  draft: null,
  isNameEdited: false,
  editedExerciseKeys: new Set(),
  openNoteKeys: new Set(),
  didPressSave: false,
  isSaving: false,
};

/**
 * The workout template being created and the editor state that must survive
 * minimizing, so the editor can unmount and remount without losing anything.
 * Memory only: the draft does not survive the app being killed.
 *
 * `start()` begins a draft only when none exists, so reopening a minimized
 * draft continues it. `updateDraft` takes the pure operations from
 * `workout-template-draft.ts` and does nothing without a draft. An operation
 * that returns its input unchanged leaves the store unchanged.
 *
 * The editor keeps the save error as local state, because it describes one
 * save attempt rather than the draft, and clears it on every draft update.
 * Saving goes through `useWorkoutTemplateStore`; only its in-flight flag lives
 * here.
 *
 * This is UI state, not a domain store: it has no Firestore data and no
 * `subscribe(uid)`. Sign-out clears it with an explicit `discard()`.
 */
export const useWorkoutTemplateDraftStore = create<WorkoutTemplateDraftState>(
  (set) => ({
    ...INITIAL_STATE,

    start: () =>
      set((state) =>
        state.draft === null
          ? {
              ...INITIAL_STATE,
              // A new template is planned for today until the user picks
              // another day or removes the date.
              draft: createWorkoutTemplateDraft(toLocalDateId(new Date())),
            }
          : state
      ),

    updateDraft: (update) =>
      set((state) => {
        if (state.draft === null) return state;
        const draft = update(state.draft);
        return draft === state.draft ? state : { draft };
      }),

    markNameEdited: () =>
      set((state) => (state.isNameEdited ? state : { isNameEdited: true })),

    markExerciseEdited: (exerciseKey) =>
      set((state) =>
        state.editedExerciseKeys.has(exerciseKey)
          ? state
          : {
              editedExerciseKeys: new Set(state.editedExerciseKeys).add(
                exerciseKey
              ),
            }
      ),

    toggleNote: (noteKey) =>
      set((state) => {
        const openNoteKeys = new Set(state.openNoteKeys);
        if (!openNoteKeys.delete(noteKey)) openNoteKeys.add(noteKey);
        return { openNoteKeys };
      }),

    setDidPressSave: (didPressSave) => set({ didPressSave }),

    setIsSaving: (isSaving) => set({ isSaving }),

    discard: () => set(INITIAL_STATE),
  })
);
