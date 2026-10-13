import { create } from 'zustand';

interface CustomExerciseSheetState {
  /** Whether the custom exercise sheet is on screen. */
  isPresented: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Whether the custom exercise sheet is presented.
 *
 * A store rather than local state because the two halves are mounted in
 * different places and neither contains the other: the action that opens the
 * sheet is in `features/navigation-dock/navigation-dock.tsx`, and the sheet is
 * mounted in `app/(private)/_layout.tsx`. Lifting the state to the layout would
 * put UI state in a route file, which `docs/app/architecture.md` keeps out of
 * `app/`.
 *
 * This is UI state, not a domain store: it has no Firestore data, no
 * `subscribe(uid)`, and no `reset()`. Form state stays in the form component.
 * There is no `toggle` because nothing toggles this sheet.
 */
export const useCustomExerciseSheetStore = create<CustomExerciseSheetState>(
  (set) => ({
    isPresented: false,
    open: () => set({ isPresented: true }),
    close: () => set({ isPresented: false }),
  })
);
