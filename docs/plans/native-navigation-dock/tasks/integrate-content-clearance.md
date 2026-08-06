---
type: task
status: superseded
area: navigation
context:
  - ../plan.md
  - ../../../app/navigation.md
  - ../../../app/ui.md
  - ../../../../app/(private)/exercises/index.tsx
  - ../../../../features/home/home-content.tsx
  - ../../../../features/workouts/workouts-content.tsx
  - ../../../../features/settings/settings-content.tsx
  - ../../../../features/floating-action-button/floating-action-button-metrics.ts
verify:
  - bun run type-check
  - bun run lint
created: 2026-08-05
---

# Task: integrate native dock content clearance

> **Outcome: superseded — no screen was changed.** This task assumed the dock would report its own
> metrics. The pivot to the real system tab bar removed `onMetricsChange`, so clearance reverted to
> the existing `FLOATING_ACTION_BUTTON_CONTENT_INSET` constant and every screen was left untouched.
> The Exercises change made under this task was reverted. Clearance was verified at runtime on all
> four screens, including at accessibility XXXL text.

## Goal

Verify every scrolling surface against the native-reported dock metrics and make only the
screen-local clearance changes that runtime evidence proves necessary.

## Why this is a separate task

The candidate screens are disjoint from the native module and Router adapter ownership areas, so a
third implementation worker can handle list clearance without creating merge conflicts.

## Scope

- **In:** [`app/(private)/exercises/index.tsx`](<../../../../app/(private)/exercises/index.tsx>) and
  the Home, Workouts, and Settings feature content files named in `context:`; final-row clearance,
  scrollability, and removal of obsolete screen-local floating-button padding after parity.
- **Out:** the private tab layout, `features/navigation-dock/**`, native module files, tab routing,
  dock metrics production, or unrelated list styling.

## Notes

- Start only after the native metrics event and React consumption API are frozen.
- Prefer navigator-level clearance owned by the Router adapter. If it handles a screen correctly,
  record evidence and leave that screen unchanged.
- SwiftUI `List` and `LegendList` have different sizing/inset behavior; verify each rather than
  applying one formula everywhere.
- Preserve measured constants until the new metrics path has runtime parity, then coordinate their
  final removal with the Router owner.

## Definition of done

- [ ] The final actionable row on Home, Workouts, Exercises, and Settings remains visible and
      tappable above the collapsed dock and assistant pill.
- [ ] Opening and closing the action panel does not jump, truncate, or permanently change scroll
      extent.
- [ ] Every screen-local edit is backed by `agent-device` geometry or interaction evidence; screens
      already handled by navigator-level clearance remain untouched.
- [ ] Obsolete Exercises floating-button padding is removed only after native-metrics parity.
- [ ] Everything in `verify:` passes.
- [ ] No durable documentation changes independently: the navigation and UI contracts are updated
      by the documentation task after all screen behavior is stable.
