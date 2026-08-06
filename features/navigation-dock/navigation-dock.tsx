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
 * The view is full-screen so it can own its own hit testing: collapsed it
 * passes every touch through, expanded its scrim captures everything above the
 * tab bar and nothing below it. Mount it edge to edge — an inset frame shrinks
 * the safe-area insets UIKit hands it and moves the panel off its measured
 * offset.
 */
const styles = StyleSheet.create({
  dock: StyleSheet.absoluteFill,
});

/**
 * The app-wide create panel, drawn natively by `@hipefit/navigation-dock`
 * (`packages/navigation-dock/`).
 *
 * **The button is not here.** Neither are the tabs. All five bottom items are
 * real `UITabBar` items — Create is the `role="search"` trigger in
 * `app/(private)/_layout.tsx`, which is what puts it beside the bar instead of
 * floating above it. This component is only the panel that trigger opens, which
 * is why it has no press handler and why `expanded` lives in a store both halves
 * can reach.
 *
 * The division is the one frozen in
 * `docs/plans/native-navigation-dock/reference/bridge-contract.md`: React owns
 * the expanded state and the action descriptors, native owns rendering,
 * animation, materials and accessibility. `expanded` is controlled — native
 * animates toward whatever arrives rather than keeping its own copy — which is
 * what lets the three dismissals below win over a stale native state.
 *
 * All three dismissals are subscriptions to something outside React rather than
 * effects watching React state, because the panel is transient modal state and
 * the things that should close it are events, not renders.
 */
export const NavigationDock = () => {
  const expanded = useNavigationDockStore((state) => state.expanded);
  const close = useNavigationDockStore((state) => state.close);
  const reduceMotion = useReduceMotion();
  const colorScheme = useAppColorScheme();
  const navigationRef = useNavigationContainerRef();

  /*
   * Any navigation closes the panel — a push, a presented sheet, a deep link, or
   * the redirect that follows a session change. Not a tab switch while the panel
   * is up: the scrim is modal and swallows that tap. This covers navigation that
   * originates anywhere else. Watching route state in an effect instead would
   * mean a `setState` in an effect body, which React Compiler's lint rejects for
   * the cascading render it causes.
   */
  useEffect(
    () => navigationRef.addListener('state', close),
    [navigationRef, close]
  );

  useEffect(() => {
    /*
     * `'background'`, not `'inactive'`. iOS reports `'inactive'` for a pulled
     * Control Center, a notification banner and an incoming system alert — all
     * of which the user is still standing in front of the panel for, and all of
     * which would otherwise collapse it out from under them.
     */
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        close();
      }
    });

    return () => subscription.remove();
  }, [close]);

  /*
   * Collapse when the session ends. Signing out through Settings cannot reach
   * this — that button is behind the scrim — but Firebase can end a session on
   * its own at any moment (revoked token, deleted account), and the panel may
   * well be open when it does. Subscribing to the store rather than selecting
   * `isLoggedIn` keeps this out of the render path: the dock has no reason to
   * re-render on an auth change it is not displaying.
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
      // The hook returns `undefined` for "follow the device"; the bridge spells
      // that `null`, because it becomes `overrideUserInterfaceStyle` and a
      // missing key and an explicit "unspecified" are different things there.
      colorScheme={colorScheme ?? null}
      /*
        The one number the view cannot work out for itself. It sits above the
        system tab bar, and no public API reports that bar's height or its
        minimize state — which is the entire reason
        `navigation-dock-metrics.ts` exists and why every value in it is
        measured rather than derived. Re-measure there, not here.
      */
      bottomInset={NAVIGATION_DOCK_BOTTOM_INSET}
      onDismissRequest={close}
      // All three actions ship unavailable, so native swallows their touches
      // and this never fires. It is wired to nothing rather than left off: an
      // unhandled event is how a "temporary" stub becomes a silent navigation
      // to the wrong place later. `navigation-dock-actions.ts` records what
      // they wait on.
      onActionPress={() => {}}
    />
  );
};
