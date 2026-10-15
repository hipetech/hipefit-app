import type { NavigationDockAction } from '@hipefit/navigation-dock';

/**
 * The three create actions, in grid order — native lays them out three per row,
 * so array order is reading order.
 *
 * Start Workout ships `enabled: false` because there is nowhere to send it:
 * nothing in the app creates a workout. Going live means flipping `enabled`,
 * giving `onActionPress` a destination, and adding a `hapticImpact()` from
 * `@/lib/haptics` — together with the Start Workout affordances listed in
 * `docs/app/architecture.md`.
 *
 * New Workout Template and Custom Exercise are live. `navigation-dock.tsx`
 * handles their presses and matches them by `NEW_WORKOUT_TEMPLATE_ACTION_ID`
 * and `CUSTOM_EXERCISE_ACTION_ID`.
 */
export const NEW_WORKOUT_TEMPLATE_ACTION_ID = 'new-workout-template';

export const CUSTOM_EXERCISE_ACTION_ID = 'custom-exercise';

export const NAVIGATION_DOCK_ACTIONS: NavigationDockAction[] = [
  {
    id: 'start-workout',
    label: 'Start Workout',
    systemImage: 'play.fill',
    enabled: false,
  },
  {
    id: NEW_WORKOUT_TEMPLATE_ACTION_ID,
    label: 'New Workout Template',
    systemImage: 'list.bullet.rectangle',
    enabled: true,
  },
  {
    id: CUSTOM_EXERCISE_ACTION_ID,
    label: 'Custom Exercise',
    systemImage: 'dumbbell',
    enabled: true,
  },
];
