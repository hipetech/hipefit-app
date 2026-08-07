---
type: task
status: blocked
area: documentation
context:
  - ../plan.md
  - ../../../README.md
  - ../../../app/architecture.md
  - ../../../app/ui.md
  - ../../../../features/home/home-content.tsx
verify:
  - bunx prettier --write docs/app/architecture.md docs/app/ui.md docs/plans/weekly-calendar
  - bun run format:check
created: 2026-08-07
---

# Task: reconcile expandable-calendar documentation

## Goal

After runtime behavior is stable, update the durable UI and architecture documents to describe the
verified Home island boundary and calendar integration, then close the initiative statuses.

## Why this is a separate task

One documentation owner can reconcile terminology and citations without colliding with feature or
Home source work, and can base every statement on integrated evidence rather than proposed intent.

## Scope

- **In:** `docs/app/architecture.md`, `docs/app/ui.md`, `docs/flows/browse-home-calendar.md`,
  `docs/README.md`, frontmatter dates, citation checks, and plan/task status reconciliation.
- **Out:** product code, a new calendar flow, Firebase/date semantics, or claims copied from the plan
  without verification.

## Notes

- Verify statements against final code and runtime evidence; this plan remains historical intent.
- Explain why Home uses sibling RN and SwiftUI islands and why a dynamic `RNHostView` list row was
  rejected.
- Record the exact Wix version for implementation-detail findings, including fixed geometry,
  replaced non-scaling labels, gesture ownership, and the final Reduce Motion solution.
- The new flow must say that markers are mock props, selection is local/non-persistent, and no Home
  section is filtered or otherwise changed.

## Definition of done

- [ ] [`architecture.md`](../../../app/architecture.md) describes the verified Home island shape
      without weakening the route/feature boundary.
- [ ] [`ui.md`](../../../app/ui.md) describes the calendar's RN/SwiftUI boundary, styling,
      accessibility, gesture, geometry, and motion rules.
- [ ] `docs/flows/browse-home-calendar.md` describes collapsed/expanded browsing, controlled local
      selection, workout-dot semantics, mock-only scope, and all non-persistent results.
- [ ] [`docs/README.md`](../../../README.md) indexes the new flow.
- [ ] Every added link resolves and any moved Home citation is updated.
- [ ] Everything in `verify:` passes.
- [ ] Task notes and the initiative plan are marked completed only after all implementation and QA
      gates are complete.
