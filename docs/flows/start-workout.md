---
type: flow
status: current
area: workouts
updated: 2026-08-20
---

# Flow: start a workout

> **This journey does not ship.** Start and Resume affordances are present but disabled. There is no
> player route, draft/session state, or client read/write path for `users/{uid}/workouts` or
> `users/{uid}/workoutTemplates`.

## User goal

Begin a training session from a saved workout template or as a freestyle workout, record sets, and
later finish it into history.

No step after choosing an affordance is reachable today.

## Prerequisites

- The user is signed in. The user and exercise stores are subscribed.
- The exercise catalogue can be read from the three seeded global collections and optional custom
  collections. There is no workout-specific picker projection.

## Disabled entry points

| Entry point                                  | Location                                                                                  | Current stop                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Start Workout in the create panel            | [`navigation-dock-actions.ts`](../../features/navigation-dock/navigation-dock-actions.ts) | Action ships `enabled: false`                          |
| Start Workout below Home's featured template | [`home-content.tsx`](../../features/home/home-content.tsx)                                | Button has the shared disabled modifier and no handler |
| Add to Workout in an expanded exercise row   | [`exercise-row.tsx`](../../features/exercises/exercise-row.tsx)                           | Button has no action and is disabled                   |
| Add to Workout in the exercise detail sheet  | [`exercise-detail-sheet.tsx`](../../features/exercises/exercise-detail-sheet.tsx)         | `onAdd` would dismiss, but the button is disabled      |

The convention remains: an unavailable destination is shown inert rather than hidden. Enabling any
one of these controls without the missing route and write lifecycle would create a false affordance.

## Main path today

1. The user opens Home, Workouts, Exercises, or the global create panel.
2. Home and Workouts show zero/empty workout and template state without issuing Firestore requests.
3. The user reaches a Start or Add control and finds it disabled.
4. The path ends. No route is pushed and no Firestore read or write occurs.

## Missing implementation

- A workout-player route and presentation model.
- Draft/session state that survives tab movement and app interruption.
- Workout state and actions for start, set updates, completion, abandonment, and deletion.
- A decision and enforcement mechanism for how many workouts may be in progress.
- A template-selection or freestyle exercise-picker surface.
- The completion behavior documented in [finish and log a workout](log-workout.md).

The current `Workout` shape already carries template refs/snapshots, status, local date/time zone,
measured active duration, bodyweight snapshot, notes, and nested exercises/sets. Its decoder and
rules are retained contracts, not evidence that the creation journey or a read path exists.

## State and read behavior

- No workout or workout-template Zustand store exists.
- Central subscription orchestration starts only the user and exercise stores.
- [`useExerciseStore`](../../features/exercises/store/use-exercise-store.ts) exposes the localized,
  visible browse catalogue but no workout picker or canonical-fork resolver.
- Workout/template interfaces, decoders, assertions, rules, and indexes remain available for a later
  implementation.

## Empty and error behavior

- No templates: Workouts shows `No workout templates yet`; Home shows
  `No Active Workout Templates`. Both footers mention creating a template even though that action is
  disabled.
- No workouts: history empty states render normally.
- Workout/template loading skeleton code remains available for later integration, but no current
  workout request makes it reachable.
- There is no workout/template listener and therefore no listener error path.

## Completion state

There is none. The shipped behavior is an empty presentation with all user-facing start controls
disabled.
