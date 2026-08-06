---
type: task
status: ready
area: navigation
context:
  - ../plan.md
  - ../../../app/architecture.md
  - ../../../app/navigation.md
  - ../../../app/ui.md
  - ../../../flows/start-workout.md
  - ../../../flows/create-routine.md
  - ../../../../app/(private)/_layout.tsx
verify:
  - bun run type-check
  - bun run lint
  - bun run format:check
  - bun run ios:development
created: 2026-08-05
---

# Task: run mobile QA and harden the native dock

## Goal

After explicit manual approval, run a dedicated read-only `qa-mobile` acceptance pass, route
defects to the original file owners, retest fixes, and close the initiative only when runtime
evidence and durable documentation agree.

## Why this is a separate task

Formal QA begins only after the user gate. The QA agent remains read-only; implementation agents
retain responsibility for fixes in their original ownership areas.

## Scope

- **In:** simulator acceptance testing, screenshots, accessibility snapshots, logs, reproducible
  defects, owner-routed fixes, targeted retests, final code review, and command gates.
- **Out:** unapproved QA before the manual gate, new product behavior, action destinations, or
  unrelated app-wide exploratory testing.

## Notes

- Spawn the `qa-mobile` agent only after the manual task records explicit approval.
- Cover iOS 26 and the oldest available supported runtime, multiple iPhone sizes, light/dark mode,
  Dynamic Type, Reduce Motion, and VoiceOver.
- Native defects return to the module owner; routing/state defects to the Router owner; clearance
  defects to the assigned screen owner. Parallel fixes may proceed only while ownership remains
  disjoint.
- Ask `qa-mobile` for focused retests after fixes rather than assuming a code gate proves the
  interaction.

## Definition of done

- [ ] Manual approval is recorded before the first `qa-mobile` run.
- [ ] `qa-mobile` completes the defined acceptance matrix with runtime evidence.
- [ ] Every reproducible defect is fixed, explicitly accepted, or documented as out of scope.
- [ ] Focused retests confirm fixes.
- [ ] Final code review covers native lifecycle/retention, event ordering, route synchronization,
      hit testing, accessibility, and safe-area behavior.
- [ ] Everything in `verify:` passes.
- [ ] Durable docs still match the final behavior after QA fixes.
- [ ] All task statuses and the initiative plan are marked completed only after these conditions.
