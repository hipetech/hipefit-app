---
type: flow
status: current
area: workouts
updated: 2026-10-14
---

# Flow: start a workout

> **This journey does not ship.** Start and Resume affordances are present but disabled. There is no
> player route, draft/session state, or client read/write path for `users/{uid}/workouts`. Saved
> workout templates are read and shown on Workouts, but nothing starts one.

## User goal

Begin a training session from a saved workout template or as a freestyle workout, record sets, and
later finish it into history.

No step after choosing an affordance is reachable today.

## Prerequisites

- The user is signed in. The user, exercise, and workout template stores are subscribed.
- The exercise catalogue can be read from the three seeded global collections and optional custom
  collections. Firebase listeners live in the mobile exercise service; catalogue merging and
  localization live in the exercise feature. There is no workout-specific picker projection.

## Disabled entry points

| Entry point                                  | Location                                                                                                  | Current stop                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Start Workout in the create panel            | [`navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts) | Action ships `enabled: false`                          |
| Start Workout below Home's featured template | [`home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx)                                | Button has the shared disabled modifier and no handler |
| Add to Workout in an expanded exercise row   | [`exercise-row.tsx`](../../apps/mobile/src/features/exercises/exercise-row.tsx)                           | Button has no action and is disabled                   |
| Add to Workout in the exercise detail sheet  | [`exercise-detail-sheet.tsx`](../../apps/mobile/src/features/exercises/exercise-detail-sheet.tsx)         | `onAdd` would dismiss, but the button is disabled      |

The convention remains: an unavailable destination is shown inert rather than hidden. Enabling any
one of these controls without the missing route and write lifecycle would create a false affordance.

## Main path today

1. The user opens Home, Workouts, Exercises, or the global create panel.
2. Home shows zero/empty workout and template state without issuing Firestore requests for either.
   Workouts shows the user's saved templates as cards that open a read-only preview with no start
   action, and an empty History section.
3. The user reaches a Start or Add control and finds it disabled.
4. The path ends. No route is pushed and no workout is read or written.

## Missing implementation

- A workout-player route and presentation model.
- Draft/session state that survives tab movement and app interruption.
- Workout state and actions for start, set updates, completion, abandonment, and deletion.
- A decision and enforcement mechanism for how many workouts may be in progress.
- A surface that selects a template to start, or picks exercises for a freestyle workout. The
  exercise picker in [create a workout template](create-routine.md) adds exercises to a template
  draft only.
- The completion behavior documented in [finish and log a workout](log-workout.md).

The current `Workout` shape in
[`@hipefit/schemas`](../../packages/schemas/src/workout.ts) already carries template refs/snapshots,
status, local date/time zone, measured active duration, bodyweight snapshot, notes, and nested
exercises/sets. Its decoder and rules are retained contracts, not evidence that the creation journey
or a read path exists.

## State and read behavior

- No workout Zustand store exists. Workout templates have
  [`useWorkoutTemplateStore`](../../apps/mobile/src/stores/use-workout-template-store.ts), which
  publishes non-archived templates and creates new ones; it has no start action.
- Central subscription orchestration in
  [`apps/mobile/src/hooks/use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts)
  starts the user, exercise, and workout template stores. Those stores delegate Firebase operations
  to services.
- [`useExerciseStore`](../../apps/mobile/src/stores/use-exercise-store.ts) exposes the localized,
  visible browse catalogue built by
  [`exercise-catalogue.ts`](../../apps/mobile/src/features/exercises/exercise-catalogue.ts), but no
  workout picker or canonical-fork resolver.
- Workout interfaces, decoders, assertions, and rules remain available for a later implementation.
  No index is retained:
  [`firebase/firestore.indexes.json`](../../firebase/firestore.indexes.json) is empty, as
  [finish and log a workout](log-workout.md) records.

## Empty and error behavior

- No templates: Workouts shows `No workout templates yet`; Home shows
  `No Active Workout Templates` whether or not templates exist. Both footers mention creating a
  template, which the create panel's New Workout Template action does.
- No workouts: history empty states render normally.
- While the template store loads, the whole Workouts list is redacted, so the History section shows
  its placeholder rows too. Home's workout skeleton code remains unreachable, because no workout
  request exists.
- A template listener error is logged, and the store keeps its previous or empty list. On a first
  load it looks the same as an account with no templates. There is no workout listener and therefore no workout listener error
  path.

## Completion state

There is none. Workouts lists saved templates and Home shows an empty presentation, with every
user-facing start control disabled.
