import { Stack } from 'expo-router';

import { WorkoutsContent } from '@/features/workouts/workouts-content';

/**
 * Workouts route. Deliberately thin: zero `Host` here, the whole screen is one
 * island in `features/` that owns its own Host. The title lives in the
 * navigation stack, never in the body.
 *
 * There is no `+` toolbar menu here any more — the create actions moved to the
 * detached Create item on the tab bar in `app/(private)/_layout.tsx`, so they are
 * reachable from every tab rather than this one screen. See `docs/app/navigation.md`.
 */
export default function Workouts() {
  return (
    <>
      <WorkoutsContent />
      <Stack.Screen.Title large>Workouts</Stack.Screen.Title>
    </>
  );
}
