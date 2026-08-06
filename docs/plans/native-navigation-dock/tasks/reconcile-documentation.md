---
type: task
status: done
area: navigation
context:
  - ../plan.md
  - ../../../README.md
  - ../../../app/architecture.md
  - ../../../app/navigation.md
  - ../../../app/ui.md
  - ../../../flows/start-workout.md
  - ../../../flows/create-routine.md
  - ../../../../app/(private)/_layout.tsx
verify:
  - bunx prettier --write docs/README.md docs/app/architecture.md docs/app/navigation.md docs/app/ui.md docs/flows/start-workout.md docs/flows/create-routine.md
  - bun run format:check
created: 2026-08-05
---

# Task: reconcile native dock documentation

## Goal

After integration behavior is stable, update every durable document invalidated by the native dock
and remove citations to the superseded floating-action-button implementation.

## Why this is a separate task

One documentation owner can reconcile cross-document terminology and citations without colliding
with native or Router source ownership. It starts only after the integrated behavior has runtime
evidence.

## Scope

- **In:** the three affected shared-system documents, two affected flows, their frontmatter dates,
  removed-path citation search, and plan/task status reconciliation.
- **Out:** implementation changes, a new assistant flow, changes to action availability, or claims
  based only on proposed plan text.

## Notes

- Verify every statement against the integrated code and runtime evidence; the plan is intent, not
  current-state authority.
- Keep the flows explicit that Start Workout and New Routine remain disabled.
- Do not create an assistant flow while the pill is unavailable.
- Search the whole repository for both old floating-action-button filenames before completion.

## Definition of done

- [ ] [`navigation.md`](../../../app/navigation.md) describes Router/native ownership, dock
      interaction, dismissal, metrics, and the removal of measured floating-button geometry.
- [ ] [`ui.md`](../../../app/ui.md) describes the local-native-view boundary, material fallback,
      hit testing, native motion, and accessibility rules.
- [ ] [`architecture.md`](../../../app/architecture.md) establishes `modules/` as the iOS local
      native integration boundary.
- [ ] [`start-workout.md`](../../../flows/start-workout.md) and
      [`create-routine.md`](../../../flows/create-routine.md) describe the new global entry-point
      presentation while preserving disabled status.
- [ ] Removed source paths have no stale citations.
- [ ] Everything in `verify:` passes.
