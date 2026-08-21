---
type: flow
status: current
area: workout-templates
updated: 2026-08-21
---

# Flow: create a workout template

> **This journey does not ship.** The product and code now use **workout template**, not routine.
> The only creation affordance is disabled, there is no editor or exercise picker, and nothing reads
> or writes `users/{uid}/workoutTemplates`. The filename is retained so existing repository links
> remain stable.

## User goal

Create a reusable workout template with a name, ordered exercises, and target sets, then see it on
Home and Workouts and start it later.

None of the creation steps are reachable. There is no client read side.

## Entry point

The global create panel declares **New Workout Template** in
[`apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts).
It ships with `enabled: false`, so native UI swallows the touch and no handler runs.

There is no second entry point. The Workouts route has no add toolbar item, empty-state button, card
context action, duplicate action, or edit action. The create panel is reachable from every tab, but
the template action always stops there.

## Main path today

1. The user opens the create panel from the detached Create tab-bar item.
2. The panel shows Start Workout, New Workout Template, and Custom Exercise. All three are disabled.
3. The user cannot select New Workout Template. No route, sheet, draft, or write follows.

## Read behavior

No workout-template read behavior ships. There is no collection ref, snapshot listener, or Zustand
store for templates. Home and Workouts render their empty template states immediately.

The retained `WorkoutTemplate` schema includes `isArchived`, `lastPerformedAt`, and `timesPerformed`,
but no current client path reads, renders, or updates them.

## Missing implementation

- A route or sheet for create/edit.
- Draft state for template name, description, exercise order, and target sets.
- A workout-specific exercise picker.
- State, document refs, and actions for create, update, archive, or delete.
- Validation and write use of `TemplateExercise` / `TemplateSet` from the UI.
- A start-workout destination for the resulting template.

[`@hipefit/schemas`](../../packages/schemas/src/workout.ts) and its runtime decoder define the stored
shape: ordered embedded exercises with full exercise refs, name/type snapshots, and ordered optional
set targets. Retaining that contract does not make a read or write journey shipped.

## Empty, loading, and error behavior

- New/empty account: Workouts shows `No workout templates yet`; Home shows
  `No Active Workout Templates`.
- Both empty-state footers direct the user toward creating a template, but the only advertised action
  remains disabled.
- Template skeleton UI remains in source for later integration, but no current request reaches it.
- There is no template listener and therefore no listener error path.

## State and data changes

None. This journey holds no draft and performs no Firestore read or write.

## Completion state

There is no user-reachable completion state. The app cannot create, read, edit, archive, delete, or
start a workout template.
