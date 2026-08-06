---
type: task
status: done
area: navigation
context:
  - ../plan.md
  - ../../../app/architecture.md
  - ../../../app/navigation.md
  - ../../../app/ui.md
  - ../../../../features/floating-action-button/floating-action-button-metrics.ts
  - ../../../../ios/Podfile
verify:
  - bun run type-check
  - bun run lint
created: 2026-08-05
---

# Task: build the native navigation dock module

> **Outcome: done, with reduced scope.** The tab capsule, the assistant pill and the self-measured
> layout metrics described below were built and then removed at the user's direction. The module
> ships the Create button, its action panel and the backdrop only, and takes the vertical offset as
> a `bottomInset` prop because a sibling overlay cannot measure the system tab bar. It also does not
> live at `modules/` — it shipped as a workspace package at `packages/navigation-dock/`
> (`@hipefit/navigation-dock`).

## Goal

Implement the iOS-only local Expo view module defined by the
[`native navigation dock plan`](../plan.md), including its native presentation, bridge contract,
hit testing, layout metrics, materials, motion, and accessibility behavior.

## Why this is a separate task

The module is an isolated native ownership area that can be built in parallel with the Router
adapter once the prop/event contract is frozen. One agent owns the entire module directory so Swift
and TypeScript bindings cannot drift between workers.

## Scope

- **In:** `packages/navigation-dock/**`, generated local-module pod metadata, native view
  lifecycle, native presentation, native-to-React events, and native layout metrics.
- **Out:** route strings, Expo Router calls, private route layout changes, screen content insets,
  action destinations, and durable documentation edits.

## Notes

- Support iOS 16.4+ from one source; gate iOS 26 material APIs with availability checks.
- React owns canonical selected-tab and expanded state. Native code must animate prop changes and
  report semantic events without embedding route names.
- While collapsed, the full-screen view passes through touches outside its controls. While
  expanded, the backdrop blocks interaction and restores VoiceOver focus to Create on dismissal.
- The native module must not traverse, retain, subclass, or mutate `react-native-screens` internals.
- The three supplied actions remain disabled. The grid API accepts up to nine descriptors.
- The integration owner, not this worker, owns the final `ios/Podfile.lock` change.

## Definition of done

- [ ] Module autolinks and compiles for the development scheme at deployment target 16.4 after the
      integration owner performs the required Pod installation.
- [ ] The frozen props/events/metrics contract is typed consistently in Swift and TypeScript.
- [ ] Collapsed and expanded native views implement required materials, layout, hit testing,
      accessibility, Dynamic Type, and Reduce Motion behavior.
- [ ] The view reports occupied-height changes without fixed device-specific offsets.
- [ ] Everything in `verify:` passes after integration.
- [ ] No durable document changes independently: the module is not user-visible until the Router
      integration lands, and reconciliation is owned by the dedicated documentation task.
