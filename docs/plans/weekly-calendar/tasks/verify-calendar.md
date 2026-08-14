---
type: task
status: blocked
area: quality
context:
  - ../plan.md
  - ../../../app/ui.md
  - ../../../../features/home/home-content.tsx
  - ../../../../package.json
verify:
  - bun run type-check
  - bun run lint
  - bunx prettier --check package.json features/calendar features/home docs/plans/weekly-calendar
  - bun run ios:development
created: 2026-08-07
---

# Task: verify and harden the expandable calendar

## Goal

Run the plan's full static and iOS runtime matrix on the integrated calendar, route defects to their
original owners, and produce enough evidence for visual approval and final documentation.

## Why this is a separate task

Gesture arbitration, animated layout, Dynamic Type, VoiceOver, and semantic colors cannot be proven
by TypeScript. A read-only validation owner keeps evidence independent while source fixes remain
with the agents that own those files.

## Scope

- **In:** required commands, focused `agent-device` passes, user visual-approval screenshots,
  read-only `qa-mobile` acceptance, accessibility evidence, defect reports, targeted retests, and
  integrated code review.
- **Out:** direct source edits by QA agents, production data behavior, unrelated app dogfooding, and
  claiming automated coverage where none exists.

## Notes

- Start only after both implementation tasks are integrated and their focused checks pass.
- Execute every row in the plan's runtime acceptance matrix, including boundary dates, diagonal
  gestures, theme changes, Dynamic Type, Reduce Motion, and VoiceOver.
- Launch once with VoiceOver already enabled to exercise Wix's alternate accessible rendering path;
  toggling it only after mount does not prove that branch.
- Confirm Home's large greeting still responds to list scrolling and tab re-entry does not leave a
  stale animated calendar height.
- Calendar defects return to the calendar worker; Home layout/regression defects return to the Home
  worker; shared-manifest issues return to the integration lead.
- After fixes, retest affected cases and ask a code-review agent to review the full integrated diff.

## Definition of done

- [ ] Static gates pass in the prescribed order.
- [ ] Focused simulator evidence covers collapsed and expanded visuals, gesture behavior, markers,
      both Wix accessibility paths, variable month heights, themes, Dynamic Type, Reduce Motion,
      Home navigation behavior, and device sizes.
- [ ] The user approves the reference-aligned collapsed state and expanded month presentation.
- [ ] `qa-mobile` completes the read-only acceptance pass and every defect is fixed, accepted, or
      explicitly scoped out.
- [ ] Targeted retests and integrated code review pass.
- [ ] Everything in `verify:` passes.
- [ ] No durable documentation is finalized until verified behavior is stable.
