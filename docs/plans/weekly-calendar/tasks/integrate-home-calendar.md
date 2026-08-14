---
type: task
status: in-progress
area: home
context:
  - ../plan.md
  - ../../../app/architecture.md
  - ../../../app/code-style.md
  - ../../../app/ui.md
  - ../../../../features/home/home-content.tsx
  - ../../../../theme/styles.ts
verify:
  - bun run type-check
  - bun run lint
  - bunx prettier --check features/home
created: 2026-08-07
---

# Task: integrate calendar mocks on Home

## Goal

Make Home own deterministic calendar mocks and controlled selection, then place the independent
calendar feature above the existing SwiftUI list using sibling RN and Host islands.

## Why this is a separate task

Home layout and mock ownership do not overlap the calendar adapter directory, so this work can run
in parallel after the feature contract is frozen.

## Scope

- **In:** `features/home/home-content.tsx`, `features/home/home-calendar-mocks.ts`, Home-only RN layout
  styles, controlled mock selection, and the calendar feature call site.
- **Out:** Wix imports, `features/calendar/**`, route files, production workout data, stores,
  Firestore, and durable documentation.

## Notes

- You are not alone in the worktree. Preserve other agents' edits and format only owned files.
- Import only Hipefit's feature component and contract. A Wix import in Home fails the boundary.
- Keep the existing SwiftUI `List` at the root of a real flex-sized `Host`; do not put it inside an
  RN `ScrollView` and do not nest a Host.
- Expansion must change flex layout and push the list down. It must not overlay or dynamically resize
  through `RNHostView`.
- Mock selection changes no Activity, routine, or recent-workout content.

## Definition of done

- [ ] Home passes deterministic mock markers covering 0, 1, 2, 3, and overflow states.
- [ ] Home owns `selectedDateId` and changes it only from `onDatePress`.
- [ ] The calendar is an RN sibling of the existing Host and the route remains thin and unchanged.
- [ ] Existing Home loading, empty, counter, routine, and recent-workout behavior is preserved.
- [ ] Everything in `verify:` passes after integration with the concurrently built feature work.
- [ ] No durable document changes independently: the documentation worker owns final reconciliation.
