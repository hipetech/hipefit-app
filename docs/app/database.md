---
type: app
status: current
area: database
updated: 2026-08-04
---

# Data layer

The Firestore schema itself — collections, document fields, relationships — lives in
[`docs/db-structure.md`](../db-structure.md). This document describes the boundary the app draws
around that schema: who is allowed to construct a path, what shape a document takes once it is in
JavaScript, when listeners attach and detach, and which store owns which collection.

## The boundary

`database/` is the only module that knows Firestore's shape. It has three parts and a barrel:

| File                                                                                       | Owns                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [`database/refs.ts`](../../database/refs.ts)                                               | Every collection and document path                     |
| [`database/types.ts`](../../database/types.ts)                                             | Every document type, plus `WithId<T>` and `Timestamp`  |
| [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts) | The lifetime of every listener, tied to auth state     |
| [`database/index.ts`](../../database/index.ts)                                             | Barrel — re-exports `refs` and `types` as `@/database` |

The barrel deliberately does not re-export the subscriptions hook: it is a React hook with a single
call site, not a piece of the data vocabulary, so [`app/_layout.tsx`](../../app/_layout.tsx) imports
it by its full path.

There is no repository, service, or API layer between the stores and Firebase. Feature stores import
`onSnapshot`, `query`, `orderBy` and `updateDoc` from `@react-native-firebase/firestore` directly and
pass them a ref from `@/database`. That is the whole design: the boundary owns _where_ data lives and
_what shape_ it has, not _how_ it is read. Adding a wrapper around `onSnapshot` would buy nothing
that the ref helpers and the store's own subscribe function do not already provide.

Only two Firebase products are imported by app code: `auth` and `firestore`. The
`@react-native-firebase/analytics`, `crashlytics` and `ai` packages are installed dependencies with
no call sites anywhere in `app/`, `features/`, `lib/`, `hooks/` or `database/`.

## `refs.ts` builds every path, and nothing else does

The rule is: never write a Firestore path inline. If you need a ref, add a helper to
[`database/refs.ts`](../../database/refs.ts) or use the one that is there.

The helpers come in pairs — a plural helper for the collection and a singular helper for one
document — and split into two families. The global family (`exercises`, `exerciseGroups`) takes no
arguments because it is shared, read-only reference data. The user family takes `uid` as its first
argument, always, so it is not possible to produce a user-scoped ref without having said whose it is.
The module also holds the single `getFirestore()` handle at module scope; nothing else in the app
needs one.

Two things worth knowing before you read the file and draw conclusions from it:

- **There is one live violation.** [`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts)
  calls `getFirestore()` a second time and hand-builds `doc(db, 'users', uid, 'exerciseGroups', id)`
  inside the sign-up batch, assigning it to a local `const userGroupRef` that shadows the exported
  helper of the same name. It should call `userGroupRef(uid, groupDoc.id)`. Do not treat it as
  precedent.
- **About half the singular helpers have no call sites.** `exerciseRef`, `globalGroupRef`,
  `userOverrideRef`, `customExerciseRef`, `routineRef`, `workoutRef`, `exerciseHistoryRef` and
  `exerciseHistoryEntryRef` are unused today. They exist ahead of the write paths that would use them
  (see [What the app actually writes](#what-the-app-actually-writes)), not because something reads
  through them.

## `types.ts` and the `WithId<T>` shape

[`database/types.ts`](../../database/types.ts) mirrors the schema one interface per document, plus
the embedded shapes (`UserSettings`, `UserStats`, `RoutineSet`, `WorkoutSet`, `BestSet`, …) and the
three shared unions (`ExerciseType`, `Difficulty`, `WorkoutStatus`). It also re-exports `Timestamp`,
which is the only sanctioned way to name a Firestore timestamp in app code —
[`lib/format.ts`](../../lib/format.ts) takes it from `@/database` rather than from the Firebase
package.

`WithId<T> = { id: string; data: T }` is the shape every document takes once it is in the app.
Firestore keeps a document's id outside its fields, and `snapshot.data()` drops it. The alternative —
spreading the id into the payload — would make the in-app type permanently diverge from the stored
document and would collide the day a schema grows its own `id` field. Carrying the pair keeps `data`
exactly equal to what is in Firestore. Every list-shaped store state is therefore `WithId<T>[]`, and
components destructure `{ id, data }`.

The deliberate exception is [`features/exercises/store/use-exercise-store.ts`](../../features/exercises/store/use-exercise-store.ts),
whose `MergedExercise` and `MergedGroup` are flat objects with an `id` field. They are computed view
models assembled from four documents, not documents themselves, so there is no stored shape for
`data` to be faithful to.

Types are **asserted, not validated**: snapshot handlers do `d.data() as Workout`. Nothing checks a
document against `types.ts` at runtime, so a document that has drifted from the schema fails at the
point it is rendered, not at the point it is read.

## Subscription lifecycle

[`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts) is called
once, from [`app/_layout.tsx`](../../app/_layout.tsx), _above_ the auth gate. That placement is the
point: listeners attach the moment a user exists, not when some protected screen mounts, so the first
private screen renders against data that is already arriving.

The hook is a single effect keyed on the auth store's `user`. When a user appears it calls
`subscribe(uid)` on the four data stores and keeps the returned unsubscribe functions; when the user
changes or disappears it calls all four. Each store's `subscribe` returns a closure that detaches its
own listeners _and_ resets that store's state to empty with `isLoading: true`, so signing out or
switching accounts cannot leave the previous user's data visible.

Two consequences follow, and both are easy to get wrong:

- **`reset()` has no call sites.** Every data store exposes one, and nothing in the app calls it.
  Teardown is done entirely by the closure returned from `subscribe`. Adding cleanup logic to
  `reset()` will not run it.
- **The auth store is not one of these stores.** [`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts)
  owns `onAuthStateChanged` itself through `initialize()`, which is app-lifetime and idempotent (four
  components call it; the guard and the leak it fixed are documented in the file). It has no
  `subscribe` and no `reset`. Where `AGENTS.md` says every store exposes `subscribe(uid)` and
  `reset()`, it means the four data stores.

Each data store starts `isLoading: true` and clears it in its snapshot handler. Error callbacks log
with a `[StoreName]` prefix. One store diverges: the exercise store's four error callbacks log
(`[ExerciseStore:global]`, `:overrides`, `:custom`, `:groups`) but do **not** clear `isLoading`, so a
listener that fails leaves the exercises screen in its loading state indefinitely.

## Collection ownership

| Store                                                                      | Firestore source                                                                                                                 | Derived state                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`useUserStore`](../../features/user/store/use-user-store.ts)              | `users/{uid}` (document listener)                                                                                                | `profile`. Also the app's only writer of profile fields. |
| [`useExerciseStore`](../../features/exercises/store/use-exercise-store.ts) | Four listeners: global `exercises`, `users/{uid}/exerciseOverrides`, `users/{uid}/customExercises`, `users/{uid}/exerciseGroups` | `exercises: MergedExercise[]`, `groups: MergedGroup[]`   |
| [`useWorkoutStore`](../../features/workouts/store/use-workout-store.ts)    | `users/{uid}/workouts`, ordered by `startedAt` desc                                                                              | `workouts`, `recentWorkouts`, `inProgressWorkout`        |
| [`useRoutineStore`](../../features/routines/store/use-routine-store.ts)    | `users/{uid}/routines`                                                                                                           | `routines`, `activeRoutines`                             |

Notes that matter when reading or extending these:

- **The exercise merge is four listeners, and the global `exerciseGroups` collection is not one of
  them.** The store resolves a group through the user's own copy, which is seeded from the global
  collection at sign-up; the global collection is read exactly once, with `getDocs`, in that seeding
  batch. Because four independent listeners feed one derived list, the store keeps its raw inputs in
  a closure, recomputes the merged arrays after every snapshot, and holds `isLoading` true until all
  four have fired at least once (tracked in a `firedListeners` set). The merge itself — overrides
  patching a global exercise, hidden exercises dropping out, custom exercises appended, sort by group
  order then name — is in `buildMerged`.
- **`recentWorkouts` is not just a slice.** It excludes anything `in_progress` before taking
  `RECENT_WORKOUTS_LIMIT` (5, in [`lib/constants.ts`](../../lib/constants.ts)); the in-progress
  workout is surfaced separately as `inProgressWorkout`, which is what
  [`features/workouts/active-workout-banner.tsx`](../../features/workouts/active-workout-banner.tsx)
  renders.
- **Routines are unordered.** The routines listener has no `orderBy`, so display order is whatever
  Firestore returns. `activeRoutines` is `routines` minus `isArchived`.
- **Nothing owns `users/{uid}/exerciseHistory`.** It is defined in the schema and typed as
  `ExerciseHistoryEntry`, and no store subscribes to it and nothing writes it.

## What the app actually writes

The shipped app performs exactly three kinds of write, all of them against the user document:

1. Sign-up — a batch in [`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts)
   that creates `users/{uid}` with default settings and zeroed stats, and copies the global exercise
   groups into the user's subcollection with `isDefault: true`.
2. `updateSettings` — a partial `UserSettings` patch, converted to `settings.<key>` dot-notation so
   Firestore merges fields instead of replacing the object.
3. `updateProfile` — `displayName` only.

Nothing in the app creates or mutates a routine, a workout, a custom exercise, an exercise override,
or a history entry. The three actions in the global create menu are `disabled` in
[`features/floating-action-button/create-floating-action-button.tsx`](../../features/floating-action-button/create-floating-action-button.tsx)
until they have a destination. Every read path in the table above is real and shipped; the
corresponding write paths are not. Any document that describes creating a routine or logging a
workout is describing intended work, not current behavior.

## Seeding the global collections

The global `exercises` and `exerciseGroups` collections are populated out-of-band by
[`scripts/db/`](../../scripts/db/index.ts) — `bun run db:seed --seed exercises`, with `--dry-run`,
`--clean` and `--env <development|staging|production>`. It runs on Node with `firebase-admin` and a
per-environment service-account file kept outside the repository, which is why it carries its own
[`scripts/db/types.ts`](../../scripts/db/types.ts) rather than importing `database/types.ts`: it is
not React Native code and does not share the client SDK's types. Groups are written at fixed document
ids (so `groupKey` on an exercise stays a stable reference) and exercises at generated ids. Full
usage is in [`scripts/db/docs/instructions.md`](../../scripts/db/docs/instructions.md).
