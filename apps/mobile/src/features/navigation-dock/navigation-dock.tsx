import type { NavigationDockViewProps } from '@hipefit/navigation-dock';
import type React from 'react';
import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { useExpandableAccessory } from '@hipefit/expandable-accessory';
import { NavigationDockView } from '@hipefit/navigation-dock';
import { useNavigationContainerRef } from 'expo-router';

import {
  CUSTOM_EXERCISE_ACTION_ID,
  NAVIGATION_DOCK_ACTIONS,
  NEW_WORKOUT_TEMPLATE_ACTION_ID,
} from '@/features/navigation-dock/navigation-dock-actions';
import { NAVIGATION_DOCK_BOTTOM_INSET } from '@/features/navigation-dock/navigation-dock-metrics';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { hapticImpact } from '@/lib/haptics';
import { useAuthStore } from '@/stores/use-auth-store';
import { useCustomExerciseSheetStore } from '@/stores/use-custom-exercise-sheet-store';
import { useNavigationDockStore } from '@/stores/use-navigation-dock-store';
import { useWorkoutTemplateDraftStore } from '@/stores/use-workout-template-draft-store';

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
 * Create trigger opens, which is why it has no handler for the Create press and
 * why `expanded` lives in a store both halves can reach.
 *
 * React owns the expanded state and the action descriptors; native owns
 * rendering, animation, materials and accessibility
 * (`docs/plans/native-navigation-dock/reference/bridge-contract.md`). All three
 * dismissals below subscribe to something outside React rather than watching
 * state, because the things that should close the panel are events, not renders.
 */
export const NavigationDock: React.FC = () => {
  const expanded = useNavigationDockStore((state) => state.expanded);
  const close = useNavigationDockStore((state) => state.close);
  const openCustomExerciseSheet = useCustomExerciseSheetStore(
    (state) => state.open
  );
  const startWorkoutTemplate = useWorkoutTemplateDraftStore(
    (state) => state.start
  );
  const reduceMotion = useReduceMotion();
  const colorScheme = useAppColorScheme();
  const navigationRef = useNavigationContainerRef();
  const { open: openWorkoutTemplate } = useExpandableAccessory();

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

  /*
   * New Workout Template and Custom Exercise are the enabled actions. Start
   * Workout is disabled natively and never fires, so any other `id` is ignored
   * rather than guessed at: an unhandled event is how a stub becomes a silent
   * navigation to the wrong place.
   *
   * New Workout Template starts a draft and opens the editor route. `start()`
   * leaves an existing draft alone, so with a draft minimized in the tab bar
   * this reopens it instead of replacing it. The accessory provider's `open()`
   * pushes the route without checking `active`, which in this render is still
   * false until `start()` re-renders the provider.
   *
   * Custom Exercise opens a SwiftUI sheet driven by store state, which emits
   * no navigation event, so the `state` listener above cannot close the panel
   * for it, and a panel left expanded would keep its modal scrim and
   * `accessibilityViewIsModal` under the sheet. Both branches close the panel
   * explicitly so neither depends on that listener.
   *
   * The haptic fires here, in the press handler, for the reason recorded in
   * `app/(private)/_layout.tsx`: a store updater must be pure and may run
   * twice. `hapticImpact` is the intent for a tap that puts something new on
   * screen.
   */
  const handleActionPress: NavigationDockViewProps['onActionPress'] = ({
    nativeEvent,
  }) => {
    switch (nativeEvent.id) {
      case NEW_WORKOUT_TEMPLATE_ACTION_ID:
        hapticImpact();
        close();
        startWorkoutTemplate();
        openWorkoutTemplate();
        return;
      case CUSTOM_EXERCISE_ACTION_ID:
        hapticImpact();
        close();
        openCustomExerciseSheet();
        return;
      default:
        return;
    }
  };

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
      onActionPress={handleActionPress}
    />
  );
};
