---
type: task
status: done
area: navigation
context:
  - ../plan.md
  - ../../../app/architecture.md
  - ../../../app/navigation.md
  - ../../../app/ui.md
  - ../../../flows/start-workout.md
  - ../../../flows/create-routine.md
  - ../../../../app/(private)/_layout.tsx
  - ../../../../features/floating-action-button/floating-action-button-metrics.ts
verify:
  - bun run type-check
  - bun run lint
created: 2026-08-05
---

# Task: integrate the native dock with Expo Router

> **Outcome: done, with most of this task dropped.** `NativeTabs` is NOT hidden — the visual tab
> bar stayed, so UIKit kept tab selection, per-tab stacks and repeated selection, and the semantic-ID
> route mapping described below was written and then deleted. What shipped is the controlled
> `expanded` state, the three disabled action descriptors and the dismissal wiring.

## Goal

Mount the native dock globally, keep Expo Router authoritative for all route state, and connect the
frozen semantic bridge events to the existing four tab routes without introducing a dummy action
route.

## Why this is a separate task

The Router adapter and private layout are independent from the Swift implementation after the
bridge contract is fixed, so they can be implemented by a separate worker without touching module
files.

## Scope

- **In:** [`app/(private)/_layout.tsx`](<../../../../app/(private)/_layout.tsx>), new
  `features/navigation-dock/**`, selected-tab derivation, controlled expanded state, lifecycle
  dismissal, route mapping, and global mounting.
- **Out:** `packages/navigation-dock/**`, native visual details, unrelated routes, action
  destinations, Firestore, and final durable documentation prose.

## Notes

- Prefer retaining hidden `NativeTabs` so each existing child Stack remains native and preserves
  history. Phase 0 is a hard proof gate; do not silently fall back to a different navigator.
- Swift receives semantic IDs only. This adapter is the sole place those IDs become Expo Router
  destinations.
- Repeated tab selection must match the Phase 0 decision rather than acquiring incidental behavior.
- The assistant press and all three action presses remain unavailable and must not navigate.
- Keep the old floating action button and its content-clearance constants until the native dock and
  metrics path have passed integration checks; remove them only in Phase 3.

## Definition of done

- [ ] All four native dock controls select the correct existing tab and reflect Router state.
- [ ] Per-tab Stack state, deep links, auth transitions, and the chosen repeated-tab behavior are
      preserved.
- [ ] Expanded state dismisses on close, backdrop, escape, tab change, app backgrounding, and
      sign-out.
- [ ] The assistant and three create actions remain truthfully unavailable.
- [ ] Everything in `verify:` passes.
- [ ] This task remains in review until the documentation task updates
      [`navigation.md`](../../../app/navigation.md), [`ui.md`](../../../app/ui.md),
      [`architecture.md`](../../../app/architecture.md),
      [`start-workout.md`](../../../flows/start-workout.md), and
      [`create-routine.md`](../../../flows/create-routine.md) to match the integrated behavior.
