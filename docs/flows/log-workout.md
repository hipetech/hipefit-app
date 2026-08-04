---
type: flow
status: current
area: workouts
updated: 2026-08-04
---

# Flow: finish and log a workout

> **This journey does not ship.** It is the second half of
> [start a workout](start-workout.md), which already terminates before a session can begin, so
> nothing downstream of it can run either. There is no finish control, no store action that writes a
> workout, and no code path anywhere in the app that creates or mutates a document under
> `users/{uid}/workouts`, `users/{uid}/exerciseHistory`, `Routine.timesPerformed`, or
> `UserProfile.stats`. What ships is the **read** half: if a completed workout appears in Firestore
> by any other means, Home and Workouts render it correctly and immediately. This document describes
> that rendering, and names the exact writes nobody performs.

## User goal

End a training session and have it kept: a workout in history with its date, duration, volume and
exercise count, the routine's "performed" tally moved on, and the Activity figures on Home stepped
up.

None of it is reachable from the app. The user cannot finish a workout because they cannot start
one.

## Prerequisites

- **Signed in**, with Firestore subscriptions live. Both are established once for the whole app —
  [`app/_layout.tsx`](../../app/_layout.tsx) guards `(private)` and calls
  [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts). See
  [start a workout](start-workout.md#prerequisites) for the full set.
- **A workout in progress.** This is the prerequisite that no code satisfies. The store's
  `inProgressWorkout` is derived from Firestore, not created by the app
  ([`features/workouts/store/use-workout-store.ts`](../../features/workouts/store/use-workout-store.ts)),
  and the only seeder registered in [`scripts/db/index.ts`](../../scripts/db/index.ts) is
  [`seed-exercises.ts`](../../scripts/db/seed-exercises.ts), which writes the two global exercise
  collections and nothing user-scoped. An `in_progress` document can therefore only arrive by
  editing Firestore by hand.
- **A user document with a `stats` object**, so the counters this flow is supposed to move have
  something to move. That one _is_ satisfied: sign-up writes all three counters as `0` and
  `lastWorkoutAt` as `null`, in `createUserProfile`
  ([`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts)).

## Entry points

There is exactly one affordance anywhere in the app that points at an in-progress session, and it
is inert:

| Entry point                          | Where                                                                                              | Why it does nothing                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Resume** on the in-progress banner | [`features/workouts/active-workout-banner.tsx`](../../features/workouts/active-workout-banner.tsx) | `onContinue` is optional and nothing passes it, so `disabled(onContinue == null)` resolves true. |

The banner renders only when `inProgressWorkout` is non-null, inside an "In Progress" section that
[`features/workouts/workouts-content.tsx`](../../features/workouts/workouts-content.tsx) places
above the routine carousel. There is no **Finish**, **Complete**, **Discard**, or **Abandon**
control anywhere — not on the banner, not in the global create menu
([`features/floating-action-button/create-floating-action-button.tsx`](../../features/floating-action-button/create-floating-action-button.tsx),
whose three actions are Start Workout / New Routine / Custom Exercise, all disabled), and not in a
toolbar: [`app/(private)/workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>) declares
only a large title.

## Main path today

1. **A workout with `status: 'in_progress'` exists in Firestore.** The subscription in
   `use-workout-store.ts` picks the **first** such document in `startedAt desc` order and exposes it
   as `inProgressWorkout`. Nothing enforces that there is only one.
2. **Workouts shows the "In Progress" section** with the routine name (or `Quick Workout` when
   `routineName` is null), the exercise count, the start date, and the disabled Resume button.
3. — **Does not exist.** There is no player to resume into, no finish action, and no write. The
   journey stops here. Everything below describes what happens _if_ the document's `status` changes
   to `completed` outside the app.

## What is missing

The gap is a whole write path, and it spans four collections. The document-level helpers this flow
would need — `workoutRef`, `routineRef`, `exerciseHistoryRef` and `exerciseHistoryEntryRef` in
[`database/refs.ts`](../../database/refs.ts) — have no callers anywhere in the app:

- **A `complete` (and `abandon`) action on the workout store.**
  [`use-workout-store.ts`](../../features/workouts/store/use-workout-store.ts) exposes only
  `subscribe` and `reset`. Finishing means setting `status`, `completedAt`, `duration`, `notes`, and
  the three roll-ups `totalVolume` / `totalSets` / `totalExercises` on
  `users/{uid}/workouts/{workoutId}` — all typed in
  [`database/types.ts`](../../database/types.ts), none of them ever written.
- **The `UserStats` update.** `totalWorkouts`, `currentStreak`, `longestStreak` and `lastWorkoutAt`
  live on the user document, and
  [`features/user/store/use-user-store.ts`](../../features/user/store/use-user-store.ts) can only
  write two things: `settings.*` via `updateSettings` and `displayName` via `updateProfile`. There
  is no stats mutation and no streak logic anywhere in the repo. `lastWorkoutAt` is written once, as
  `null`, at sign-up and never read.
- **The routine roll-up.** `Routine.timesPerformed` is rendered on every card
  ([`features/workouts/routine-card.tsx`](../../features/workouts/routine-card.tsx)) and
  `lastPerformedAt` is typed but never read or written. Neither has an incrementer.
- **The entire `users/{uid}/exerciseHistory` collection.** `exerciseHistoryRef` and
  `exerciseHistoryEntryRef` exist in [`refs.ts`](../../database/refs.ts) and
  `ExerciseHistoryEntry` / `BestSet` in [`types.ts`](../../database/types.ts), but the collection has
  no store, no subscription, and no writer. Nothing in the app computes a `bestSet`, so there are no
  personal records.
- **Any delete or edit of a logged workout.** `workouts-content.tsx` records why the trailing
  destructive swipe was removed: without a `delete` action the row played the full commit animation
  and sprang back, and hard-vs-soft delete is an open product decision because history feeds the
  stats.

Confirming the whole list is quick — the app's only Firestore writes are the auth bootstrap in
[`use-auth-store.ts`](../../features/auth/store/use-auth-store.ts) and the two profile mutations in
[`use-user-store.ts`](../../features/user/store/use-user-store.ts).

## Screens, routes, and data involved

- **Routes:** `/` (the `(home)` group) and `/workouts`, both tab roots under
  [`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>). Both route files are thin —
  [`(home)/index.tsx`](<../../app/(private)/(home)/index.tsx>) and
  [`workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>) mount one island and declare a
  title. No route is specific to this flow, and none would be: a logged workout has no detail
  screen.
- **Islands:** [`HomeContent`](../../features/home/home-content.tsx) and
  [`WorkoutsContent`](../../features/workouts/workouts-content.tsx), plus the two host-less rows
  that render a workout — [`WorkoutHistoryCard`](../../features/workouts/workout-history-card.tsx)
  and [`ActiveWorkoutBanner`](../../features/workouts/active-workout-banner.tsx).
- **Documents:** `Workout` (with nested `WorkoutExercise` / `WorkoutSet`), `UserStats` inside
  `UserProfile`, `Routine`, and `ExerciseHistoryEntry` — all in
  [`database/types.ts`](../../database/types.ts), paths in
  [`database/refs.ts`](../../database/refs.ts), field-by-field in
  [`docs/db-structure.md`](../db-structure.md). The schema is complete and ahead of the UI; see
  [`docs/app/database.md`](../app/database.md) for the boundary rules around it.

## State and data changes

**None.** This flow performs no writes. What follows is the read path a completed workout travels
once one exists.

- One subscription feeds everything. `use-workout-store.ts` queries the **entire** workouts
  collection ordered by `startedAt desc` — no `limit` — and derives three slices from that single
  snapshot: `workouts` (all of them), `recentWorkouts` (status `!== 'in_progress'`, sliced to
  `RECENT_WORKOUTS_LIMIT` = 5 in [`lib/constants.ts`](../../lib/constants.ts)), and
  `inProgressWorkout`.
- **Workouts** re-filters `workouts` to `status !== 'in_progress'` itself and pages the result in
  the view layer — `HISTORY_PAGE_SIZE` (20) rows plus a "Show N More" button — because a SwiftUI
  `List` is not virtualized. That page count is local `useState` and resets on unmount.
- **Home** reads `recentWorkouts` and maps each to a display row, and reads `profile.stats` from
  [`use-user-store.ts`](../../features/user/store/use-user-store.ts) for the three Activity figures.
  Because both stores are live subscriptions, a workout that lands in Firestore appears on both
  screens with no refresh — which is exactly what the Activity counters are built for: they carry
  `contentTransition('numericText')` + `animation`, so a stats update rolls the digits in place
  rather than hard-cutting. See the comments in
  [`home-content.tsx`](../../features/home/home-content.tsx). (Those comments claim this is the only
  place in the app with that treatment; it is not — the "My Routines" header count in
  [`workouts-content.tsx`](../../features/workouts/workouts-content.tsx) uses the same pair.)
- **Note the asymmetry.** `Routine.timesPerformed` on a routine card gets no such treatment, and the
  comment there says why: it can only move at a moment the user spends leaving the player, not
  watching the card.
- Settings deliberately does not repeat the stats —
  [`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx) carries a
  comment recording that Home owns them and a second copy was already drifting.

## Alternative, empty, and error paths

These are the finished parts, and they are the reason the missing write path is not visibly broken.

- **Empty history.** Workouts renders a muted "No workouts yet" row plus the section footer "Finish
  a workout and it will appear in your history."; Home renders "No Recent Workouts" plus "Finish
  your first workout and it will appear here." Neither uses `ContentUnavailableView` — the reasoning
  is in both files. Since nothing can finish a workout, this is the state every real account is
  permanently in.
- **Loading.** No spinner and no skeleton tree: both screens render realistic placeholder rows
  behind SwiftUI's `redacted('placeholder')` (`mods.listInsetGroupedRedacted` in
  [`theme/modifiers.ts`](../../theme/modifiers.ts)). `PlaceholderHistoryRow` mirrors the real row's
  trailing figure modifier-for-modifier because redaction draws a bar the width of the _measured_
  text.
- **Abandoned workouts still count as history.** Both screens filter only on `!== 'in_progress'`, so
  an `abandoned` workout appears in Workouts history and in Home's Recent list, distinguished only
  by its leading symbol. The two screens use **different glyphs for the same state** — orange
  `exclamationmark.circle.fill` in
  [`workout-history-card.tsx`](../../features/workouts/workout-history-card.tsx) versus orange
  `xmark.circle` in [`home-content.tsx`](../../features/home/home-content.tsx). Nothing in either
  file explains the difference.
- **Missing figures degrade to `--`.** `duration` and `totalVolume` are nullable, and
  [`lib/format.ts`](../../lib/format.ts) returns `'--'` for a null or zero value from both
  `formatDuration` and `formatVolume`. A zero-volume bodyweight workout therefore reads identically
  to one with no volume recorded.
- **Volume is always shown in kilograms.** `formatVolume` hard-codes `kg` and `k kg`, and no caller
  consults `settings.units`. The field is typed `'metric' | 'imperial'` in
  [`types.ts`](../../database/types.ts) and written once as `'metric'` at sign-up
  ([`use-auth-store.ts`](../../features/auth/store/use-auth-store.ts)); nothing reads it and Settings
  exposes no control for it — its only interactive setting is the Theme picker
  ([`settings-content.tsx`](../../features/settings/settings-content.tsx)). This is a gap, not a
  decision — nothing in the code says otherwise.
- **Firestore error.** Both stores log with a `[StoreName]` prefix and set `isLoading: false`,
  leaving the previous (usually empty) state in place. **A failed workouts subscription is therefore
  indistinguishable from an account with no history** — the user sees "No workouts yet" and is told
  to finish one.

## Completion state

There is none. The intended terminal state is fully typed and entirely unwritten:

| Intended write                                                                           | Writer |
| ---------------------------------------------------------------------------------------- | ------ |
| `users/{uid}/workouts/{id}` → `status: 'completed'`, `completedAt`, `duration`, roll-ups | none   |
| `users/{uid}` → `stats.totalWorkouts`, `currentStreak`, `longestStreak`, `lastWorkoutAt` | none   |
| `users/{uid}/routines/{id}` → `timesPerformed`, `lastPerformedAt`                        | none   |
| `users/{uid}/exerciseHistory/{id}` → one entry per exercise, with `bestSet`              | none   |

What does ship is the consequence of that state, and it is worth naming because it is a deliberate
design constraint rather than an accident: **a logged workout is immutable.** Its volume, duration
and exercise count are fixed the moment it lands in history, which is why
[`workout-history-card.tsx`](../../features/workouts/workout-history-card.tsx) gives its trailing
figures `monospacedDigit()` for column alignment but withholds the `numericText` transition that
Home's Activity counters get — there is no in-place change for a transition to animate. The app also
offers no way to edit or delete a logged workout, so nothing contradicts that assumption today. Any
future edit or delete affordance has to reckon with the stats it would invalidate.
