import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { NavigationDockView } from '@hipefit/navigation-dock';
import { useNavigationContainerRef } from 'expo-router';

import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { NAVIGATION_DOCK_ACTIONS } from '@/features/navigation-dock/navigation-dock-actions';
import { NAVIGATION_DOCK_BOTTOM_INSET } from '@/features/navigation-dock/navigation-dock-metrics';
import { useNavigationDockStore } from '@/features/navigation-dock/store/use-navigation-dock-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/**
 * Mount edge to edge: an inset frame shrinks the safe-area insets UIKit hands
 * the view and moves the panel off its measured offset.
 */
const styles = StyleSheet.create({
  dock: StyleSheet.absoluteFill,
});

/**
 * The app-wide create panel, drawn natively by `@hipefit/navigation-dock`.
 *
 * **The button is not here**, nor the tabs — all five bottom items are real
 * `UITabBar` items (`app/(private)/_layout.tsx`). This is only the panel the
 * Create trigger opens, which is why it has no press handler and why `expanded`
 * lives in a store both halves can reach.
 *
 * React owns the expanded state and the action descriptors; native owns
 * rendering, animation, materials and accessibility
 * (`docs/plans/native-navigation-dock/reference/bridge-contract.md`). All three
 * dismissals below subscribe to something outside React rather than watching
 * state, because the things that should close the panel are events, not renders.
 */
export const NavigationDock = () => {
  const expanded = useNavigationDockStore((state) => state.expanded);
  const close = useNavigationDockStore((state) => state.close);
  const reduceMotion = useReduceMotion();
  const colorScheme = useAppColorScheme();
  const navigationRef = useNavigationContainerRef();

  /*
   * Any navigation closes the panel — a push, a sheet, a deep link, a redirect.
   * Not a tab switch while it is up: the scrim is modal and swallows that tap.
   * Watching route state in an effect instead would mean a `setState` in an
   * effect body, which React Compiler's lint rejects.
   */
  useEffect(
    () => navigationRef.addListener('state', close),
    [navigationRef, close]
  );

  useEffect(() => {
    /*
     * `'background'`, not `'inactive'`: iOS reports `'inactive'` for Control
     * Center, a notification banner and a system alert — all cases where the
     * user is still standing in front of the panel.
     */
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        close();
      }
    });

    return () => subscription.remove();
  }, [close]);

  /*
   * Collapse when the session ends. Signing out cannot reach this — that button
   * is behind the scrim — but Firebase can end a session on its own at any
   * moment. Subscribing rather than selecting `isLoggedIn` keeps it out of the
   * render path.
   */
  useEffect(
    () =>
      useAuthStore.subscribe((state, previousState) => {
        if (previousState.isLoggedIn && !state.isLoggedIn) {
          close();
        }
      }),
    [close]
  );

  return (
    <NavigationDockView
      style={styles.dock}
      expanded={expanded}
      actions={NAVIGATION_DOCK_ACTIONS}
      reduceMotion={reduceMotion}
      // `undefined` means "follow the device"; the bridge spells that `null`,
      // because it becomes `overrideUserInterfaceStyle` and a missing key and an
      // explicit "unspecified" are different things there.
      colorScheme={colorScheme ?? null}
      // The one number the view cannot work out for itself. Re-measure in
      // `navigation-dock-metrics.ts`, not here.
      bottomInset={NAVIGATION_DOCK_BOTTOM_INSET}
      onDismissRequest={close}
      // All three actions ship unavailable, so native swallows their touches and
      // this never fires. Wired to nothing rather than left off: an unhandled
      // event is how a stub becomes a silent navigation to the wrong place.
      onActionPress={() => {}}
    />
  );
};
