import { create } from 'zustand';

interface WorkoutTemplateSheetState {
  /** Whether the workout template sheet is on screen. */
  isPresented: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Whether the workout template sheet is presented.
 *
 * A store rather than local state because the two halves are mounted in
 * different places and neither contains the other: the action that opens the
 * sheet is in `features/navigation-dock/navigation-dock.tsx`, and the sheet is
 * mounted in `app/(private)/_layout.tsx`. Lifting the state to the layout would
 * put UI state in a route file, which `docs/app/architecture.md` keeps out of
 * `app/`.
 *
 * This is UI state, not a domain store: it has no Firestore data, no
 * `subscribe(uid)`, and no `reset()`. The template draft stays in the form
 * component. It is kept separate from `useCustomExerciseSheetStore` because
 * each sheet has one opener and one mount point. There is no `toggle` because
 * nothing toggles this sheet.
 */
export const useWorkoutTemplateSheetStore = create<WorkoutTemplateSheetState>(
  (set) => ({
    isPresented: false,
    open: () => set({ isPresented: true }),
    close: () => set({ isPresented: false }),
  })
);
