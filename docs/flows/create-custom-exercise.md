---
type: flow
status: current
area: exercises
updated: 2026-10-13
---

# Flow: create a custom exercise

## User goal

Add an exercise that the seeded library does not have. The user gives it a name, a type, and a
category, and may add a description and equipment. At the end the exercise is in the Exercises list
beside the seeded ones.

The flow covers creation only. The app has no way to edit, delete, or fork a custom exercise, and the
form attaches no artwork.

## Prerequisites

- **Signed in.** The sheet is mounted inside the protected tree, and the store action throws when no
  UID is recorded; see
  [`apps/mobile/src/stores/use-exercise-store.ts`](../../apps/mobile/src/stores/use-exercise-store.ts).
- **The user and exercise stores are subscribed**, started from
  [`apps/mobile/src/hooks/use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts).
  The exercise store records the UID in `subscribe(uid)`. The write takes its locale from the user
  store's profile and throws when the profile is null.
- **A loaded category list.** Category is required, and the picker lists the categories the exercise
  store publishes. Those come from the seeded `exerciseCategories` collection and the user's
  `customExerciseCategories`. The app has no way to create a custom category, so on an unseeded
  project the list is empty and nothing can be saved.
- **Deployed rules that accept an empty description.** `validCustomExercise` in
  [`firebase/firestore.rules`](../../firebase/firestore.rules) checks the description with
  `validEmptyableUserLocalizedText`. A Firebase project that has not received that ruleset rejects an
  exercise saved without a description. The repository does not record which environments have it.

Equipment is not a prerequisite. With no published equipment the form omits the Equipment section.

## Entry point

The global create panel declares **Custom Exercise** in
[`apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts).
The action is enabled. The panel opens from the detached Create tab-bar item, so the action is
reachable from every tab.

There is no second entry point. The Exercises screen has no add button, and its empty state offers no
action.

## Main path

1. **The user opens the create panel and presses Custom Exercise.**
   [`apps/mobile/src/features/navigation-dock/navigation-dock.tsx`](../../apps/mobile/src/features/navigation-dock/navigation-dock.tsx)
   fires `hapticImpact()`, closes the panel, and calls `open()` on
   [`apps/mobile/src/stores/use-custom-exercise-sheet-store.ts`](../../apps/mobile/src/stores/use-custom-exercise-sheet-store.ts).
2. **The sheet presents over the current tab.**
   [`apps/mobile/src/features/exercises/custom-exercise-sheet.tsx`](../../apps/mobile/src/features/exercises/custom-exercise-sheet.tsx)
   is a SwiftUI `BottomSheet` that opens at the `medium` detent and can be dragged to 0.9 of the screen height, with
   a visible drag indicator. It mounts
   [`apps/mobile/src/features/exercises/custom-exercise-form.tsx`](../../apps/mobile/src/features/exercises/custom-exercise-form.tsx)
   only while presented, so every presentation starts with an empty form. The form has a header row
   with Cancel, the title New Exercise, and Save, above a grouped list. The name field takes focus.
3. **The user fills in the form.** The fields and their limits are listed under
   [Fields](#fields). Save is disabled until the trimmed name is not empty and a category is chosen.
4. **The user presses Save.** The form trims the name and description and calls the exercise store's
   `createCustomExercise`. Save stays disabled while the write is pending.
5. **The write succeeds.** The form fires `hapticSuccess()` and then closes the sheet. The app stays
   on the tab the user was on.
6. **The exercise appears in the Exercises list.** The existing `customExercises` listener in
   [`apps/mobile/src/services/exercise-service.ts`](../../apps/mobile/src/services/exercise-service.ts)
   delivers the new document, and the store rebuilds the catalogue. The store adds no optimistic
   entry of its own.

## Fields

| Field       | Control                                   | Required | Limit or default                                        |
| ----------- | ----------------------------------------- | -------- | ------------------------------------------------------- |
| Name        | Text field                                | Yes      | 100 characters; must not be empty after trimming        |
| Description | Multi-line text field, up to 5 lines tall | No       | 2000 characters                                         |
| Type        | Segmented picker                          | Yes      | Strength, Cardio, or Bodyweight; starts on Strength     |
| Category    | Menu picker                               | Yes      | One published category; starts on None                  |
| Equipment   | One row per item, with a checkmark        | No       | Any number of the published equipment items, at most 20 |

The limits are constants in
[`apps/mobile/src/features/exercises/custom-exercise-form-state.ts`](../../apps/mobile/src/features/exercises/custom-exercise-form-state.ts).
They repeat values that [`packages/schemas/src/validation.ts`](../../packages/schemas/src/validation.ts)
and [`firebase/firestore.rules`](../../firebase/firestore.rules) enforce and do not export.

The category picker lists the store's `categories`: global categories in their order, then custom
ones, without retired, archived, or hidden categories. The equipment rows list the store's
`equipment`, which excludes retired items. Both are shown in the user's language.

## Screens, routes, and data involved

- **Routes:** none. The sheet is not a route. It is mounted once in
  [`apps/mobile/app/(private)/_layout.tsx`](<../../apps/mobile/app/(private)/_layout.tsx>) and
  presented from
  [`use-custom-exercise-sheet-store.ts`](../../apps/mobile/src/stores/use-custom-exercise-sheet-store.ts).
  The result is visible on
  [`apps/mobile/app/(private)/exercises/index.tsx`](<../../apps/mobile/app/(private)/exercises/index.tsx>).
- **Islands:**
  [`custom-exercise-sheet.tsx`](../../apps/mobile/src/features/exercises/custom-exercise-sheet.tsx)
  owns the `Host`. Inside it,
  [`custom-exercise-form.tsx`](../../apps/mobile/src/features/exercises/custom-exercise-form.tsx)
  renders the fields and
  [`custom-exercise-equipment-row.tsx`](../../apps/mobile/src/features/exercises/custom-exercise-equipment-row.tsx)
  renders each equipment row.
- **Documents:** `CustomExercise` at `users/{uid}/customExercises/{id}`, defined in
  [`@hipefit/schemas`](../../packages/schemas/src/index.ts), reached through `customExercisesRef(uid)`
  from [`@hipefit/firebase/react-native`](../../packages/firebase/src/react-native/index.ts), and
  described in [`docs/db-structure.md`](../db-structure.md).

## State and data changes

The flow reads `categories`, `equipment`, and `isLoading` from
[`useExerciseStore`](../../apps/mobile/src/stores/use-exercise-store.ts). The draft lives in the form
component and is discarded when the sheet closes. Nothing is persisted until Save.

Save performs one write. `createCustomExercise` in
[`exercise-service.ts`](../../apps/mobile/src/services/exercise-service.ts) builds a complete
`CustomExercise`, validates it with `assertCustomExerciseWrite`, and calls `addDoc` on
`customExercisesRef(uid)`. Firestore assigns the document ID. The document holds:

- `name` and `description` as maps with a single key, the user's `settings.language` at the time of
  the save. `defaultLocale` is that same locale. The form writes no second translation.
- `description` as an empty string under that key when the user left it blank. The key is always
  present.
- `type`, `categoryRef`, and `equipment` as chosen.
- `forkedFromRef: null` and `imageURL: null`, always.
- `createdAt` and `updatedAt` as `serverTimestamp()`. The service validates with `Timestamp.now()`
  placeholders first, because the rules require both fields to equal the request time.

The service rejects more than 20 equipment refs before validating. The rules cap the list at 20 and
`assertCustomExerciseWrite` does not.

Until the server acknowledges the write, the listener's snapshot carries `null` in both timestamp
fields. The service fills them with the current time for a document that has pending writes, so the
new exercise passes the decoder and appears in the list before the acknowledgement arrives.

## Alternative, empty, and error paths

- **Catalogue still loading.** Save is disabled while the exercise store's `isLoading` is true. The
  category picker offers only None and the Equipment section is absent until data arrives. The form
  shows no loading indicator.
- **No categories.** When loading has finished and the list is empty, the footer under the category
  picker turns red and reads "Categories are unavailable, so the exercise cannot be saved. Try again
  later." Save stays disabled. A failed category listener looks the same as an unseeded project.
- **Category removed while the sheet is open.** The form resolves the selection against the
  published list on every render. A category that stops being published reads as None, and Save
  disables again.
- **Validation.** The form shows no inline validation message. An empty name or a missing category
  disables Save, and the footers under Name and Category read "Required." The text fields stop
  accepting input at their limits. A press on a 21st equipment row changes nothing.
- **Cancel.** Cancel closes the sheet at once and discards the form, with no confirmation. It also
  works while a save is pending. That write continues: if it succeeds the exercise still appears in
  the list, and if it fails the error is only logged.
- **Swipe down.** The sheet refuses the swipe while a save is pending or the form has input: a
  non-blank name or description, a type other than Strength, a chosen category, or any selected
  equipment. An untouched form can be swiped away.
- **Failed save.** The sheet stays open with the form intact, and no haptic fires. The footer under
  Name turns red and reads "Couldn't save the exercise. Check your connection and try again." Save
  is enabled again, and the next edit to any field clears the message. A rules rejection, a missing
  UID, a null profile, and a failed validation all take this path and show the same message.
- **Offline.** The form awaits `addDoc`. What the sheet does when the device is offline has not been
  observed.
- **Session ends with the sheet open.** The sheet calls `close()` when it unmounts, so it does not
  present again at the next sign-in.

## Completion state

One new document exists in `users/{uid}/customExercises`. The sheet is dismissed, and the user is on
the same tab as before, with the create panel closed.

The exercise is in the Exercises list, placed by its category's order and then by name. Its row
shows `Custom` after the category name. Its detail
sheet in
[`exercise-detail-sheet.tsx`](../../apps/mobile/src/features/exercises/exercise-detail-sheet.tsx)
shows the Custom Exercise chip, and omits the Description block when the description is empty. If
the user later changes `settings.language`, the name still resolves through `defaultLocale`.

No other document changes. The user profile and its hidden-ref arrays are not written.
