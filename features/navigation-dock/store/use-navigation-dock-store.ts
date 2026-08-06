import { create } from 'zustand';

interface NavigationDockState {
  /** Whether the action panel is on screen. */
  expanded: boolean;
  toggle: () => void;
  close: () => void;
}

/**
 * Whether the create action panel is open.
 *
 * A store rather than local state because the two halves are mounted in
 * different places and neither contains the other: the button is a
 * `NativeTabs.Trigger` in `app/(private)/_layout.tsx`, the panel a sibling
 * overlay. Lifting it to their common parent would put UI state in a route
 * layout, which `docs/app/architecture.md` keeps out of `app/`.
 *
 * Deliberately **not** a domain store — no Firestore data, no `subscribe(uid)`,
 * and no `reset()`: sign-out dismissal is an explicit `close()` from
 * `navigation-dock.tsx`.
 */
export const useNavigationDockStore = create<NavigationDockState>((set) => ({
  expanded: false,
  toggle: () => set((state) => ({ expanded: !state.expanded })),
  close: () => set({ expanded: false }),
}));
