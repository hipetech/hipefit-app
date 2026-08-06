---
type: task
status: ready
area: navigation
context:
  - ../plan.md
  - ../../../app/navigation.md
  - ../../../app/ui.md
  - ../../../../app/(private)/_layout.tsx
verify:
  - bun run type-check
  - bun run lint
  - bun run format:check
  - bun run ios:development
created: 2026-08-05
---

# Task: pause for manual navigation verification

## Goal

Deliver a verified development build and a focused checklist to the user, then pause the initiative
until the user explicitly approves beginning dedicated QA.

## Why this is a separate task

The user requested a hard manual checkpoint before `qa-mobile`. Treating it as its own task keeps an
agent from interpreting successful automated or simulator checks as permission to proceed.

## Scope

- **In:** final pre-handoff command gates, development build availability, checklist delivery,
  collection of user feedback, and explicit approval status.
- **Out:** spawning `qa-mobile`, formal QA, broad defect fixes, or marking the initiative completed.

The final development validation uses a fresh `open --relaunch`, current `snapshot -i` refs, settled
interaction diffs, explicit expectation checks, and a closed session. Screenshots support visual
review but do not replace an interaction assertion.

## Manual checklist

- Native dock geometry and material on iOS 26.
- Pre-iOS-26 material fallback on the oldest available supported simulator.
- Four-tab switching, selected state, repeated selection, and retained Stack state.
- Create `+` / `x`, panel presentation, backdrop and escape dismissal, and blocked background taps.
- Three disabled actions and the visibly unavailable assistant pill.
- Final-row clearance on Home, Workouts, Exercises, and Settings.
- Light/dark mode, large Dynamic Type, Reduce Motion, and VoiceOver focus/announcements.

## Definition of done

- [ ] Everything in `verify:` passes before handoff.
- [ ] The development build and checklist are delivered to the user.
- [ ] User findings are recorded and resolved or explicitly accepted.
- [ ] The user explicitly approves continuing to dedicated QA.
- [ ] `qa-mobile` has not been spawned before that approval.
- [ ] No durable documentation changes: documentation reconciliation must already be complete before
      this gate begins.
