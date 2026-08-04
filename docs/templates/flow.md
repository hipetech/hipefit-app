---
type: template
status: current
area: documentation
updated: 2026-08-04
---

# Template: flow document

Copy the body below into `docs/flows/<flow-name>.md` and replace the example content. The shape is
extracted from [`docs/flows/start-workout.md`](../flows/start-workout.md), the pilot: every section
here earned its place by carrying information that could not be recovered by reading one directory
under `features/`.

Rules that matter more than the headings:

- **Delete a section rather than filling it ceremonially.** An empty "Alternative paths" heading is
  worse than no heading, because the next reader assumes it was considered.
- **Link inline, in the sentence that makes the claim** — there is no "source links" section. Use
  standard Markdown links with repository-relative paths (`../../features/…`), never wikilinks. A
  path containing parentheses must be wrapped in angle brackets:
  `[…](<../../app/(private)/workouts/index.tsx>)`.
- **Verify every claim against the code before writing it.** If a plan under `docs/plans/` says
  otherwise, the code wins and the plan is historical.
- **Say plainly when something does not ship.** The pilot's most useful property is that it names
  the exact step where the journey stops.
- **Re-read this document whenever the feature behind it changes**, and update it when the change
  touches entry points or availability; routes, screens, or step order; decisions, branches, and
  alternate paths; state reads, writes, or persistence; loading, empty, disabled, and error
  behavior; or the completion state and user-visible result. These are review triggers, not
  sections to fill in: a trigger that fires against prose that is already true costs one read and
  no edit.
- **A new flow document is required for a distinct user goal**, or for a journey that can be
  understood independently of the ones already written. A change to an existing goal is an edit to
  its existing document, never a second one. Index a new flow in [`docs/README.md`](../README.md),
  which owns the lifecycle these triggers belong to.

---

```yaml
---
type: flow
status: current
area: workouts
updated: 2026-08-04
---
```

# Flow: <verb phrase — e.g. "start a workout">

> Optional status callout. Include it **only** when the journey does not fully ship, and put it
> first so it cannot be missed. State what is present, where the path stops, and what the app does
> instead. Delete this blockquote entirely for a flow that works end to end.

## User goal

One or two sentences in the user's language, not the code's. What are they trying to accomplish,
and what do they have at the end that they did not have at the start?

If only part of that goal is reachable today, say which part here rather than burying it below.

## Prerequisites

What must already be true before the first step can run. Bullets, each linked to the thing that
enforces it. The pilot's set is representative:

- **Signed in.** `app/_layout.tsx` wraps `(private)` in `<Stack.Protected>`; see
  [`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts).
- **Firestore subscriptions live**, started once from
  [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts).
- **Data the flow assumes exists** — and, if nothing in the app or in `scripts/db/` creates it, say
  so here. A prerequisite no code satisfies is a finding, not a footnote.

## Entry points

Every affordance that advertises this journey, and where it lives. A table pays for itself once
there are more than two:

| Entry point            | Where                                                                            | Notes                                           |
| ---------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| **<button label>**     | [`features/workouts/routine-card.tsx`](../../features/workouts/routine-card.tsx) | Any condition that gates it, or why it is inert |
| **<other affordance>** | [`features/home/home-content.tsx`](../../features/home/home-content.tsx)         | …                                               |

Follow the table with prose when the entry points share a convention worth naming — the pilot
records that a control with no destination is rendered inert rather than hidden, which is a
repo-wide decision a reader would otherwise rediscover by accident.

## Main path

Numbered steps, one per user-observable action. Each step links the route file and the feature
island that implements it. Keep the numbering honest: if the path terminates, mark the step where
it stops rather than describing an intended one.

1. **<What the user does.>** What renders, and where it comes from —
   [`app/(private)/workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>) mounts
   [`features/workouts/workouts-content.tsx`](../../features/workouts/workouts-content.tsx).
2. **<Next action.>** Include the branch conditions that decide what the user sees.
3. **<Result.>** …

## What is missing

Optional. Include it only for a partially built flow, and enumerate the gap so the disabled button
does not read as one `onPress` away: missing routes, missing store actions, derived writes nobody
performs, rules nothing enforces. Delete this section for a flow that ships.

## Screens, routes, and data involved

The inventory, so a reader can find everything without re-reading the steps.

- **Routes:** the paths involved and where they are declared.
- **Islands:** the `features/` components the routes mount.
- **Documents:** the Firestore types and collection paths, linked to
  [`database/types.ts`](../../database/types.ts), [`database/refs.ts`](../../database/refs.ts), and
  [`docs/db-structure.md`](../db-structure.md).

Merged into one section deliberately — in the pilot each of the three parts was three bullets long,
and splitting them produced three thin sections.

## State and data changes

What the flow reads, what it writes, and what survives. Name the stores and what each derives from
one snapshot; note anything unbounded (a subscription with no `limit`), anything paged in the view
layer, and anything that resets on unmount.

If the flow performs no writes, say **none** in bold and list only the read state.

## Alternative, empty, and error paths

Loading, empty, partial, and failure states — one bullet each, with the component that renders them.
This is where the pilot found the most non-obvious behavior, so it is worth writing even when the
main path is trivial.

Call out any state that is **indistinguishable from another** to the user — for example a failed
subscription that renders the same empty state as a new account. Mark it as a gap rather than a
decision unless a comment in the code says otherwise.

## Completion state

The terminal state: what exists in Firestore, what the user sees, and what derived values changed.
If the flow does not complete, say what the intended terminal state is and confirm that nothing
writes it.

## Historical context

Optional. Links to plans under `docs/plans/` that explain how the flow got here. Label them as
historical and end with the rule:

> These are plans, not descriptions of current behavior. Where either disagrees with this document,
> check the code.
