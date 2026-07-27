import { Stack } from 'expo-router';

import { WorkoutsContent } from '@/features/workouts/workouts-content';

/**
 * Trailing header menu. This is the native home for the create actions that
 * used to live in the floating action button; per the toolbar reference every
 * `Stack.Toolbar.*` child must be declared inline, not via a wrapper component.
 *
 * Every action is `disabled` because none of them has a destination yet — the
 * create flows and the workout player are still to be built. UIKit greys a
 * disabled menu item, so the menu advertises what is coming instead of taking a
 * tap and doing nothing. Drop the `disabled` prop as each screen lands.
 */
const CreateMenu = () => (
  <Stack.Toolbar placement="right">
    <Stack.Toolbar.Menu icon="plus">
      <Stack.Toolbar.MenuAction icon="figure.run" disabled>
        Start Workout
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction icon="list.bullet.rectangle" disabled>
        New Routine
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction icon="dumbbell" disabled>
        Custom Exercise
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  </Stack.Toolbar>
);

/**
 * Workouts route. Deliberately thin: zero `Host` here, the whole screen is one
 * platform-split island that owns its own Host on iOS and returns Host-less RN
 * on Android. The title lives in the navigation stack, never in the body.
 */
export default function Workouts() {
  return (
    <>
      <WorkoutsContent />
      <Stack.Screen.Title large>Workouts</Stack.Screen.Title>
      <CreateMenu />
    </>
  );
}
