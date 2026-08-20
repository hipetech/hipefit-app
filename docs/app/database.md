---
type: app
status: current
area: database
updated: 2026-08-20
---

# Data layer

The Firestore schema is documented in [`docs/db-structure.md`](../db-structure.md). This document
describes the application boundary around it: path construction, runtime trust, subscription
lifetime, store ownership, rules, and admin tooling.

## Boundary

[`database/`](../../database) is the only application module that defines Firestore paths and
persisted shapes.

| File                                                                                       | Owns                                                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [`database/refs.ts`](../../database/refs.ts)                                               | Currently accessed collection paths and the `users/{uid}` document path |
| [`database/types.ts`](../../database/types.ts)                                             | Document interfaces, embedded shapes, `Ref`, localization, and `WithId` |
| [`database/decoders.ts`](../../database/decoders.ts)                                       | Runtime read decoders and pre-write assertions                          |
| [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts) | Auth-scoped lifetime of the two live domain stores                      |
| [`database/index.ts`](../../database/index.ts)                                             | The `@/database` barrel for refs, types, and decoders                   |

There is no repository or service layer. Feature stores import Firebase operations directly and
pass them refs from `@/database`. The boundary centralizes where data lives and what is trusted;
stores retain ownership of queries, derived state, and writes.

### Path helpers

[`database/refs.ts`](../../database/refs.ts) holds exactly the helpers with current callers:

- global collections: `exerciseCategoriesRef()`, `equipmentRef()`, and `exercisesRef()`;
- the user document: `userRef(uid)`;
- user collections: `customExerciseCategoriesRef(uid)`, `customExercisesRef(uid)`, and
  `bodyMeasurementsRef(uid)`.

There are no workout or workout-template helpers because the current client does not access those
collections. No feature constructs a Firestore path inline, and
[`database/refs.ts`](../../database/refs.ts) owns the app's single `getFirestore()` handle.

Persisted pointers do not use Firestore `DocumentReference` values. They use the schema's full string
`Ref` convention, `global:<slug>` or `custom:<documentId>`, documented in
[`docs/db-structure.md`](../db-structure.md#full-references).

## Types and runtime trust

TypeScript interfaces are not a trust boundary. Firestore data enters JavaScript as unknown values,
so every snapshot passes through a decoder from
[`database/decoders.ts`](../../database/decoders.ts). The decoder validates exact keys, scalar types,
enums, bounds, timestamps, full-ref syntax, localization invariants, nested exercise/set arrays, and
document-specific relationships such as a completed workout requiring `completedAt`.

Malformed documents are logged as `[Database] Dropped malformed ... document` and return `null`.
Collection stores omit those documents instead of rendering a partially trusted shape. A malformed
or missing user document becomes `profile: null`. The exercise store additionally validates global
slug IDs and custom document IDs before creating refs.

`WithId<T> = { id: string; data: T }` remains the in-app document shape. Firestore owns the ID outside
`data()`, so stores keep it separate rather than injecting an `id` field into the persisted payload.
Exercise catalogue entries are the exception: `MergedExercise`, `MergedCategory`, and
`MergedEquipment` are flat computed view models, not Firestore documents.

The same validators expose `assert...Write` functions. Every shipped client write validates the
complete prospective shape before sending it:

- auth validates a new or self-healed `UserProfile` before replacing validation timestamps with
  server timestamps;
- user settings and profile updates validate the merged next profile before issuing dotted-field
  updates;
- a weigh-in validates its `BodyMeasurement` before `addDoc`.

Write assertions also exist for the other document types, but those collections have no shipped
client writers yet. A modified client can bypass all application assertions, which is why Firestore
rules still matter.

## Subscription lifecycle

[`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts) is mounted
once from [`app/_layout.tsx`](../../app/_layout.tsx), above the protected route tree. When auth
publishes a user, it starts two stores with `subscribe(uid)`; effect cleanup calls each returned
teardown when the user changes or signs out.

Every teardown detaches its listeners and clears the store to its initial loading state. The stores
do not expose separate `reset()` actions. Auth is intentionally separate: it owns
`onAuthStateChanged` through its app-lifetime, idempotent `initialize()` method because it produces
the UID that starts the other subscriptions.

The two stores own seven Firestore snapshot listeners:

| Store                                                                      | Firestore sources                                                                                   | Derived state                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`useUserStore`](../../features/user/store/use-user-store.ts)              | `users/{uid}` and `bodyMeasurements` ordered by `recordedAt desc`, `limit(1)`                       | `profile`, `currentBodyMeasurement`, `currentWeight` |
| [`useExerciseStore`](../../features/exercises/store/use-exercise-store.ts) | Five listeners: global exercises, global categories, equipment, custom exercises, custom categories | Localized visible catalogue and category/equipment   |

The exercise store also subscribes to the user Zustand store, not Firestore, so a language or
hidden-ref change reruns its merge immediately. It reports loading until all five Firestore listeners
have either produced a snapshot or failed and the user store has finished both of its listeners.

All collection snapshots are decoded before state publication. Listener errors are logged with a
store-specific prefix and clear that listener's loading condition, leaving the previous or empty
state. The UI therefore cannot currently distinguish a permission/network failure from an empty
collection.

### Exercise merge

The exercise store keeps five raw inputs in its subscription closure and republishes only computed
view models. On every source, language, or hidden-ref change it:

1. resolves global and custom category names for `settings.language`;
2. orders global categories by `order`, then custom categories by `order`;
3. resolves equipment refs to localized labels;
4. concatenates global and custom exercises;
5. removes retired exercises plus exercises hidden directly or through a hidden category;
6. publishes visible categories and non-retired equipment.

Browse and search use the visible `exercises` list. Workout-oriented picker and canonical-ref
resolution views are intentionally absent until the workout behavior is rebuilt.

### Preserved workout contracts

Workout and workout-template document interfaces, decoders, write assertions, rules, indexes, and
seed/wipe compatibility remain in the repository. The current client has no collection refs,
listeners, stores, or screen-level Firestore requests for either collection.

Home therefore displays zero workout counts and streaks plus empty template/history sections.
Workouts displays empty template and history sections immediately. Documents inserted outside the app
are not requested, decoded, derived, or rendered. There is no persisted history or stats collection,
and [`firestore.indexes.json`](../../firestore.indexes.json) remains empty.

## Current writes

The shipped client has five write operations across two stores:

| Owner                                                         | Write                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`useAuthStore`](../../features/auth/store/use-auth-store.ts) | Create one `users/{uid}` document when missing; fill missing Apple name fields; bump an older `schemaVersion` marker |
| [`useUserStore`](../../features/user/store/use-user-store.ts) | Update `settings.<key>` fields; update profile/body fields; append a `bodyMeasurements` document                     |

Profile creation is one `setDoc`, not a batch. No category or exercise data is copied at sign-up.
The auth listener runs `ensureUserProfile` for new sign-ins and restored sessions before it publishes
the authenticated user to the rest of the app. A missing profile therefore self-heals before domain
subscriptions start. The current schema-version branch only advances the numeric marker; there is no
field transform because version `1` is the only live shape. An existing malformed document is logged
and not repaired automatically.

There is no client write to custom categories, custom exercises, workout templates, or workouts. The
client also does not read workout templates or workouts. Their schemas remain available for a later
implementation, but the app cannot create, read, edit, archive, complete, or delete them.

The Edit Profile sheet is the only measurement entry point. Saving it updates profile fields first
and then appends a current-time weigh-in when the optional weight field is populated. These are two
separate writes, not an atomic batch. There is no measurement-history query beyond the newest entry,
and no edit or delete action.

## Firestore rules

[`firestore.rules`](../../firestore.rules) is the current prototype ruleset:

- authenticated users can read the three global collections and cannot write them;
- a user can read, create, update, and delete only their own document and five subcollections;
- user, custom-category, custom-exercise, template, and workout creates/updates validate allowed and
  required top-level keys, scalar bounds, selected enums, and timestamps;
- `createdAt` is server-set and immutable where present, `updatedAt` advances with server time, and
  `Workout.startedAt` is immutable;
- workout status may remain unchanged or move from `in_progress` to `completed`/`abandoned`, but not
  move back;
- body measurements require a non-future `recordedAt` and weight greater than `0` and less than
  `500` kg.

The rules are intentionally not described as complete validation. Firestore rules cannot iterate
embedded `exercises[]` and `sets[]`, equipment arrays, or hidden-ref arrays. They cap list sizes but
cannot validate each member. They also cannot verify reference existence, an exercise snapshot's
accuracy, a real IANA time zone, or every calendar-date semantic that the decoder checks. A modified
client can therefore write malformed nested data into its own subtree; the official client will later
log and drop the malformed document.

There are also prototype-level differences between rules and decoders. For example, rules accept any
syntactically valid `templateRef` while the workout decoder requires a custom ref, and some nullable
or required-field details are stricter in the decoder. Treat the runtime decoder as the official app
contract and the rules as owner isolation plus reachable top-level checks, not as a duplicate schema
engine.

No rules emulator test harness is installed. The repository verifies TypeScript and linting, not the
behavior of deployed Firestore rules, and the checked-in file alone does not prove which environment
has received it.

## Seed and wipe safety

The admin scripts use Bun and `firebase-admin`, with service-account files outside source control.
They bypass client rules.

[`scripts/db/index.ts`](../../scripts/db/index.ts) requires both `--seed` and an explicit
`--env development|staging|production`; there is no production default. The only seeder validates
all data before any delete or write: exact `en`/`uk` maps, deterministic slugs, unique IDs, enums,
bounds, and resolvable category/equipment refs. `--dry-run` performs the complete validation and
prints deletes/writes without initializing Firebase.

Normal seeding overwrites deterministic documents in `exerciseCategories`, `equipment`, and
`exercises`. `--clean` recursively deletes those three global collections first. Production writes
require typing `production`; a production clean also requires `--allow-production-clean`.

[`scripts/db/wipe.ts`](../../scripts/db/wipe.ts) requires an explicit development or staging
environment and requires typing the environment name. `--env production` is refused outright; unlike
the seeder there is no override flag, so wiping production would mean editing the script. It
counts all Firestore documents recursively and all Auth users, recursively deletes every top-level
collection, deletes every Auth user, and then verifies both counts are zero. It deliberately has no
dry-run mode.

Once an environment contains data worth preserving, an export and tested restore are prerequisites
for `--clean` or wipe. Full commands and service-account filenames are maintained in
[`scripts/db/docs/instructions.md`](../../scripts/db/docs/instructions.md).
