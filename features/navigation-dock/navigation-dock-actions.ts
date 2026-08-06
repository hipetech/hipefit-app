import type { NavigationDockAction } from '@hipefit/navigation-dock';

/**
 * The three create actions, in grid order. Native lays them out three per row
 * and sizes the card to its content, so the array's order is the reading order.
 *
 * All three ship `enabled: false` because there is nowhere to send them: no
 * route in `app/` creates a workout, a routine, or an exercise. They are the
 * same three the anchored create menu carried, with the same labels — a Workout
 * is the logged entity, a Routine the template — so the affordance moved
 * without the product behind it changing.
 *
 * Going live means flipping `enabled` and giving `onActionPress` a destination,
 * which is a state change and so also earns a `hapticImpact()` from
 * `@/lib/haptics`. Enable them together with the Start Workout affordances
 * listed in `docs/app/architecture.md`.
 */
export const NAVIGATION_DOCK_ACTIONS: NavigationDockAction[] = [
  {
    id: 'start-workout',
    label: 'Start Workout',
    systemImage: 'play.fill',
    enabled: false,
  },
  {
    id: 'new-routine',
    label: 'New Routine',
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
