---
type: task
status: done
area: navigation
context:
  - ../plan.md
  - ../../../app/navigation.md
  - ../../../app/ui.md
  - ../../../../app/(private)/_layout.tsx
  - ../../../../features/floating-action-button/floating-action-button-metrics.ts
verify:
  - bun run ios:development
created: 2026-08-05
---

# Task: validate the dock during development

## Goal

Use `agent-device` for bounded, repeatable simulator checks throughout implementation and report
runtime evidence to the owning worker before defects become integration problems. This is
development validation, not the dedicated `qa-mobile` acceptance stage.

## Why this is a separate task

The validator is read-only and can run alongside native and Router implementation without creating
file conflicts. It provides screenshots, accessibility trees, and reproduction steps rather than
making code changes.

## Scope

- **In:** baseline capture; collapsed dock; tab routing; expanded surface; hit testing; content
  clearance; appearance, motion, and accessibility smoke checks on available simulators.
- **Out:** code edits, final acceptance QA, product approval, or progression past the manual gate.

## Notes

- Capture the pre-change state before implementation and keep device/runtime identifiers with the
  evidence.
- Follow the installed CLI's validation loop: build the current app, open the development bundle
  with `--relaunch` in a purpose-specific session, run `snapshot -i`, drive controls through refs
  from the latest snapshot or settled diff, and verify named expectations with `wait`, `get`, `is`,
  `find`, or the settled diff rather than a screenshot alone.
- Close each device session after its bounded pass so later agents do not inherit hidden state.
- Report exact reproduction steps and affected ownership area: native module, Router adapter, or
  screen inset.
- Do not invoke `qa-mobile`; that role is reserved for the stage after explicit user approval.

## Definition of done

- [ ] Baseline screenshots and accessibility geometry are recorded before navigation changes.
- [ ] Each Phase 2 milestone receives a focused simulator pass with evidence.
- [ ] Available iOS 26 and oldest-supported runtimes are checked before manual handoff.
- [ ] Reports include exact commands, target simulator and bundle, pass/fail observations, artifact
      paths when captured, and session cleanup status.
- [ ] Tab retention, `+` / `x`, dismissal, blocked background touches, disabled actions, assistant
      state, final-row clearance, VoiceOver labels/traits, Dynamic Type, and Reduce Motion have
      development evidence.
- [ ] No durable documentation changes: this task observes proposed behavior and does not ship it.
