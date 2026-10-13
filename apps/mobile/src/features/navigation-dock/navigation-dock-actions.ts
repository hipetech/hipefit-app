import type { NavigationDockAction } from '@hipefit/navigation-dock';

/**
 * The three create actions, in grid order — native lays them out three per row,
 * so array order is reading order.
 *
 * Start Workout and New Workout Template ship `enabled: false` because there is
 * nowhere to send them: nothing in the app creates a workout or a workout
 * template. Going live means flipping `enabled`, giving `onActionPress` a
 * destination, and adding a `hapticImpact()` from `@/lib/haptics` — together
 * with the Start Workout affordances listed in `docs/app/architecture.md`.
 *
 * Custom Exercise is live. `navigation-dock.tsx` handles its press and matches
 * it by `CUSTOM_EXERCISE_ACTION_ID`.
 */
export const CUSTOM_EXERCISE_ACTION_ID = 'custom-exercise';

export const NAVIGATION_DOCK_ACTIONS: NavigationDockAction[] = [
  {
    id: 'start-workout',
    label: 'Start Workout',
    systemImage: 'play.fill',
    enabled: false,
  },
  {
    id: 'new-workout-template',
    label: 'New Workout Template',
    systemImage: 'list.bullet.rectangle',
    enabled: false,
  },
  {
    id: CUSTOM_EXERCISE_ACTION_ID,
    label: 'Custom Exercise',
    systemImage: 'dumbbell',
    enabled: true,
  },
];
