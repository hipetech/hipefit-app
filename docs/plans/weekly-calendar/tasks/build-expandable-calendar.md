---
type: task
status: in-progress
area: calendar
context:
  - ../plan.md
  - ../../../app/code-style.md
  - ../../../app/ui.md
  - ../../../../features/home/home-content.tsx
  - ../../../../ui/text.tsx
  - ../../../../theme/colors.ts
verify:
  - bun run type-check
  - bun run lint
  - bunx prettier --check features/calendar
created: 2026-08-07
---

# Task: build the expandable calendar feature

## Goal

Implement the isolated Wix adapter and every calendar-owned visible component under
`features/calendar/`, against the contract and risk decisions frozen by
[`prepare-calendar-contract.md`](prepare-calendar-contract.md).

## Why this is a separate task

The feature directory is an exclusive ownership area that can be developed in parallel with Home
mock integration once the public contract is stable.

## Scope

- **In:** Wix provider/adapter wiring, custom weekday/month/day/dot components, pure mapping helpers,
  semantic theme, accessibility, controlled selection, visible-period state, and expanded-state
  behavior under `features/calendar/` except the integration-owned type file.
- **Out:** `features/home/**`, package manifests and lockfiles, stores, Firebase, routes, durable docs,
  and changes to the frozen contract.

## Notes

- You are not alone in the worktree. Preserve other agents' edits and format only owned files.
- One component per file; pure calculations belong in exported helper modules.
- Never re-export Wix props or types. Never import a store.
- Default Wix day/header text is not acceptable because it disables font scaling. Hide or replace
  every visible occurrence.
- Page scroll and arrows update visibility only. Only a day press may invoke `onDatePress`.
- Derive the selected marking from the controlled prop and render that marking rather than trusting
  Wix's transient selected state.
- Apply the Phase 0 Reduce Motion decision exactly; do not invent a second workaround.

## Definition of done

- [ ] All Wix imports remain within `features/calendar/`.
- [ ] Collapsed, expanded, selected, marked, overflow, and accessibility states are implemented from
      the frozen props.
- [ ] The custom visible typography scales and every day is one 44pt-or-larger accessible button.
- [ ] Week/month navigation never calls the selection callback.
- [ ] The normal expandable path and Wix's VoiceOver-at-mount accessible path expose consistent
      selection, marker counts, and navigation semantics.
- [ ] Everything in `verify:` passes after integration with the concurrently built Home work.
- [ ] No durable document changes independently: the documentation worker owns final reconciliation.
