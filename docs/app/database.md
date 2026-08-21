---
type: app
status: current
area: database
updated: 2026-08-21
---

# Data layer

The Firestore schema is documented in [`docs/db-structure.md`](../db-structure.md). This document
describes the application boundary around it: contracts, SDK refs, Firebase operations, runtime
trust, subscription lifetime, store ownership, rules, and admin tooling.

## Boundary

The data boundary is split by portability and responsibility:

| Location                                                                                                             | Owns                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`packages/schemas/src/`](../../packages/schemas/src)                                                                | Persisted interfaces, embedded shapes, runtime decoders, write assertions, `Ref`, `WithId`, and path strings |
| [`packages/domain/src/exercises/`](../../packages/domain/src/exercises)                                              | Framework-free exercise catalogue merge and localization fallback                                            |
| [`packages/firebase/src/react-native/`](../../packages/firebase/src/react-native)                                    | React Native Firebase Auth and Firestore instances plus refs for paths the app accesses                      |
| [`apps/mobile/src/services/`](../../apps/mobile/src/services)                                                        | App-specific queries, snapshot listeners, auth provisioning, and writes                                      |
| [`apps/mobile/src/stores/`](../../apps/mobile/src/stores)                                                            | Published state, loading state, actions, and service callback handling                                       |
| [`apps/mobile/src/hooks/use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts) | Auth-scoped lifetime of the two live data stores                                                             |

There is no app-local `@/database` barrel. Mobile code imports persisted contracts from
`@hipefit/schemas`, framework-free catalogue logic from `@hipefit/domain`, and refs from
`@hipefit/firebase/react-native`.

Stores do not call React Native Firebase operations directly. They delegate reads and writes to
[`auth-service.ts`](../../apps/mobile/src/services/auth-service.ts),
[`user-service.ts`](../../apps/mobile/src/services/user-service.ts), and
[`exercise-service.ts`](../../apps/mobile/src/services/exercise-service.ts). Stores retain ownership
of app state and actions; services own SDK execution; `@hipefit/domain` owns reusable derivation.

## Paths and refs

[`packages/schemas/src/paths.ts`](../../packages/schemas/src/paths.ts) owns portable collection and
document path strings. [`packages/firebase/src/react-native/refs.ts`](../../packages/firebase/src/react-native/refs.ts)
combines those strings with the React Native Firebase Firestore instance from
[`instances.ts`](../../packages/firebase/src/react-native/instances.ts).

The React Native package exports refs with current app callers:

- global collections: `exerciseCategoriesRef()`, `equipmentRef()`, and `exercisesRef()`;
- the user document: `userRef(uid)`;
- user collections: `customExerciseCategoriesRef(uid)`, `customExercisesRef(uid)`, and
  `bodyMeasurementsRef(uid)`.

There are no app refs for workouts or workout templates because the mobile client does not access
those collections. Their persisted contracts remain in `@hipefit/schemas`. Mobile features and
services do not construct Firestore paths inline.

Persisted pointers use the schema's full string `Ref` convention, `global:<slug>` or
`custom:<documentId>`, rather than Firestore `DocumentReference` values. The convention is documented
in [`docs/db-structure.md`](../db-structure.md#full-references).

## Types and runtime trust

TypeScript interfaces do not validate Firestore data. Snapshot data enters JavaScript as unknown and
passes through decoders exported from [`@hipefit/schemas`](../../packages/schemas/src/index.ts) before
a service sends it to a store. The shared validation in
[`validation.ts`](../../packages/schemas/src/validation.ts) checks exact keys, scalar types, enums,
bounds, timestamps, full-ref syntax, localization invariants, nested exercise and set arrays, and
document-specific relationships such as a completed workout requiring `completedAt`.

Malformed documents are logged as `[Database] Dropped malformed ... document` and decode to `null`.
Collection services omit them instead of publishing partially trusted data. A malformed or missing
user snapshot becomes `profile: null`; auth provisioning throws when an existing user profile is
malformed. The exercise catalogue does not substitute default settings while the profile is null. It
clears its computed lists and, after the user listeners finish, shows the empty state instead of using
the wrong locale or hidden exercises. The catalogue also validates global slug IDs and custom
document IDs before creating refs.

`WithId<T> = { id: string; data: T }` is the app's decoded document shape. Firestore keeps the ID
outside `data()`, so services do not inject it into persisted payloads. `MergedExercise`,
`MergedCategory`, and `MergedEquipment` from `@hipefit/domain` are flat computed view models, not
Firestore documents.

The same shared validation exports `assert...Write` functions. Every shipped client write validates
the complete prospective shape before sending it:

- the auth service validates a new or repaired `UserProfile` before replacing validation timestamps
  with server timestamps;
- the user service validates the merged next profile before issuing settings or profile updates;
- the user service validates a `BodyMeasurement` before `addDoc`.

Write assertions also exist for document types without a shipped client writer. A modified client can
bypass application assertions, so Firestore rules remain part of the boundary.

## Subscription lifecycle

[`use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts) is
mounted once from [`apps/mobile/app/_layout.tsx`](../../apps/mobile/app/_layout.tsx), above the
protected route tree. When auth publishes a user, it starts
[`useUserStore`](../../apps/mobile/src/stores/use-user-store.ts) and
[`useExerciseStore`](../../apps/mobile/src/stores/use-exercise-store.ts) with `subscribe(uid)`.
Effect cleanup calls both returned teardowns when the user changes or signs out.

Each teardown removes its service listeners and restores the store's initial loading state. The data
stores do not expose separate `reset()` actions. Auth is separate because it produces the UID. Its
app-lifetime `initialize()` method delegates `onAuthStateChanged` to the auth service and is
idempotent because several routes and components call it.

The two data stores own seven Firestore snapshot listeners through their services:

| Store                                                                    | Service                                                                     | Firestore sources                                                                       | Published state                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`useUserStore`](../../apps/mobile/src/stores/use-user-store.ts)         | [`user-service.ts`](../../apps/mobile/src/services/user-service.ts)         | `users/{uid}` and `bodyMeasurements` ordered by `recordedAt desc`, `limit(1)`           | `profile`, `currentBodyMeasurement`, `currentWeight`           |
| [`useExerciseStore`](../../apps/mobile/src/stores/use-exercise-store.ts) | [`exercise-service.ts`](../../apps/mobile/src/services/exercise-service.ts) | Global exercises, global categories, equipment, custom exercises, and custom categories | Localized visible catalogue and category/equipment view models |

The exercise store also subscribes to the user Zustand store. A language, hidden-ref, or user loading
change reruns its catalogue build without adding a Firestore listener. With a valid profile, it
remains loading until all five exercise listeners have produced a snapshot or failed and the user
store has finished both of its listeners. If the user store finishes without a profile, the catalogue
clears its computed lists and finishes loading without waiting for the exercise listeners.

Listener errors flow from services to store-specific callbacks. The stores log the error and finish
that listener's loading condition while retaining previous or empty data. Most UI cannot distinguish
a permission or network failure from an empty collection. If the initial profile listener fails, the
exercise screen also shows empty data because catalogue settings are unavailable. A later profile
listener error retains the last profile published by the user store.

### Exercise catalogue

[`exercise-service.ts`](../../apps/mobile/src/services/exercise-service.ts) decodes the five Firestore
inputs. [`useExerciseStore`](../../apps/mobile/src/stores/use-exercise-store.ts) keeps those arrays in
its subscription closure and passes them with the current user settings to
[`buildExerciseCatalogue`](../../packages/domain/src/exercises/catalogue.ts).

The domain function:

1. resolves global and custom category names for `settings.language`;
2. orders global categories and custom categories by their own `order` fields;
3. resolves equipment refs to localized labels;
4. combines global and custom exercises;
5. removes retired exercises and exercises hidden directly or through a hidden category;
6. publishes visible categories and non-retired equipment.

Browse and search consume the published `exercises` list. Workout picker views and canonical-ref
resolution are absent until workout behavior is implemented.

### Preserved workout contracts

Workout and workout-template interfaces, decoders, write assertions, rules, indexes, and admin-tool
compatibility remain in the repository. The mobile client has no refs, listeners, stores, or
screen-level requests for either collection.

Home displays zero workout counts and streaks plus empty template and history sections. Workouts
displays empty template and history sections immediately. Documents inserted outside the app are not
requested, decoded, derived, or rendered. There is no persisted history or stats collection, and
[`firebase/firestore.indexes.json`](../../firebase/firestore.indexes.json) is empty.

## Current writes

The shipped client exposes five write operations through two stores and implements them in two
services:

| Store action owner                                               | Service                                                             | Write                                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`useAuthStore`](../../apps/mobile/src/stores/use-auth-store.ts) | [`auth-service.ts`](../../apps/mobile/src/services/auth-service.ts) | Create `users/{uid}` when missing; fill missing Apple name fields; advance an older `schemaVersion` marker |
| [`useUserStore`](../../apps/mobile/src/stores/use-user-store.ts) | [`user-service.ts`](../../apps/mobile/src/services/user-service.ts) | Update `settings.<key>` fields; update profile and body fields; append a body measurement                  |

Profile creation is one `setDoc`, not a batch. No category or exercise data is copied at sign-up.
The auth listener calls `ensureUserProfile` for new sign-ins and restored sessions before the auth
store publishes the user. A missing profile therefore self-heals before domain subscriptions start.
The current schema-version branch only advances the numeric marker because version `1` is the only
live shape. An existing malformed profile is logged and is not repaired automatically.

There is no client write to custom categories, custom exercises, workout templates, or workouts. The
client also does not read workout templates or workouts.

The Edit Profile sheet is the only measurement entry point. Saving updates profile fields first and
then appends a current-time weigh-in when the optional weight field is populated. These are separate
writes, not an atomic batch. The client reads only the newest measurement and has no edit or delete
action.

## Firestore rules

[`firebase/firestore.rules`](../../firebase/firestore.rules) is the current prototype ruleset:

- authenticated users can read the three global collections and cannot write them;
- a user can read, create, update, and delete only their own document and five subcollections;
- user, custom-category, custom-exercise, template, and workout creates and updates validate allowed
  and required top-level keys, scalar bounds, selected enums, and timestamps;
- `createdAt` is server-set and immutable where present, `updatedAt` advances with server time, and
  `Workout.startedAt` is immutable;
- workout status can remain unchanged or move from `in_progress` to `completed` or `abandoned`, but
  cannot move back;
- body measurements require a non-future `recordedAt` and weight greater than `0` and less than
  `500` kg.

The rules do not duplicate the shared validator. Firestore rules cannot iterate embedded
`exercises[]`, `sets[]`, equipment arrays, or hidden-ref arrays. They cap list sizes but cannot
validate each member. They also cannot verify reference existence, snapshot accuracy, a real IANA
time zone, or every calendar-date semantic checked by the decoder.

Some rule and decoder details differ. For example, rules accept any syntactically valid
`templateRef`, while the workout decoder requires a custom ref. Treat `@hipefit/schemas` runtime
validation as the persisted contract and the rules as owner isolation plus reachable top-level
checks.

No rules emulator test harness is installed. The repository verifies TypeScript, lint, and format,
not deployed rules behavior. The checked-in file does not prove which Firebase environment has
received it.

## Admin tooling

Admin operations use Bun and `firebase-admin`, with service-account files outside source control.
They bypass client rules and import `@hipefit/schemas` directly.

[`firebase/seed/index.ts`](../../firebase/seed/index.ts) requires `--seed` and an explicit
`--env development|staging|production`; there is no default environment. The exercise seeder
validates all input before any delete or write: exact `en` and `uk` maps, deterministic slugs, unique
IDs, enums, bounds, and resolvable category and equipment refs. After transforming each input into a
persisted document, it runs the shared write assertion. `--dry-run` performs validation and reports
operations without initializing Firebase.

Normal seeding overwrites deterministic documents in `exerciseCategories`, `equipment`, and
`exercises`. `--clean` recursively deletes those three global collections first. Production writes
require typing `production`; a production clean also requires `--allow-production-clean`.

[`firebase/seed/wipe.ts`](../../firebase/seed/wipe.ts) requires an explicit development or staging
environment and typed confirmation. It refuses production outright. It recursively counts and
deletes Firestore documents, deletes all Auth users, and verifies both counts are zero. It has no
dry-run mode and fails before Firebase initialization when no interactive terminal is attached.

[`firebase/migrations/migrate.ts`](../../firebase/migrations/migrate.ts) runs versioned user-profile
migrations for an explicit environment. A missing `schemaVersion` is version `0`. The runner applies
the migration to raw data, validates the complete result against the current decoder, and replaces
the document in a transaction so removed fields do not survive and concurrent profile changes cause
a retry. It examines every user, reports individual failures, and exits unsuccessfully when any
document cannot migrate. It supports `--dry-run` and requires an interactive typed confirmation for
production writes. The current initial migration is the version `1` baseline in
[`001-initial-data.ts`](../../firebase/migrations/001-initial-data.ts).

[`scripts/firebase/run.ts`](../../scripts/firebase/run.ts) runs the exact `firebase-tools` version
from the workspace lockfile. It permits only `deploy`, requires `--project development` or
`--project staging`, substitutes the fixed non-production project ID, and refuses alternate config
files. It does not expose Firebase commands with independent resource targets or use firebase-tools'
persisted active project.

Once an environment contains data worth preserving, an export and tested restore are prerequisites
for seed cleaning, migration, or wipe. Commands and service-account filenames are maintained in
[`firebase/seed/docs/instructions.md`](../../firebase/seed/docs/instructions.md).
