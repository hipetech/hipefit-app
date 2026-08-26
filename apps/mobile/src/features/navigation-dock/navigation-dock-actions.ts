import type { NavigationDockAction } from '@hipefit/navigation-dock';

/**
 * The three create actions, in grid order — native lays them out three per row,
 * so array order is reading order.
 *
 * All three ship `enabled: false` because there is nowhere to send them: no
 * route in `app/` creates a workout, workout template, or exercise. Going live
 * means flipping `enabled`, giving `onActionPress` a destination, and adding a
 * `hapticImpact()` from `@/lib/haptics` — together with the Start Workout
 * affordances listed in `docs/app/architecture.md`.
 */
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
    id: 'custom-exercise',
    label: 'Custom Exercise',
    systemImage: 'dumbbell',
    enabled: false,
  },
];
