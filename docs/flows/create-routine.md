---
type: flow
status: current
area: workout-templates
updated: 2026-10-14
---

# Flow: create a workout template

## User goal

Save a reusable workout plan: a name, an ordered list of exercises with
target sets, and supersets that group neighbouring exercises. At the end the template is a card in
the My Workout Templates section of the Workouts screen.

The flow covers creation only. A saved template cannot be edited, archived, deleted, or started, and
Home does not show it. The product and code call this a **workout template**; the filename keeps the
older word "routine" so existing links stay stable.

## Prerequisites

- **Signed in.** The sheet is mounted inside the protected tree, and the store action throws when no
  UID is recorded; see
  [`apps/mobile/src/stores/use-workout-template-store.ts`](../../apps/mobile/src/stores/use-workout-template-store.ts).
- **The user, exercise, and workout template stores are subscribed**, started from
  [`apps/mobile/src/hooks/use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts).
  The template store records the UID in `subscribe(uid)`. The exercise store supplies the picker's
  catalogue, and the user store supplies `settings.units`.
- **A published exercise catalogue.** A template needs at least one exercise, and the picker lists
  only the exercises the exercise store publishes. On a project without seeded exercises or custom
  exercises the picker is empty and nothing can be saved.

## Entry point

The global create panel declares **New Workout Template** in
[`apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts),
and the action is enabled. The panel opens from the detached Create tab-bar item, so the action is
reachable from every tab.

There is no second entry point. The Workouts screen has no add button, and its empty state offers no
action. Home's empty footer reads "Create a workout template in the Workouts tab and it will be
featured here.", but the Workouts tab has no creation control.

## Main path

1. **The user opens the create panel and presses New Workout Template.**
   [`apps/mobile/src/features/navigation-dock/navigation-dock.tsx`](../../apps/mobile/src/features/navigation-dock/navigation-dock.tsx)
   fires `hapticImpact()`, closes the panel, and calls `open()` on
   [`apps/mobile/src/stores/use-workout-template-sheet-store.ts`](../../apps/mobile/src/stores/use-workout-template-sheet-store.ts).
2. **The editor sheet presents over the current tab.**
   [`apps/mobile/src/features/workout-templates/workout-template-sheet.tsx`](../../apps/mobile/src/features/workout-templates/workout-template-sheet.tsx)
   is a SwiftUI `BottomSheet` that opens at full height and can be dragged down to half height,
   with a visible drag indicator. It mounts
   [`workout-template-form.tsx`](../../apps/mobile/src/features/workout-templates/workout-template-form.tsx)
   only while presented, so every presentation starts with an empty draft. The form has a SwiftUI
   header row with Cancel, the title New Workout Template, and Save. Below it is a scrolling list:
   the name field, the Planned date row, an Exercises label, the exercise cards, and a footer with Add
   Exercises. An empty draft shows "Add exercises to build this template." above Add Exercises.
3. **The user names the template.** The name field is required. There is no description field.
   Optionally the user sets a planned date; see [Planned date](#planned-date).
4. **The user presses Add Exercises.** The form fires `hapticImpact()` and presents the picker, a
   second sheet over the editor, described under [The exercise picker](#the-exercise-picker). Its Add
   button appends the selected exercises to the end of the list, each with one empty set and outside
   any superset.
5. **The user fills in sets, reorders, and links supersets.** See [Sets and units](#sets-and-units),
   [Reordering](#reordering), and [Supersets](#supersets).
6. **The user presses Save.** Save is enabled only while the draft passes
   [validation](#validation). The form converts the draft to stored units and calls the template
   store's `createWorkoutTemplate`. Save stays disabled while the write is pending.
7. **The write succeeds.** The form fires `hapticSuccess()` and closes the sheet. The app stays on the
   tab the user was on.
8. **The template appears on Workouts.** The template listener in
   [`apps/mobile/src/services/workout-template-service.ts`](../../apps/mobile/src/services/workout-template-service.ts)
   delivers the new document, and
   [`apps/mobile/src/features/workouts/workouts-content.tsx`](../../apps/mobile/src/features/workouts/workouts-content.tsx)
   adds a card to the My Workout Templates carousel. The store adds no optimistic entry of its own.

## The exercise picker

[`exercise-picker-sheet.tsx`](../../apps/mobile/src/features/workout-templates/exercise-picker-sheet.tsx)
presents from inside the editor's sheet. It also opens at full height and can be dragged down to
half height. Its header row has Cancel, the title
Add Exercises, and Add. Add is disabled until something is selected and then reads `Add (n)`.

[`exercise-picker-list.tsx`](../../apps/mobile/src/features/workout-templates/exercise-picker-list.tsx)
is a grouped SwiftUI `List`. It starts with a Filter by name field, which matches any part of the
exercise name without regard to case. Below it is one section per category, in the order the
exercise store publishes. Each row shows the exercise name and `Category · Type`. Tapping a row
toggles a checkmark and fires `hapticSelection()`. The list shows the store's visible catalogue, so
retired and hidden exercises are absent. An exercise already in the draft can be selected again and
is added a second time.

Add returns the selection in catalogue order and closes the picker. Cancel and a swipe down close it
and add nothing. The filter and the selection start empty on every presentation.

## Planned date

The row under the name reads "Planned date" with the date, such as "Tue, 20 Oct 2026", or "None".
Tapping it fires `hapticImpact()` and opens
[`planned-date-sheet.tsx`](../../apps/mobile/src/features/workout-templates/planned-date-sheet.tsx), a
SwiftUI `BottomSheet` sized to its content over the editor. It holds a graphical `DatePicker`
that starts at today, so earlier days are disabled, with Remove Date and Done above it. Opening it
with no date set plans the template for today, so the highlighted day is the stored one. Picking a
day applies at once; Done only closes the sheet, and Remove Date clears the date and closes it. A
planned date counts as input for the swipe lock.

## Sets and units

Each exercise is a card with its name, its sets, Add Set, and an action button (`⋯`). The fields of
a set follow the exercise's type, as `TEMPLATE_SET_FIELDS` in
[`workout-template-draft.ts`](../../apps/mobile/src/features/workout-templates/workout-template-draft.ts)
sets them:

| Exercise type | Fields             | Entered as                           |
| ------------- | ------------------ | ------------------------------------ |
| Strength      | Weight, Reps       | kg or lb; whole number               |
| Bodyweight    | Reps               | whole number                         |
| Cardio        | Duration, Distance | minutes under both systems; km or mi |

The unit system is the profile's `settings.units`, and the form treats it as `metric` until the
profile loads. Each field shows its unit label beside the input, and reps show none. Weight,
duration, and distance use the decimal keypad, reps the number pad. A comma is accepted as the
decimal separator. Every field is optional: an empty field is left out of the stored set, so a set
with no values is valid.

Add Set appends a copy of the exercise's last set, or an empty set when the exercise has none, and
fires `hapticSelection()`. The copy takes the last set's values but not its note. The minus control
beside a set removes it. Removing the last set is
allowed, and the card then shows "Add at least one set".

The conversions are in [`apps/mobile/src/lib/units.ts`](../../apps/mobile/src/lib/units.ts).

Each set has a note button (`✎`) before its minus control. Tapping it shows a multiline note field
under the set, and tapping it again hides the field. A set whose note has text always shows the
field. Notes are optional, plain text, and at most 2000 characters; a blank note is not stored.

## Reordering

The exercise list is a `SortableList` from
[`@hipefit/sortable-list`](../../packages/sortable-list/README.md) whose items are blocks: a single
exercise, or a whole superset. A long press on a block outside its inputs and its buttons lifts the
block, with `hapticLift()`, so a superset always moves as one. The
list scrolls while the block is near its top or bottom edge, and each change of slot fires
`hapticSelection()`. The new order is committed once, on drop.
[`docs/app/ui.md`](../app/ui.md#the-sortable-list) records that the drag and the auto-scroll have
been checked against the library sources and not on a device.

Inside a superset, each member has up and down arrows beside its action button. An arrow swaps the
member with its neighbour in the superset and fires `hapticSelection()`. The up arrow is disabled
on the first member and the down arrow on the last. The superset keeps its place in the list. The
arrows are in
[`template-exercise-content.tsx`](../../apps/mobile/src/features/workout-templates/template-exercise-content.tsx).

A long press inside a set field selects text and does not lift anything. Reordering sets within an
exercise is not supported.

## Supersets

The action button opens an action sheet titled with the exercise name. It offers only the actions
that apply:

- **Superset with Next**, on a single exercise or the last member of a superset, when another block
  follows. The two blocks merge into one superset, which keeps the first block's superset id, then
  the second's, and otherwise gets a new one.
- **Remove from Superset**, when the exercise is in one. The exercise moves to just after the
  superset, and the remaining members stay one superset.
- **Remove Exercise**, always, shown as destructive.

A superset is one card with a "Superset" caption at the top and its exercises separated by dividers.
The caption has its own note button: it shows a "Superset note" field under the caption, which
behaves like a set's note field. The superset keeps its note when its members are reordered. When
two blocks merge, the merged superset keeps the first block's note, or else the second's; a superset
that dissolves drops its note.
VoiceOver reads a member's name followed by "in a superset".

The draft keeps every superset valid after each change. A superset left with one member dissolves,
whether by unlinking or by removing an exercise. Because a superset only moves as a whole and its
members only move within it, a reorder never splits or joins a superset.

## Validation

[`validateWorkoutTemplateDraft`](../../apps/mobile/src/features/workout-templates/workout-template-draft.ts)
decides whether Save is enabled. Save stays disabled while any problem remains.

| Field      | Rule                                               | Message                                        |
| ---------- | -------------------------------------------------- | ---------------------------------------------- |
| Name       | Not empty after trimming; at most 100 characters   | "Enter a name" or "Use at most 100 characters" |
| Exercises  | Between 1 and 50                                   | "Use at most 50 exercises" above the limit     |
| Sets       | At least one per exercise                          | "Add at least one set"                         |
| Set values | A plain decimal, not negative; reps a whole number | "Set n: Weight must be a number", and so on    |

The name input stops accepting text at its limit. The picker can add more than
50 exercises at once, and the footer then shows the count message. An empty draft shows "Add
exercises to build this template." instead. Each exercise card shows its first problem in red below
Add Set.

A field's message appears once the user has edited that field, or after a save attempt. The name
field of an untouched form shows no message even though Save is disabled. An exercise counts as
edited once a set value changes or a set is removed.

The limits repeat values that [`packages/schemas/src/validation.ts`](../../packages/schemas/src/validation.ts)
enforces and does not export. The validator does not cap the number of sets, and neither does the
draft.

## Screens, routes, and data involved

- **Routes:** none. The sheet is not a route. It is mounted once in
  [`apps/mobile/app/(private)/_layout.tsx`](<../../apps/mobile/app/(private)/_layout.tsx>) and
  presented from
  [`use-workout-template-sheet-store.ts`](../../apps/mobile/src/stores/use-workout-template-sheet-store.ts).
  The result is visible on
  [`apps/mobile/app/(private)/workouts/index.tsx`](<../../apps/mobile/app/(private)/workouts/index.tsx>).
- **Islands:**
  [`workout-template-sheet.tsx`](../../apps/mobile/src/features/workout-templates/workout-template-sheet.tsx)
  owns the `Host`. Inside it,
  [`workout-template-form.tsx`](../../apps/mobile/src/features/workout-templates/workout-template-form.tsx)
  renders the header row and the hosted list. The list items are plain React Native:
  [`template-exercise-row.tsx`](../../apps/mobile/src/features/workout-templates/template-exercise-row.tsx)
  for a single exercise and
  [`template-superset-block.tsx`](../../apps/mobile/src/features/workout-templates/template-superset-block.tsx)
  for a superset, both drawing
  [`template-exercise-content.tsx`](../../apps/mobile/src/features/workout-templates/template-exercise-content.tsx)
  and
  [`template-set-row.tsx`](../../apps/mobile/src/features/workout-templates/template-set-row.tsx).
  The picker is
  [`exercise-picker-sheet.tsx`](../../apps/mobile/src/features/workout-templates/exercise-picker-sheet.tsx)
  and
  [`exercise-picker-list.tsx`](../../apps/mobile/src/features/workout-templates/exercise-picker-list.tsx).
  On Workouts,
  [`workout-template-card.tsx`](../../apps/mobile/src/features/workouts/workout-template-card.tsx)
  renders each card.
- **Documents:** `WorkoutTemplate` at `users/{uid}/workoutTemplates/{id}`, defined in
  [`@hipefit/schemas`](../../packages/schemas/src/workout.ts), reached through
  `workoutTemplatesRef(uid)` from
  [`@hipefit/firebase/react-native`](../../packages/firebase/src/react-native/index.ts), and
  described in [`docs/db-structure.md`](../db-structure.md).

## State and data changes

The draft lives in the form component as one `useState` over the pure operations in
[`workout-template-draft.ts`](../../apps/mobile/src/features/workout-templates/workout-template-draft.ts).
It is discarded when the sheet closes. Nothing is persisted until Save.

Save performs one write. `createWorkoutTemplate` in
[`workout-template-service.ts`](../../apps/mobile/src/services/workout-template-service.ts) builds a
complete `WorkoutTemplate`, validates it with `assertWorkoutTemplateWrite`, and calls `addDoc` on
`workoutTemplatesRef(uid)`. Firestore assigns the document ID. The document holds:

- `name`, trimmed, and `description` as `null`: the editor has no description field.
- `plannedDate` as the local day, `YYYY-MM-DD`, only when one is set. The key is left out
  otherwise.
- `exercises`, in the draft's order. Each entry has `exerciseRef`, `nameSnapshot` (the exercise name
  in the user's language when it was added), `type`, `sets`, and `supersetId`.
- `supersetId` as `null` outside a superset. Members of one superset share an id of the form
  `superset-n`, generated on the client and unique within the template.
- Each set with only its type's fields that hold a value, in stored units: weight in kilograms,
  distance in meters, duration in seconds, and reps as entered. A set's note is stored as `notes`,
  trimmed, and left out when blank.
- A superset's note as `supersetNotes` on the superset's first exercise only, trimmed, and left out
  when blank.
- `estimatedDuration: null`, `isArchived: false`, `lastPerformedAt: null`, and `timesPerformed: 0`,
  always.
- `createdAt` and `updatedAt` as `serverTimestamp()`. The service validates with `Timestamp.now()`
  placeholders first, because the rules require both fields to equal the request time.

The template store reads the collection through one listener ordered by `updatedAt` descending, with
no limit. The service decodes each document and drops a malformed one with a log line. Until the
server acknowledges the write, the snapshot carries `null` in both timestamp fields;
`fillPendingTimestamps` in
[`firestore-timestamps.ts`](../../apps/mobile/src/services/firestore-timestamps.ts) fills them with
the current time, so the new template passes the decoder and appears before the acknowledgement. The
store drops archived templates before publishing.

## Alternative, empty, and error paths

- **Cancel.** Cancel closes the sheet at once and discards the draft, with no confirmation. It also
  works while a save is pending. That write continues: if it succeeds the template still appears on
  Workouts, and if it fails the error is only logged.
- **Swipe down.** The sheet refuses the swipe while a save is pending or the draft has input: a
  non-blank name or any exercise. An untouched form can be swiped away.
- **Failed save.** The sheet stays open with the draft intact, and no haptic fires. Below Add
  Exercises a red line reads "Couldn't save the workout template. Check your connection and try
  again." Save is enabled again, and the next change to the draft clears the message. A rules
  rejection, a missing UID, and a failed validation all take this path and show the same message.
- **Offline.** The form awaits `addDoc`. What the sheet does when the device is offline has not been
  observed.
- **Catalogue still loading.** The picker shows one redacted placeholder row. With no published
  exercises it shows "No exercises available", and with a filter that matches nothing, "No matching
  exercises".
- **Templates loading on Workouts.** The whole Workouts list is redacted, including the History
  section's placeholder rows, and the template header shows a placeholder count.
- **No templates.** Workouts shows `No workout templates yet` and a footer that reads "Create a
  workout template and it will show up here, ready to start in one tap." Nothing can start a
  template.
- **Template listener error.** The store logs the error and stops loading, keeping its previous or
  empty list. A failed listener looks the same as an account with no templates.
- **Session ends with the sheet open.** The sheet calls `close()` when it unmounts, so it does not
  present again at the next sign-in. Sign-out also clears the template store.

## Completion state

One new document exists in `users/{uid}/workoutTemplates`. The sheet is dismissed, and the user is
on the same tab as before, with the create panel closed.

Workouts shows the template as a card in the My Workout Templates carousel, newest `updatedAt`
first. The card shows the name on one line, the exercise count, and the set count. It has no
duration line. The section header's count includes it, rolling to the new value unless Reduce Motion
is on.

Tapping a card fires `hapticImpact()` and opens a read-only preview,
[`workout-template-preview-sheet.tsx`](../../apps/mobile/src/features/workouts/workout-template-preview-sheet.tsx).
It is a SwiftUI `BottomSheet` that opens at full height and can be dragged down to half height. It
shows the name with the exercise and set counts and, when set, "Planned for" with the date, then one section per superset or single exercise.
A superset's section is titled Superset and shows its note as the footer. Each exercise lists its
sets in the user's units, such as "60 kg × 10", "10 reps", or "20 min · 5 km", with "No targets"
for a set without values, and each set's note under it. The preview reads the template from the
store by id, so it follows the listener while open. It has no actions.

No other document changes. The user profile and the exercise documents are not written.

## Not yet built

- Editing, duplicating, archiving, or deleting a template. The preview is read-only, and the service
  and store expose only create.
- Home's template section. Home still shows `No Active Workout Templates`.
- Starting a workout from a template. Start Workout stays disabled; see
  [start a workout](start-workout.md).
- `estimatedDuration`, `lastPerformedAt`, and `timesPerformed` are written with their fixed values
  and nothing updates them.
