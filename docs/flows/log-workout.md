---
type: flow
status: current
area: workouts
updated: 2026-08-21
---

# Flow: finish and log a workout

> **This journey does not ship.** The app has no workout player, finish control, workout store, or
> client read/write request for `users/{uid}/workouts`.

## User goal

Finish a training session and see its duration, exercise count, volume, calendar contribution, and
exercise history reflected in the app.

The app currently satisfies neither the recording nor display half. A user cannot start or finish a
session, and stored workout documents are not requested.

## Prerequisites

- The user is signed in. No workout-specific data prerequisite changes current behavior because the
  client does not read the collection.

There is no user `stats` document or map to pre-seed. Home displays zero workout counts and streaks.

## Entry point and stopping point

There is no Resume, Finish, Complete, Discard, or Abandon control and no workout-specific route. The
global Start Workout action is disabled in
[`apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts).

## Read path

No workout read path ships. Central subscription orchestration does not subscribe to workouts, and
there is no workout collection ref or Zustand store. `Workout`, `WorkoutExercise`, and `WorkoutSet`
types plus `decodeWorkout` and its write assertion remain in
[`@hipefit/schemas`](../../packages/schemas/src/workout.ts) as contracts for later work.

No `exerciseHistory` collection, persisted aggregate, stats map, or composite history index is read
or written. [`firebase/firestore.indexes.json`](../../firebase/firestore.indexes.json) is empty.

## What the screens show

Home currently shows zero Workouts, Current Streak, and Longest Streak values plus `No Recent
Workouts`. Workouts shows `No workouts yet`. Neither screen reads a profile stats field or a workout
store.

## Writes that are absent

There is no workout store, mobile workout service, or workout collection ref in
[`@hipefit/firebase/react-native`](../../packages/firebase/src/react-native/index.ts).

Current code therefore performs none of these operations:

- create an `in_progress` workout;
- update status, `completedAt`, `activeSeconds`, notes, or sets;
- snapshot current bodyweight at completion;
- update `WorkoutTemplate.timesPerformed` or `lastPerformedAt`;
- persist totals, streaks, per-exercise history, or personal records;
- edit or delete a historical workout.

A future implementation must choose how to calculate totals, streaks, exercise history, and template
usage. The persisted schemas remain unchanged by the current removal.

## Empty, loading, and error behavior

- No workouts: Workouts shows `No workouts yet`; Home shows `No Recent Workouts`. Both explain that a
  finished workout would appear there, even though finishing is unavailable.
- Workout loading skeleton components remain in source for later integration, but no workout request
  currently reaches them.
- Stored in-progress, completed, or abandoned workouts do not alter either screen.
- There is no workout listener error path.

## Completion state

There is no user-reachable completion state. The app makes no workout request, calculation, or write
and offers no history mutation controls.
