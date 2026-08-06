---
type: flow
status: current
area: routines
updated: 2026-08-05
---

# Flow: create a routine

> **This journey does not ship — not even partially.** The only affordance that advertises it is
> the **New Routine** action in the global create panel, and it is `disabled`. There is no routine
> editor route, no exercise-picker, no draft state, and no code path anywhere in the app that
> writes a document to `users/{uid}/routines`. `features/routines/` contains one file: a read-only
> Zustand store. What follows documents the one entry point that exists, the read side that
> consumes routines once they exist, and exactly where the path stops. It is not a description of
> a working feature.

## User goal

Build a reusable workout template — name it, add exercises in order, give each exercise its target
sets — and end up with a routine that appears in the Workouts carousel and can be started in one
tap.

**None of that is reachable.** A user can open the create panel and read the words "New Routine";
they cannot press it. Routines can only enter the app by being written to Firestore by hand or by
a script outside this repository.

## Prerequisites

Listed for completeness — nothing downstream of them ships.

- **Signed in.** [`app/_layout.tsx`](../../app/_layout.tsx) wraps `(private)` in
  `<Stack.Protected>`; see
  [`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts).
- **Firestore subscriptions live.** The routine store is started once, keyed on the auth user, by
  [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts).
- **An exercise catalogue to pick from**, which does exist: `scripts/db/seed-exercises.ts` seeds
  the two global collections and `createUserProfile` in `use-auth-store.ts` copies the exercise
  groups onto the account at sign-up. This is the only prerequisite of the three that a real
  account actually satisfies, and nothing consumes it for routine building.

## Entry points

One, and it is inert.

| Entry point                                | Where                                                                                                              | Why it does nothing                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **New Routine** in the global create panel | [`features/navigation-dock/navigation-dock-actions.ts`](../../features/navigation-dock/navigation-dock-actions.ts) | Ships `enabled: false`; the native control swallows the touch, so `onActionPress` never fires. |

The affordance itself is fully built. **Create** is a tab bar item — a `role="search"` trigger that
iOS 26 draws as a detached circle beside the tab bar — so it is present on every tab. Tapping it
opens a native action panel over a modal scrim; its three actions — **Start Workout**, **New
Routine**, **Custom Exercise** — are declared in
[`features/navigation-dock/navigation-dock-actions.ts`](../../features/navigation-dock/navigation-dock-actions.ts)
and all three are disabled. The mechanics (measured geometry, what closes the panel, why it is UIKit
rather than `@expo/ui`) are in [`docs/app/navigation.md`](../app/navigation.md) and
[`docs/app/ui.md`](../app/ui.md); none of it is specific to this flow.

There is **no second entry point**. The Workouts screen has no `+` toolbar item — it was
deliberately removed when the create actions moved to the tab layer, and
[`app/(private)/workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>) records that in a
comment. There is no "Create routine" button in either empty state, and no long-press or swipe
affordance on a routine card
([`features/workouts/routine-card.tsx`](../../features/workouts/routine-card.tsx)) for duplicating
or editing one — the card's only control is a **Start** button, itself disabled because
`workouts-content.tsx` renders the card without an `onStart` handler.

Two empty-state footers do tell the user to create a routine, and neither points anywhere real:
Workouts says "Create a routine and it will show up here, ready to start in one tap"
([`features/workouts/workouts-content.tsx`](../../features/workouts/workouts-content.tsx)) and
Home says "Create a routine in the Workouts tab and it will be featured here"
([`features/home/home-content.tsx`](../../features/home/home-content.tsx)). Home's copy is doubly
wrong: it names the Workouts tab, which is where the `+` used to be and no longer is.

## Main path today

1. **The user opens any tab and taps the `+` beside the tab bar.** The action panel animates in
   above the bar, over a scrim that blocks the rest of the screen including the tab bar.
   [`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>) declares the Create trigger and
   mounts `NavigationDock`
   ([`features/navigation-dock/navigation-dock.tsx`](../../features/navigation-dock/navigation-dock.tsx))
   beside the tab navigator.
2. — **Stops here.** **New Routine** is greyed out and does not respond. There is no route to push,
   no sheet to present, and no handler to call. `app/(private)/` contains four tab folders
   (`(home)`, `workouts`, `exercises`, `settings`) and exactly one route-based sheet,
   [`app/(private)/settings/edit-profile.tsx`](<../../app/(private)/settings/edit-profile.tsx>).
   Nothing under `app/` mentions routines.

## What is missing

Every piece. Enumerated because a disabled action reads as one `onPress` away, and this is
closer to a feature than a wiring job:

- **A routine editor route** under `app/(private)/`, plus a decision about its presentation — a
  pushed screen, a `formSheet`, or a full-screen cover. The only route-level precedent in the repo
  is the `formSheet` declared for `edit-profile` in
  [`app/(private)/settings/_layout.tsx`](<../../app/(private)/settings/_layout.tsx>).
- **Any component in `features/routines/`.** The directory holds `store/use-routine-store.ts` and
  nothing else — no editor island, no exercise-picker, no set-target row.
- **An exercise-selection surface.** The Exercises tab is a browse-and-inspect screen only:
  [`app/(private)/exercises/index.tsx`](<../../app/(private)/exercises/index.tsx>) keeps search,
  a difficulty filter, one expandable row and a detail sheet. There is no multi-select, no
  selection state, and no "done" affordance. The two **Add to Workout** buttons — on the expanded
  row ([`features/exercises/exercise-row.tsx`](../../features/exercises/exercise-row.tsx)) and in
  the sheet ([`features/exercises/exercise-detail-sheet.tsx`](../../features/exercises/exercise-detail-sheet.tsx))
  — share `mods.primaryActionButtonDisabled` and target a workout, not a routine; the sheet's
  `onAdd` prop is wired but only dismisses the sheet, and the button is disabled so it never fires.
- **Write actions on the routine store.**
  [`features/routines/store/use-routine-store.ts`](../../features/routines/store/use-routine-store.ts)
  exposes `subscribe` and `reset` and nothing more. There is no `create`, `update`, `archive`, or
  `delete`, and no draft slice.
- **Any Firestore write at all against `users/{uid}/routines`.** `routinesRef` and `routineRef`
  exist in [`database/refs.ts`](../../database/refs.ts) and the `Routine`, `RoutineExercise`, and
  `RoutineSet` types are complete in [`database/types.ts`](../../database/types.ts), but the app's
  entire write surface is two stores: the sign-up batch and the Apple-name update in
  [`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts), and the
  two profile mutations in
  [`features/user/store/use-user-store.ts`](../../features/user/store/use-user-store.ts). None of
  them touches routines.
- **A creator for the fields the read side already renders.** `timesPerformed` is displayed
  ("Performed N times" in `routine-card.tsx`) and is only meaningful once a workout can be
  completed against a routine — a separate missing flow, see
  [`docs/flows/start-workout.md`](start-workout.md). `lastPerformedAt` is typed and documented but
  read by nothing in the app. `estimatedDuration` is nullable (`number | null`) and both consumers
  branch on its absence, so a creation path could legitimately leave it null.
- **A seed path.** [`scripts/db/index.ts`](../../scripts/db/index.ts) registers exactly one seeder,
  `exercises`, and it writes only the two global collections
  ([`scripts/db/seed-exercises.ts`](../../scripts/db/seed-exercises.ts)) — so even a developer
  cannot get a routine onto an account with `bun run db:seed`.

## Screens, routes, and data involved

- **Routes:** none specific to this flow, though
  [`app/(private)/create.tsx`](<../../app/(private)/create.tsx>) exists as the route the Create tab
  item must name; it is never displayed and redirects to Home. The panel is mounted by
  [`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>) and is therefore reachable from
  `/`, `/workouts`, `/exercises` and `/settings` equally.
- **Islands:** `NavigationDock` (the entry point) plus the two read consumers,
  [`features/workouts/workouts-content.tsx`](../../features/workouts/workouts-content.tsx) and
  [`features/home/home-content.tsx`](../../features/home/home-content.tsx), with
  [`features/workouts/routine-card.tsx`](../../features/workouts/routine-card.tsx) as the card
  inside the Workouts carousel.
- **Documents:** `Routine`, `RoutineExercise`, and `RoutineSet` in
  [`database/types.ts`](../../database/types.ts), stored at `users/{uid}/routines/{routineId}` —
  refs in [`database/refs.ts`](../../database/refs.ts), field-by-field schema in
  [`docs/db-structure.md`](../db-structure.md). The schema is ahead of the UI, not behind it:
  `RoutineSet` already carries `targetWeight` / `targetReps` / `targetDuration` /
  `targetDistance`, and `isArchived` is a soft-delete flag nothing sets.

## State and data changes

**None.** This journey performs no writes and holds no draft state — there is no reducer, no
`useState` form, and no store slice for a routine under construction.

The read state that exists around it:

- [`features/routines/store/use-routine-store.ts`](../../features/routines/store/use-routine-store.ts)
  subscribes to the whole routines collection **unordered and unlimited**, and derives
  `activeRoutines` from one snapshot by filtering out `isArchived`. Document order is whatever
  Firestore returns, which is why Home's "Featured Routine" is simply `activeRoutines[0]` — there
  is no featured concept in the data.
- The subscription's cleanup resets `routines`, `activeRoutines`, and `isLoading: true`, and
  [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts) tears
  it down when the auth user goes away.

## Alternative, empty, and error paths

Only the empty and error paths of the _read_ side ship; there is no create path to have
alternatives.

- **Loading.** Both consumers render realistic placeholder content behind SwiftUI's
  `redacted('placeholder')` rather than a spinner — `PlaceholderRoutineCard` in
  [`features/workouts/workouts-content.tsx`](../../features/workouts/workouts-content.tsx) and
  `PLACEHOLDER_ROUTINE` in [`features/home/home-content.tsx`](../../features/home/home-content.tsx).
- **No routines** — the state every genuinely new account is in, permanently. Workouts shows a
  muted "No routines yet" row and the section footer quoted above, and omits the count from the
  header rather than rendering `0`. Home shows "No Active Routines" with its own footer. Neither
  uses `ContentUnavailableView`; the reasoning is recorded in both files.
- **Firestore error.** The store logs with a `[RoutineStore]` prefix and sets `isLoading: false`,
  leaving the previous (usually empty) state in place. **A failed subscription is therefore
  visually identical to an account with no routines** — the user is shown the same "create one"
  footer either way. This is a gap, not a documented decision.

## Completion state

There is none. The intended terminal state — a document at `users/{uid}/routines/{routineId}` with
an ordered `exercises[]`, each carrying its `sets[]` targets, `isArchived: false`,
`timesPerformed: 0`, and `createdAt` / `updatedAt` — is fully typed in
[`database/types.ts`](../../database/types.ts), documented in
[`docs/db-structure.md`](../db-structure.md), and written by nothing. The only routine behavior
that ships is the _rendering_ of a routine that arrived some other way.
