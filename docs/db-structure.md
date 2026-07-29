# Firestore Database Structure

## Overview

The database is split into **global collections** (read-only, shared across all users) and **user subcollections** (per-user data under `users/{uid}`).

All documents use the `WithId<T>` pattern: `{ id: string; data: T }` when consumed in the app.

---

## Global Collections (read-only)

### `exerciseGroups/{groupId}`

Default exercise categories seeded via `scripts/db/seed-exercises.ts`. Copied into each user's subcollection on sign-up.

| Field   | Type             | Description              |
| ------- | ---------------- | ------------------------ |
| `name`  | `string`         | Group display name       |
| `order` | `number`         | Sort order               |
| `icon`  | `string \| null` | Optional icon identifier |

**Default groups:** Chest, Back, Shoulders, Arms, Legs, Core, Cardio, Full Body

### `exercises/{exerciseId}`

Global exercise library. Referenced by `groupKey` which matches an `exerciseGroups` doc ID.

| Field         | Type             | Description                                     |
| ------------- | ---------------- | ----------------------------------------------- |
| `name`        | `string`         | Exercise name                                   |
| `description` | `string`         | How to perform the exercise                     |
| `type`        | `ExerciseType`   | `'strength' \| 'cardio' \| 'bodyweight'`        |
| `groupKey`    | `string`         | References `exerciseGroups/{groupKey}`          |
| `equipment`   | `string[]`       | Required equipment (e.g. `['barbell','bench']`) |
| `difficulty`  | `Difficulty`     | `'beginner' \| 'intermediate' \| 'advanced'`    |
| `imageURL`    | `string \| null` | Optional exercise image                         |
| `createdAt`   | `Timestamp`      | Creation timestamp                              |

---

## User Document

### `users/{uid}`

Created on first Apple Sign-In via `ensureUserProfile()`. Contains profile info, settings, and aggregated stats.

| Field         | Type             | Description              |
| ------------- | ---------------- | ------------------------ |
| `firstName`   | `string`         | From Apple Sign-In       |
| `lastName`    | `string`         | From Apple Sign-In       |
| `displayName` | `string`         | Combined first + last    |
| `email`       | `string \| null` | User email               |
| `photoURL`    | `string \| null` | Profile photo URL        |
| `settings`    | `UserSettings`   | App preferences (below)  |
| `stats`       | `UserStats`      | Aggregated workout stats |
| `createdAt`   | `Timestamp`      | Account creation time    |
| `updatedAt`   | `Timestamp`      | Last profile update      |

#### `settings` (embedded object)

| Field                     | Type      | Default    |
| ------------------------- | --------- | ---------- |
| `units`                   | `string`  | `'metric'` |
| `theme`                   | `string`  | `'system'` |
| `language`                | `string`  | `'en'`     |
| `notificationsEnabled`    | `boolean` | `true`     |
| `workoutRemindersEnabled` | `boolean` | `false`    |
| `autoPauseEnabled`        | `boolean` | `true`     |

#### `stats` (embedded object)

| Field           | Type                | Default |
| --------------- | ------------------- | ------- |
| `totalWorkouts` | `number`            | `0`     |
| `currentStreak` | `number`            | `0`     |
| `longestStreak` | `number`            | `0`     |
| `lastWorkoutAt` | `Timestamp \| null` | `null`  |

---

## User Subcollections

### `users/{uid}/exerciseGroups/{groupId}`

User's exercise groups. Seeded from global `exerciseGroups` on sign-up, fully editable by user. Users can also create custom groups.

| Field           | Type             | Description                                   |
| --------------- | ---------------- | --------------------------------------------- |
| `name`          | `string`         | Group display name                            |
| `order`         | `number`         | Sort order                                    |
| `icon`          | `string \| null` | Optional icon identifier                      |
| `isDefault`     | `boolean`        | `true` if seeded from global defaults         |
| `globalGroupId` | `string \| null` | Reference to original `exerciseGroups` doc ID |
| `createdAt`     | `Timestamp`      | Creation timestamp                            |
| `updatedAt`     | `Timestamp`      | Last update timestamp                         |

### `users/{uid}/exerciseOverrides/{exerciseId}`

Sparse overrides on global exercises. Document ID matches the global `exercises/{exerciseId}`. Only non-null fields override the global values.

| Field         | Type             | Description                           |
| ------------- | ---------------- | ------------------------------------- |
| `name`        | `string \| null` | Custom name (overrides global)        |
| `description` | `string \| null` | Custom description (overrides global) |
| `groupId`     | `string \| null` | Reassign to different user group      |
| `isHidden`    | `boolean`        | Hide exercise from user's library     |
| `updatedAt`   | `Timestamp`      | Last update timestamp                 |

### `users/{uid}/customExercises/{exerciseId}`

User-created exercises (not in the global library).

| Field         | Type             | Description                                  |
| ------------- | ---------------- | -------------------------------------------- |
| `name`        | `string`         | Exercise name                                |
| `description` | `string`         | How to perform the exercise                  |
| `type`        | `ExerciseType`   | `'strength' \| 'cardio' \| 'bodyweight'`     |
| `groupId`     | `string`         | References user's `exerciseGroups/{groupId}` |
| `equipment`   | `string[]`       | Required equipment                           |
| `difficulty`  | `Difficulty`     | `'beginner' \| 'intermediate' \| 'advanced'` |
| `imageURL`    | `string \| null` | Optional exercise image                      |
| `createdAt`   | `Timestamp`      | Creation timestamp                           |
| `updatedAt`   | `Timestamp`      | Last update timestamp                        |

### `users/{uid}/routines/{routineId}`

Workout templates that can be reused.

| Field               | Type                | Description                       |
| ------------------- | ------------------- | --------------------------------- |
| `name`              | `string`            | Routine name                      |
| `description`       | `string \| null`    | Optional description              |
| `exercises`         | `RoutineExercise[]` | Ordered list of exercises (below) |
| `estimatedDuration` | `number \| null`    | Estimated minutes                 |
| `isArchived`        | `boolean`           | Soft-delete flag                  |
| `lastPerformedAt`   | `Timestamp \| null` | Last time this routine was used   |
| `timesPerformed`    | `number`            | Usage counter                     |
| `createdAt`         | `Timestamp`         | Creation timestamp                |
| `updatedAt`         | `Timestamp`         | Last update timestamp             |

#### `exercises[]` items (`RoutineExercise`)

| Field          | Type           | Description                                             |
| -------------- | -------------- | ------------------------------------------------------- |
| `exerciseId`   | `string`       | Global or custom exercise ID                            |
| `exerciseName` | `string`       | Denormalized name for quick display                     |
| `exerciseType` | `ExerciseType` | Denormalized type                                       |
| `isCustom`     | `boolean`      | `true` if from `customExercises`                        |
| `order`        | `number`       | Position in the routine                                 |
| `sets`         | `RoutineSet[]` | Target sets with optional weight/reps/duration/distance |

### `users/{uid}/workouts/{workoutId}`

Recorded workout sessions.

| Field            | Type                | Description                                   |
| ---------------- | ------------------- | --------------------------------------------- |
| `routineId`      | `string \| null`    | Source routine (null if freestyle)            |
| `routineName`    | `string \| null`    | Denormalized routine name                     |
| `status`         | `WorkoutStatus`     | `'in_progress' \| 'completed' \| 'abandoned'` |
| `startedAt`      | `Timestamp`         | When the workout began                        |
| `completedAt`    | `Timestamp \| null` | When the workout ended                        |
| `duration`       | `number \| null`    | Total duration in seconds                     |
| `notes`          | `string \| null`    | User notes                                    |
| `exercises`      | `WorkoutExercise[]` | Performed exercises (below)                   |
| `totalVolume`    | `number \| null`    | Sum of weight x reps across all sets          |
| `totalSets`      | `number`            | Total completed sets                          |
| `totalExercises` | `number`            | Number of exercises performed                 |
| `createdAt`      | `Timestamp`         | Creation timestamp                            |
| `updatedAt`      | `Timestamp`         | Last update timestamp                         |

#### `exercises[]` items (`WorkoutExercise`)

| Field          | Type           | Description                      |
| -------------- | -------------- | -------------------------------- |
| `exerciseId`   | `string`       | Global or custom exercise ID     |
| `exerciseName` | `string`       | Denormalized name                |
| `exerciseType` | `ExerciseType` | Denormalized type                |
| `isCustom`     | `boolean`      | `true` if from `customExercises` |
| `order`        | `number`       | Position in the workout          |
| `sets`         | `WorkoutSet[]` | Actual performed sets (below)    |

#### `sets[]` items (`WorkoutSet`)

| Field         | Type      | Description                  |
| ------------- | --------- | ---------------------------- |
| `setNumber`   | `number`  | Set index (1-based)          |
| `isCompleted` | `boolean` | Whether the set was finished |
| `weight`      | `number?` | Weight lifted                |
| `reps`        | `number?` | Repetitions performed        |
| `duration`    | `number?` | Duration in seconds (cardio) |
| `distance`    | `number?` | Distance (cardio)            |
| `rpe`         | `number?` | Rate of perceived exertion   |
| `notes`       | `string?` | Per-set notes                |

### `users/{uid}/exerciseHistory/{entryId}`

Flattened per-exercise log entries for history and personal records.

| Field          | Type             | Description                       |
| -------------- | ---------------- | --------------------------------- |
| `exerciseId`   | `string`         | Global or custom exercise ID      |
| `isCustom`     | `boolean`        | `true` if from `customExercises`  |
| `exerciseName` | `string`         | Denormalized name                 |
| `exerciseType` | `ExerciseType`   | Denormalized type                 |
| `workoutId`    | `string`         | References `workouts/{workoutId}` |
| `performedAt`  | `Timestamp`      | When the exercise was performed   |
| `sets`         | `WorkoutSet[]`   | All sets for this exercise        |
| `bestSet`      | `BestSet`        | Best set metrics (below)          |
| `totalVolume`  | `number \| null` | Total volume for this exercise    |
| `createdAt`    | `Timestamp`      | Creation timestamp                |

#### `bestSet` (embedded object)

| Field      | Type      | Description               |
| ---------- | --------- | ------------------------- |
| `weight`   | `number?` | Heaviest weight           |
| `reps`     | `number?` | Most reps                 |
| `duration` | `number?` | Longest duration          |
| `distance` | `number?` | Longest distance          |
| `volume`   | `number?` | Highest single-set volume |

---

## Relationships

Firestore has no foreign keys or joins. Relations are maintained through document ID references and denormalized data.

### Reference Map

```
exerciseGroups/{groupId}
       │
       ├──← exercises.groupKey                        global exercise → global group
       └──← users/{uid}/exerciseGroups.globalGroupId   user group → original global group

users/{uid}/exerciseGroups/{groupId}
       │
       ├──← customExercises.groupId                    custom exercise → user group
       └──← exerciseOverrides.groupId                  override reassigns to user group

exercises/{exerciseId}
       │
       ├──← exerciseOverrides/{exerciseId}             same doc ID = implicit link
       ├──← routines.exercises[].exerciseId            routine references exercise
       ├──← workouts.exercises[].exerciseId            workout references exercise
       └──← exerciseHistory.exerciseId                 history references exercise

users/{uid}/customExercises/{exerciseId}
       │
       ├──← routines.exercises[].exerciseId            with isCustom=true
       ├──← workouts.exercises[].exerciseId            with isCustom=true
       └──← exerciseHistory.exerciseId                 with isCustom=true

users/{uid}/routines/{routineId}
       │
       └──← workouts.routineId                         workout started from routine

users/{uid}/workouts/{workoutId}
       │
       └──← exerciseHistory.workoutId                  history entry → source workout
```

### Relationship Patterns

1. **Same-ID linking** — `exerciseOverrides/{id}` uses the same document ID as `exercises/{id}`. No separate reference field needed; the document ID itself is the link.

2. **`isCustom` discriminator** — Exercises can come from global `exercises` or user `customExercises`. The `isCustom` boolean on routines, workouts, and history entries disambiguates which collection an `exerciseId` points to.

3. **Denormalization** — Fields like `exerciseName`, `exerciseType`, and `routineName` are copied into workouts, routines, and history entries to avoid extra reads. Tradeoff: renames don't propagate automatically to existing records.

4. **Global → User copy** — Global `exerciseGroups` are copied into `users/{uid}/exerciseGroups` on sign-up. The `globalGroupId` field links back to the original, and `isDefault: true` marks seeded groups vs user-created ones.

---

## Data Flow

### On Sign-Up

1. Firebase Auth creates user via Apple Sign-In
2. `ensureUserProfile()` creates `users/{uid}` document with default settings/stats
3. Global `exerciseGroups` are copied into `users/{uid}/exerciseGroups` with `isDefault: true`

### Real-Time Subscriptions

`useFirestoreSubscriptions()` hook (called in root layout) subscribes to all user data when authenticated:

- `useUserStore` → `users/{uid}` document
- `useExerciseStore` → 4 collections merged: global `exercises` + global `exerciseGroups` + user `exerciseOverrides` + user `customExercises` + user `exerciseGroups`
- `useWorkoutStore` → `users/{uid}/workouts` (sorted by `startedAt` desc)
- `useRoutineStore` → `users/{uid}/routines` (filters active vs archived)

### Exercise Resolution

The exercise store merges 4 sources into a unified `MergedExercise` list:

1. **Global exercises** — base data from `exercises` collection
2. **User overrides** — sparse patches from `exerciseOverrides` (custom name, hidden, re-grouped)
3. **Custom exercises** — user-created exercises from `customExercises`
4. **User groups** — user's copy of exercise groups from `exerciseGroups`

---

## Source Files

Everything Firestore-shaped lives in `database/` and is imported through the barrel `@/database`.

| File                                      | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `database/types.ts`                       | All Firestore type definitions, `WithId<T>`      |
| `database/refs.ts`                        | Collection/document reference helpers            |
| `database/use-firestore-subscriptions.ts` | Real-time subscription orchestration             |
| `database/index.ts`                       | Barrel — import from `@/database`, not the files |
| `features/auth/store/use-auth-store.ts`   | User creation and auth flow                      |
| `scripts/db/seed-exercises.ts`            | Global exercise/group seed script                |
