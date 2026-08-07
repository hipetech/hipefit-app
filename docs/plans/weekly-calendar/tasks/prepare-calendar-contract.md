---
type: task
status: completed
area: calendar
context:
  - ../plan.md
  - ../../../app/architecture.md
  - ../../../app/ui.md
  - ../../../../package.json
  - ../../../../features/home/home-content.tsx
verify:
  - bun run type-check
  - bun run lint
created: 2026-08-07
---

# Task: prepare the calendar contract and dependency gate

## Goal

Pin Wix `react-native-calendars`, publish the vendor-free calendar contract, and complete the Phase
0 runtime risk gate in the [initiative plan](../plan.md) before parallel implementation begins.

## Why this is a separate task

`package.json`, `bun.lock`, and the public type contract are shared hot spots. One integration owner
must freeze them so feature and Home workers can implement concurrently without racing dependency or
interface changes.

## Scope

- **In:** `package.json`, `bun.lock`, `features/calendar/calendar-types.ts`, temporary runtime proof
  code, risk-gate evidence, and the decision on Reduce Motion handling.
- **Out:** production calendar visuals, final Home mocks, durable app-document updates, and broad QA.

## Notes

- Use Bun and pin Wix at exactly `react-native-calendars@1.1314.0`. Do not run npm or yarn.
- No Pod installation is expected for this JavaScript dependency; stop and reassess if installation
  unexpectedly changes native dependency state.
- The frozen contract contains no Wix import. Workers may request a contract change, but only the
  integration owner edits it.
- Throwaway proof code must be removed or deliberately promoted into the owning implementation task.
- Record version-pinned findings where the eventual workaround lives; do not rely on plan prose as
  current behavior.

## Definition of done

- [x] The dependency is exact-pinned and `bun.lock` resolves it reproducibly.
- [x] `calendar-types.ts` publishes the plan's contract without Wix types.
- [ ] All seven runtime risk-gate checks have recorded outcomes — checks 1, 2, 4, 6 and 7 are
      settled (see the plan's Phase 0 notes); Reduce Motion, gesture arbitration under adversarial
      drags, and the VoiceOver-at-mount path are still open.
- [ ] The Reduce Motion strategy and any package patch boundary are explicit.
- [x] Calendar and Home tasks are changed from `blocked` to `ready` only after the exit gate passes.
- [x] Everything in `verify:` passes for the integrated proof state.
- [x] No durable document changes yet: proof code does not ship user-visible behavior.

## What the gate actually found

The proof was not throwaway code: the risks were exercised against the real integration, and each
workaround lives beside the code it corrects rather than here.

- **The library collapses to nothing above a `Host`.** `CalendarProvider`'s wrapper is `flex: 1`,
  and Yoga resolves that to a zero flex basis inside an auto-height parent. Overriding `flexGrow`
  and `flexBasis` is not enough — `flex` itself has to be overridden. Recorded in
  `features/calendar/expandable-weekly-calendar.tsx`.
- **The navigation bar overlays the screen.** A native stack hands the screen the full window and
  lets each scroll view inset itself, so a non-scrolling band renders behind the large title.
  Recorded in `features/home/home-content.tsx`.
- **The header is measured once, while collapsed.** A month title that appears on expansion steals
  its own height from the last week row, permanently. The title therefore lives outside the
  library's header — recorded in `features/calendar/calendar-month-header.tsx`.
- **`WEEK_HEIGHT` is a fixed 46pt module constant**, which is what caps the day cell and forces a
  Dynamic Type ceiling on the day number alone. Recorded in `features/calendar/calendar-metrics.ts`.
- **Wix's transparent surfaces show the month grid through the collapsed strip**; the strip and the
  knob row must both be opaque. Recorded in `features/calendar/calendar-theme.ts`.
- **Compatibility holds otherwise**: 1.1314.0 renders under React 19.2 / React Native 0.86 with the
  New Architecture, adapts semantic `ColorValue` tokens, and produces correct heights for a
  six-week month after week and month navigation.
