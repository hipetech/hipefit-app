---
type: flow
status: current
area: workouts
updated: 2026-08-04
---

# Flow: start a workout

> **This journey does not ship.** Every entry point into it is present, styled, and deliberately
> rendered `disabled`. There is no workout player screen, no route beyond the four tabs, and no
> code path anywhere in the app that writes a document to `users/{uid}/workouts`. What follows
> documents the affordances that exist today, exactly where the path stops, and what the app does
> instead. It is not a description of a working feature.

## User goal

Begin a training session — either from a saved routine or as an ad-hoc "quick workout" — record
sets against exercises while training, and finish with a workout in history and updated stats.

Only the first half of the first clause is reachable: the user can see routines and press nothing.

## Prerequisites

- **Signed in.** `app/_layout.tsx` wraps `(private)` in `<Stack.Protected guard={isLoggedIn}>`, and
  [`app/index.tsx`](../../app/index.tsx) redirects to `(public)/login` otherwise. See
  [`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts).
- **Firestore subscriptions live.** [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts)
  starts the user, exercise, workout, and routine stores once, keyed on the auth user, from
  [`app/_layout.tsx`](../../app/_layout.tsx). Nothing on this journey fetches on its own.
- **At least one routine**, for the routine-based entry points. This is where the flow already
  fails on a real account: sign-up seeds the user document and their exercise groups
  ([`use-auth-store.ts` `createUserProfile`](../../features/auth/store/use-auth-store.ts)), and
  [`scripts/db/seed-exercises.ts`](../../scripts/db/seed-exercises.ts) seeds the two global
  collections — but **nothing creates routines**, in the app or in the seed scripts. So
  `activeRoutines` is empty for every genuinely new user, and the routine entry points below render
  their empty states rather than their disabled buttons.

## Entry points

Four affordances advertise this journey. All four are inert.

| Entry point                                          | Where                                                                                                                                          | Why it does nothing                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Start Workout** in the global create menu          | [`features/floating-action-button/create-floating-action-button.tsx`](../../features/floating-action-button/create-floating-action-button.tsx) | Carries `mods.disabledOnly` and no `onPress`.                                                              |
| **Start Workout** under Home's Featured Routine      | [`features/home/home-content.tsx`](../../features/home/home-content.tsx)                                                                       | Same — `mods.disabledOnly`, no handler.                                                                    |
| **Start** on a routine card in the Workouts carousel | [`features/workouts/routine-card.tsx`](../../features/workouts/routine-card.tsx)                                                               | `onStart` is optional and `WorkoutsContent` never passes it, so `disabled(onStart == null)` resolves true. |
| **Resume** on the in-progress banner                 | [`features/workouts/active-workout-banner.tsx`](../../features/workouts/active-workout-banner.tsx)                                             | Same shape: `onContinue` is never passed, so the button is disabled.                                       |

Two adjacent affordances belong to the same missing destination and are disabled by the same shared
constant, `mods.primaryActionButtonDisabled` in [`theme/modifiers.ts`](../../theme/modifiers.ts):
**Add to Workout** on an expanded exercise row
([`features/exercises/exercise-row.tsx`](../../features/exercises/exercise-row.tsx)) and the same
button in the exercise detail sheet
([`features/exercises/exercise-detail-sheet.tsx`](../../features/exercises/exercise-detail-sheet.tsx)).
The sheet's `onAdd` prop is wired in [`app/(private)/exercises/index.tsx`](<../../app/(private)/exercises/index.tsx>)
but only closes the sheet; the button is disabled, so it never fires.

The consistent choice across all six is worth stating because it is a convention, not an accident:
**a control with no destination is shown inert rather than hidden**. The comments in
`routine-card.tsx` and `active-workout-banner.tsx` say why — a bordered button with full press
feedback that goes nowhere reads as a broken app. Each one re-enables by passing the handler prop
or dropping `disabled(true)`; none of them needs a layout change.

## Main path today

Numbered because these steps do happen — the journey just terminates at step 2.

1. **The user opens Home or Workouts.** Both routes are thin: they mount one feature island and
   declare a large title. See [`app/(private)/(home)/index.tsx`](<../../app/(private)/(home)/index.tsx>)
   and [`app/(private)/workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>). The tab
   navigator and the floating create button are siblings in
   [`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>), which is why the create menu is
   reachable from every tab.
2. **The user reaches for a start affordance and finds it disabled.** On Workouts, if an
   `in_progress` workout somehow exists in Firestore, an "In Progress" section renders above the
   routine carousel with a disabled Resume button
   ([`features/workouts/workouts-content.tsx`](../../features/workouts/workouts-content.tsx)).
3. — **Does not exist.** There is no workout-player route. `app/(private)/` contains exactly four
   tab folders (`(home)`, `workouts`, `exercises`, `settings`) and one route-based sheet,
   `settings/edit-profile.tsx` (presented as a `formSheet` from
   [`app/(private)/settings/_layout.tsx`](<../../app/(private)/settings/_layout.tsx>)). The app's
   only imperative navigation lives in Settings: one `router.push('/settings/edit-profile')` in
   [`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx) and one
   `router.back()` in
   [`features/settings/edit-profile-form.tsx`](../../features/settings/edit-profile-form.tsx).
   Nothing anywhere navigates toward a workout.

## What is missing

The gap is larger than a screen. Enumerated because the disabled buttons make it look like one
`onPress` away:

- **A player route** under `app/(private)/` — with its own decision about whether it is a pushed
  screen, a full-screen cover, or a modal, since a workout in progress has to survive tab switches.
- **Write actions on the workout store.** [`features/workouts/store/use-workout-store.ts`](../../features/workouts/store/use-workout-store.ts)
  exposes only `subscribe` and `reset`. There is no `start`, `logSet`, `complete`, `abandon`, or
  `delete`. The `delete` gap has a visible consequence already: `workouts-content.tsx` records that
  a trailing destructive swipe on a history row was removed because it played the full commit
  animation and then sprang back.
- **The derived writes that a finished workout implies**, none of which has a writer anywhere:
  `Routine.timesPerformed` / `lastPerformedAt`, the three `UserStats` counters Home animates, and
  the entire `users/{uid}/exerciseHistory` collection. Refs exist for all of them in
  [`database/refs.ts`](../../database/refs.ts) and types in
  [`database/types.ts`](../../database/types.ts); nothing calls them. Confirming this is quick:
  the app's only Firestore writes are the auth bootstrap in
  [`use-auth-store.ts`](../../features/auth/store/use-auth-store.ts) and the two profile mutations
  in [`features/user/store/use-user-store.ts`](../../features/user/store/use-user-store.ts).
- **A routine-creation path**, which everything routine-based here depends on. "New Routine" in the
  create menu is disabled too, and `features/routines/` contains a store and nothing else.
- **A rule for how many workouts may be in progress.** The store takes the _first_ `in_progress`
  document in `startedAt desc` order (`use-workout-store.ts`); nothing enforces uniqueness, and the
  UI assumes it.

## Screens, routes, and data involved

- Routes: `/` (`(home)`), `/workouts`, `/exercises` — all under the tab navigator in
  [`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>). No route is specific to this
  flow.
- Islands: `HomeContent`, `WorkoutsContent`, and the three host-less row components
  (`RoutineCard`, `ActiveWorkoutBanner`, `WorkoutHistoryCard`) that live inside the Workouts
  `List`.
- Documents: `Routine` and `Workout` in [`database/types.ts`](../../database/types.ts), stored at
  `users/{uid}/routines` and `users/{uid}/workouts` (see
  [`database/refs.ts`](../../database/refs.ts) and [`docs/db-structure.md`](../db-structure.md)).
  The `Workout` shape is complete — `status`, `startedAt`/`completedAt`, `duration`, nested
  `exercises[].sets[]`, `totalVolume`, `totalSets`, `totalExercises` — so the schema is ahead of
  the UI, not behind it.

## State and data changes

**None.** This journey performs no writes. Everything below is read state.

- [`features/workouts/store/use-workout-store.ts`](../../features/workouts/store/use-workout-store.ts)
  subscribes to the **entire** workouts collection ordered by `startedAt desc` — no `limit` — and
  derives three slices from one snapshot: `workouts`, `recentWorkouts` (capped by
  `RECENT_WORKOUTS_LIMIT` in [`lib/constants.ts`](../../lib/constants.ts)), and
  `inProgressWorkout`.
- Because a SwiftUI `List` is not virtualized, `WorkoutsContent` pages history in the view layer
  instead — `HISTORY_PAGE_SIZE` rows, plus a "Show N More" button. That paging is local `useState`
  and resets when the screen unmounts.
- [`features/routines/store/use-routine-store.ts`](../../features/routines/store/use-routine-store.ts)
  subscribes to the routines collection unordered and derives `activeRoutines` by filtering out
  `isArchived`. Home features `activeRoutines[0]`, which is therefore whatever Firestore returned
  first — there is no explicit "featured" concept.
- Stores tear down and reset to `isLoading: true` when the auth user goes away, via the effect
  cleanup in [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts).

## Alternative, empty, and error paths

These are the parts of the journey that are genuinely finished, and they are the reason the
unbuilt flow is not visibly broken.

- **Loading.** No spinner and no separate skeleton tree. Both screens render realistic placeholder
  content behind SwiftUI's `redacted('placeholder')` (`mods.listInsetGroupedRedacted` in
  [`theme/modifiers.ts`](../../theme/modifiers.ts)). `PlaceholderHistoryRow` in `workouts-content.tsx`
  mirrors the real row's _trailing figure_ modifier-for-modifier — both reach for
  `mods.bodyLabelMono`, `monospacedDigit()` included — because redaction draws a bar the width of
  the _measured_ text, so a placeholder that resolves a different font redacts to a different
  width. The rest of the placeholder only approximates the real row's shape.
- **No routines.** Workouts shows a muted "No routines yet" row plus a section footer explaining
  what to do; the routine count is omitted from the header rather than shown as `0`. Home shows
  "No Active Routines" and its own footer. Neither uses `ContentUnavailableView` — the reasoning is
  recorded in both files.
- **No history.** "No workouts yet" plus a footer on Workouts; "No Recent Workouts" on Home.
- **In-progress workout present.** The extra "In Progress" section on Workouts, with the disabled
  Resume button. Home does not surface in-progress state separately, but `recentWorkouts` excludes
  it (the store filters `status !== 'in_progress'` before slicing), and a non-completed row in
  Home's Recent list draws an orange `xmark.circle`.
- **Firestore error.** Both stores log with a `[StoreName]` prefix and set `isLoading: false`,
  leaving the previous (usually empty) state in place. **A failed subscription is therefore
  visually identical to an empty account** — the user sees "No routines yet" and is told to create
  one. This is a real gap, not a documented decision.

## Completion state

There is none to describe. The intended terminal state — a `completed` workout in
`users/{uid}/workouts`, incremented `UserStats`, a bumped `Routine.timesPerformed`, and new
`exerciseHistory` entries — is fully typed and entirely unwritten. The only completed-workout
behavior that ships is the _rendering_ of one:
[`features/workouts/workout-history-card.tsx`](../../features/workouts/workout-history-card.tsx)
and the Recent Workouts rows in `home-content.tsx`, formatted through
[`lib/format.ts`](../../lib/format.ts).
