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
 * A store rather than local state because the two halves of the affordance are
 * mounted in different places and neither contains the other. The button is a
 * `NativeTabs.Trigger` inside the navigator in `app/(private)/_layout.tsx`; the
 * panel is a sibling overlay rendered by `NavigationDock`. Lifting the state to
 * their common parent would mean the route layout holding UI state and passing
 * it back down through props, which is the arrangement `docs/app/architecture.md`
 * keeps out of `app/`.
 *
 * Deliberately **not** a domain store. It holds no Firestore data, has no
 * `subscribe(uid)` and is not started by `database/use-firestore-subscriptions.ts`
 * — it is transient UI state that happens to need two call sites. That is why it
 * has no `reset()` either: sign-out dismissal is an explicit `close()` from the
 * subscription in `navigation-dock.tsx`, where the reasoning about it lives.
 */
export const useNavigationDockStore = create<NavigationDockState>((set) => ({
  expanded: false,
  toggle: () => set((state) => ({ expanded: !state.expanded })),
  close: () => set({ expanded: false }),
}));
