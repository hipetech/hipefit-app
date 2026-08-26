---
type: app
status: current
area: database
updated: 2026-08-21
---

# Firestore database structure

This is the schema of record for the current client. For the same shape as an entity-relationship
diagram, see [`db-diagram.md`](db-diagram.md). Data access, decoding, listener ownership, rules, and
admin scripts are documented in [`app/database.md`](app/database.md).

## Collection hierarchy

The schema has nine collections: four top-level collections and five user subcollections.

```text
exerciseCategories/{slug}                  global reference data
equipment/{slug}                           global reference data
exercises/{slug}                           global reference data

users/{uid}
|-- customExerciseCategories/{id}
|-- customExercises/{id}
|-- workoutTemplates/{id}
|-- workouts/{id}
`-- bodyMeasurements/{id}
```

The three global collections are readable by authenticated clients and have no client write path.
Everything under `users/{uid}` is owner-scoped. The app currently writes only the user document and
new body-measurement documents; custom exercises, custom categories, workout templates, and workouts
have no shipped creation or mutation journey. Workout templates and workouts also have no current
client read path; their schemas are retained for later implementation.

## Shared conventions

### Document identity

Firestore document IDs are not repeated inside document data. Stores carry a read document as
`WithId<T> = { id: string; data: T }` from
[`@hipefit/schemas`](../packages/schemas/src/shared.ts), keeping the ID separate from the persisted
shape. Global IDs are deterministic lowercase slugs. User-subcollection IDs are Firestore IDs; the
current weigh-in writer uses an auto ID.

### Full references

Every persisted pointer uses one `Ref` string rather than a bare ID plus a discriminator:

```text
global:<slug>
custom:<documentId>
```

Global refs match lowercase slug IDs. Custom refs may contain letters, digits, `_`, and `-`, with a
maximum ID length of 64 characters. The prefix selects the global or user-owned collection family;
the containing field determines the entity type. For example, `global:barbell` in `equipment[]`
means `equipment/barbell`, while `global:chest` in `categoryRef` means
`exerciseCategories/chest`.

The current field rules are:

| Field                               | Allowed refs                                                  |
| ----------------------------------- | ------------------------------------------------------------- |
| `UserSettings.hiddenExerciseRefs[]` | global or custom exercise                                     |
| `UserSettings.hiddenCategoryRefs[]` | global or custom exercise category                            |
| `Exercise.categoryRef`              | global category                                               |
| `Exercise.equipment[]`              | global equipment                                              |
| `CustomExercise.categoryRef`        | global or custom category                                     |
| `CustomExercise.forkedFromRef`      | global exercise or `null`                                     |
| `CustomExercise.equipment[]`        | global equipment                                              |
| `TemplateExercise.exerciseRef`      | global or custom exercise                                     |
| `Workout.templateRef`               | custom workout-template ref or `null` at the runtime boundary |
| `WorkoutExercise.exerciseRef`       | global or custom exercise                                     |

Reference syntax is validated, but Firestore does not enforce foreign keys. A syntactically valid
ref may still point at a missing document. Exercise and template/workout snapshots keep displayable
history when that happens.

### Localization

Database localization covers exercise-library content only. App chrome such as picker labels,
buttons, and enum labels is still authored directly in English.

`GlobalLocalizedText` is an embedded `{ en, uk? }` map. The runtime decoder requires `en`; the seed
data supplies both `en` and `uk`. Global text resolves as the selected language and then English.

`UserLocalizedText` allows either locale but requires at least one value. Each custom document has a
`defaultLocale`, and every localized map on that document must contain that key. User text resolves
as the selected language, then `defaultLocale`, then the remaining supported locale. No custom
exercise or category editor ships yet, so these write conventions are represented by types,
decoders, and rules rather than a user journey.

Changing `settings.language` recomputes exercise, category, and equipment view models from the
already-subscribed locale maps. It does not refetch the collections. Never query or sort by a
localized map key: documents without that locale would be omitted by Firestore. Lists resolve and
sort names in memory instead. Catalogue construction and locale fallback live in
[`exercise-catalogue.ts`](../apps/mobile/src/features/exercises/exercise-catalogue.ts) and
[`exercise-localization.ts`](../apps/mobile/src/features/exercises/exercise-localization.ts); the
exercise store delegates that projection instead of owning a second implementation.

### Units and calendar values

Stored weight, distance, duration, height, and template duration use kilograms, meters, seconds,
centimeters, and minutes respectively. `settings.units` is a display preference and never rewrites
stored values. Profile height and weight entry and display convert to inches and pounds when the
preference is `imperial`. Workout volume has no converter because no shipped code computes volume.

Calendar days are strings, not timestamps. `body.birthDate` and `Workout.localDate` use
`YYYY-MM-DD`; `Workout.timeZone` records the IANA zone for the session. Instants such as
`startedAt`, `completedAt`, and `recordedAt` are Firestore timestamps.

## Global collections

### `exerciseCategories/{slug}`

Seeded category vocabulary. Published IDs are stable; retiring a category keeps its document
resolvable while removing it from the current visible category list.

| Field       | Type                  | Meaning                                   |
| ----------- | --------------------- | ----------------------------------------- |
| `name`      | `GlobalLocalizedText` | Localized category name                   |
| `order`     | `number`              | Non-negative global-category order        |
| `icon`      | `string`              | SF Symbol name                            |
| `isRetired` | `boolean`             | Hidden from current selection when `true` |

### `equipment/{slug}`

Seeded equipment vocabulary referenced by both exercise collections.

| Field       | Type                  | Meaning                             |
| ----------- | --------------------- | ----------------------------------- |
| `name`      | `GlobalLocalizedText` | Localized equipment name            |
| `icon`      | `string \| null`      | Optional SF Symbol name             |
| `isRetired` | `boolean`             | Hidden from current equipment lists |

### `exercises/{slug}`

Seeded global exercise library. Difficulty is not stored; the list, detail sheet, and search UI no
longer expose it.

| Field         | Type                  | Meaning                                                  |
| ------------- | --------------------- | -------------------------------------------------------- |
| `categoryRef` | `Ref`                 | Global category ref                                      |
| `name`        | `GlobalLocalizedText` | Localized display name                                   |
| `description` | `GlobalLocalizedText` | Localized instructions                                   |
| `type`        | `ExerciseType`        | `strength`, `cardio`, or `bodyweight`                    |
| `equipment`   | `Ref[]`               | Global equipment refs                                    |
| `imageURL`    | `string \| null`      | Optional remote artwork                                  |
| `isRetired`   | `boolean`             | Keeps old refs resolvable while hiding current selection |

## User document

### `users/{uid}`

The document ID is the Firebase Auth UID. First sign-in creates this one document; no global data is
copied into the user's subtree.

| Field                     | Type             | Meaning                                           |
| ------------------------- | ---------------- | ------------------------------------------------- |
| `firstName` / `lastName`  | `string`         | Apple name components when available              |
| `displayName`             | `string`         | Editable app-facing name                          |
| `email`                   | `string \| null` | Firebase/Apple email                              |
| `photoURL`                | `string \| null` | Optional avatar URI; no upload UI ships           |
| `body`                    | `Body`           | Embedded birth date and height                    |
| `purpose`                 | `string \| null` | Free-text training purpose                        |
| `settings`                | `UserSettings`   | Embedded display and exercise-visibility settings |
| `schemaVersion`           | `number`         | Current profile shape marker; currently `1`       |
| `createdAt` / `updatedAt` | `Timestamp`      | Creation and last profile/settings update         |

#### `Body`

| Field       | Type             | Meaning                          |
| ----------- | ---------------- | -------------------------------- |
| `birthDate` | `string \| null` | Valid `YYYY-MM-DD` calendar date |
| `heightCm`  | `number \| null` | Height in centimeters            |

Current weight is deliberately absent. It is the newest `bodyMeasurements` document by
`recordedAt`, read through a descending `limit(1)` listener, so backdating a measurement cannot
replace a newer value.

#### `UserSettings`

| Field                | Type                      | Default  | Meaning                                         |
| -------------------- | ------------------------- | -------- | ----------------------------------------------- |
| `theme`              | `light \| dark \| system` | `system` | App color scheme                                |
| `language`           | `en \| uk`                | `en`     | Exercise-library content locale                 |
| `units`              | `metric \| imperial`      | `metric` | Display preference; stored data stays canonical |
| `hiddenExerciseRefs` | `Ref[]`                   | `[]`     | Full refs omitted from browse/search/picker     |
| `hiddenCategoryRefs` | `Ref[]`                   | `[]`     | Full refs whose categories and exercises hide   |

There is no stored `stats` map, and the current client does not calculate workout totals or streaks.
No current screen writes either hidden-ref array; the fields and visibility behavior are live in the
exercise store, but hide/unhide controls are not shipped.

## User subcollections

### `users/{uid}/customExerciseCategories/{id}`

| Field                     | Type                | Meaning                                         |
| ------------------------- | ------------------- | ----------------------------------------------- |
| `name`                    | `UserLocalizedText` | Localized user-authored name                    |
| `defaultLocale`           | `Locale`            | Required key in `name`                          |
| `order`                   | `number`            | Order within the custom-category block          |
| `icon`                    | `string \| null`    | Optional SF Symbol name                         |
| `isArchived`              | `boolean`           | Soft deletion while keeping category refs valid |
| `createdAt` / `updatedAt` | `Timestamp`         | Creation and last update                        |

Global categories sort by their `order`, followed by custom categories sorted by their `order`.
Archived categories are absent from the visible category list. Exercise browse rows are filtered by
retirement and user hidden refs, not by the archive flag. These catalogue rules are implemented by
[`exercise-catalogue.ts`](../apps/mobile/src/features/exercises/exercise-catalogue.ts).

### `users/{uid}/customExercises/{id}`

| Field                     | Type                | Meaning                                          |
| ------------------------- | ------------------- | ------------------------------------------------ |
| `categoryRef`             | `Ref`               | Global or custom category                        |
| `forkedFromRef`           | `Ref \| null`       | Global exercise ref when this document is a fork |
| `name`                    | `UserLocalizedText` | User-localized display name                      |
| `description`             | `UserLocalizedText` | User-localized instructions                      |
| `defaultLocale`           | `Locale`            | Required key in both localized maps              |
| `type`                    | `ExerciseType`      | `strength`, `cardio`, or `bodyweight`            |
| `equipment`               | `Ref[]`             | Global equipment refs                            |
| `imageURL`                | `string \| null`    | Optional remote artwork                          |
| `createdAt` / `updatedAt` | `Timestamp`         | Creation and last update                         |

`forkedFromRef` is retained as schema metadata. The current exercise store does not build fork aliases
or resolve workout/template references. Hidden exercise and category refs remove current catalogue
entries; they do not alter stored documents.

### `users/{uid}/workoutTemplates/{id}`

This collection replaces the old routine vocabulary. Its contract remains defined, but the current
app does not request, render, create, or edit its documents.

| Field                     | Type                 | Meaning                         |
| ------------------------- | -------------------- | ------------------------------- |
| `name`                    | `string`             | Template name                   |
| `description`             | `string \| null`     | Optional description            |
| `exercises`               | `TemplateExercise[]` | Ordered embedded exercise array |
| `estimatedDuration`       | `number \| null`     | Estimated minutes               |
| `isArchived`              | `boolean`            | Soft-deletion/archive marker    |
| `lastPerformedAt`         | `Timestamp \| null`  | Cached last-use instant         |
| `timesPerformed`          | `number`             | Cached use count                |
| `createdAt` / `updatedAt` | `Timestamp`          | Creation and last update        |

#### `TemplateExercise` and `TemplateSet`

| Shape              | Fields                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| `TemplateExercise` | `exerciseRef`, `nameSnapshot`, `type`, ordered `sets[]`                   |
| `TemplateSet`      | Optional `weight` (kg), `reps`, `duration` (seconds), `distance` (meters) |

Array position is the exercise and set order; no ordinal field is stored. `nameSnapshot` is a
fallback when the live exercise ref cannot resolve.

### `users/{uid}/workouts/{id}`

| Field                     | Type                | Meaning                                                   |
| ------------------------- | ------------------- | --------------------------------------------------------- |
| `templateRef`             | `Ref \| null`       | Custom workout-template ref; `null` for freestyle         |
| `templateName`            | `string \| null`    | Template-name snapshot                                    |
| `status`                  | `WorkoutStatus`     | `in_progress`, `completed`, or `abandoned`                |
| `startedAt`               | `Timestamp`         | Session start                                             |
| `completedAt`             | `Timestamp \| null` | Required by the decoder for completed sessions            |
| `activeSeconds`           | `number \| null`    | Measured active duration, excluding pauses when available |
| `localDate`               | `string`            | Start day as `YYYY-MM-DD` for streak calculation          |
| `timeZone`                | `string`            | IANA zone in which `localDate` was recorded               |
| `bodyweightKg`            | `number \| null`    | Session snapshot used for bodyweight volume               |
| `notes`                   | `string \| null`    | Workout notes                                             |
| `exercises`               | `WorkoutExercise[]` | Ordered embedded exercise array                           |
| `createdAt` / `updatedAt` | `Timestamp`         | Creation and last update                                  |

#### `WorkoutExercise` and `WorkoutSet`

| Shape             | Fields                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| `WorkoutExercise` | `exerciseRef`, `nameSnapshot`, `type`, ordered `sets[]`                              |
| `WorkoutSet`      | `isCompleted`; optional `weight`, `reps`, `duration`, `distance`, `rpe`, and `notes` |

No totals or ordinal fields are persisted. A future workout read model must decide whether to derive
or persist values such as:

- `totalSets`: completed sets only;
- `totalExercises`: exercises with at least one completed set;
- `totalVolume`: completed strength sets use `weight * reps`; completed bodyweight sets use
  `(bodyweightKg + added weight) * reps`; cardio sets do not contribute volume.

The schema has no persisted totals, streaks, per-exercise history, or personal-record collection. The
current app does not request workouts or calculate any of those projections.

### `users/{uid}/bodyMeasurements/{id}`

| Field        | Type        | Meaning                                                   |
| ------------ | ----------- | --------------------------------------------------------- |
| `recordedAt` | `Timestamp` | Measurement instant; may be older than the latest entry   |
| `weightKg`   | `number`    | Weight in kilograms, greater than `0` and less than `500` |
| `note`       | `string?`   | Optional note; the current UI does not collect one        |

The Edit Profile sheet can append one measurement for the current time. It displays the newest
measurement through `orderBy('recordedAt', 'desc')` plus `limit(1)`. There is no chart, full history
listener, edit action, or delete action in the app.

## Current read and write status

| Collection                 | Current read behavior                         | Current client writes                         |
| -------------------------- | --------------------------------------------- | --------------------------------------------- |
| `users`                    | One profile listener in the user service      | Create/self-heal; profile and settings update |
| `exerciseCategories`       | One listener in the exercise service          | None                                          |
| `equipment`                | One listener in the exercise service          | None                                          |
| `exercises`                | One listener in the exercise service          | None                                          |
| `customExerciseCategories` | One listener in the exercise service          | None                                          |
| `customExercises`          | One listener in the exercise service          | None                                          |
| `workoutTemplates`         | None                                          | None                                          |
| `workouts`                 | None                                          | None                                          |
| `bodyMeasurements`         | One newest-first listener in the user service | Append weigh-in only                          |

The three global collections are seeded by
[`firebase/seed/seed-exercises.ts`](../firebase/seed/seed-exercises.ts). The persisted interfaces,
runtime validators, write assertions, and path strings live in
[`@hipefit/schemas`](../packages/schemas/src/index.ts). React Native Firebase instances and typed ref
builders live in
[`@hipefit/firebase/react-native`](../packages/firebase/src/react-native/index.ts). Mobile stores
delegate Firebase subscriptions and writes to
[`apps/mobile/src/services/`](../apps/mobile/src/services), which imports both packages; features do
not construct Firestore paths inline.
