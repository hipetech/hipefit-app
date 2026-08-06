---
type: plan
status: in-progress
area: navigation
created: 2026-08-05
---

# Plan: native navigation dock

## Outcome

Replace the anchored SwiftUI `Menu` create affordance with an iOS-native action panel delivered by a
local Expo module: a Create `+` / close `x` button and an expanded native panel with a blocking
backdrop, while **the four tabs stay the real system tab bar** and Expo Router and UIKit remain the
source of truth for routes and per-tab navigation state.

### The requirement set, as finally settled

Three user directions arrived after this plan was written. They are stated here, at the top, because
each one reverses something the sections below still argue for.

1. **Use the native tab bar.** `NativeTabs` stays visible; UIKit owns selection, per-tab history,
   repeated selection, deep links and restoration. The four custom-drawn tab controls this plan
   opened with were built, then removed. Nothing in this initiative draws or routes a tab.
2. **The Create button matches the reference** ([`dock-expanded-reference.png`](reference/dock-expanded-reference.png),
   the Bevel app): a detached circle toggling `plus`/`xmark`, **beside** the tab bar, opening a
   rounded card of circular icon actions. Delivered by a fifth `role="search"` trigger — see
   Phase 4.6, which overturned this plan's rejection of that approach.
3. **No assistant pill.** Dropped entirely, not shipped unavailable.

Two structural consequences follow, and both reverse reasoning below:

- A sibling overlay **cannot measure the system tab bar** through public API, so React supplies the
  panel's offset through a `bottomInset` prop from
  [`navigation-dock-metrics.ts`](../../../features/navigation-dock/navigation-dock-metrics.ts). All
  of `features/floating-action-button/` is deleted; those measurements moved and shrank once the
  button became a tab bar item.
- **The native code does not live at `modules/hipefit-navigation-dock/`.** Every mention of that path
  below is authoring-time intent. At the user's direction it shipped as a workspace package at
  `packages/navigation-dock/`, consumed by name as `@hipefit/navigation-dock`; the current-state
  authority is [`architecture.md`](../../app/architecture.md#packages-the-local-native-boundary).

Sections below are superseded wherever they conflict with these three.
[`design-spec.md`](reference/design-spec.md) and [`bridge-contract.md`](reference/bridge-contract.md)
carry the shipped contract.

The implementation supports the app's current iOS 16.4 deployment target, adopts the public iOS 26
material where available, and uses a native material fallback on earlier systems. Development uses
`agent-device` for iterative simulator checks; after integration the initiative pauses for manual
user approval before the dedicated `qa-mobile` stage begins.

## Context

The tab layout at authoring time was a real Expo Router `NativeTabs` navigator with a separately
positioned SwiftUI create control — a `Menu` anchored to a floating circle — in
`features/floating-action-button/create-floating-action-button.tsx`. That file is **deleted**; it is
named without a link because a link to a path that no longer resolves is how a document turns into an
agent implementing the wrong thing. What survives is
[`app/(private)/_layout.tsx`](<../../../app/(private)/_layout.tsx>). The measured constants that file
depended on survive, smaller, as
[`navigation-dock-metrics.ts`](../../../features/navigation-dock/navigation-dock-metrics.ts). Current behavior is documented
in [`navigation.md`](../../app/navigation.md) and [`ui.md`](../../app/ui.md).

This initiative changes a shared native integration and global navigation entry point. It therefore
follows the substantial-feature lifecycle in [`docs/README.md`](../../README.md) and the layer
boundaries in [`architecture.md`](../../app/architecture.md).

The product behavior behind the visible controls is deliberately unchanged:

- **Create actions.** The native panel initially exposes the existing Start Workout, New Routine,
  and Custom Exercise actions, all still disabled. The native layout contract supports up to nine
  actions without making up six new product goals or destinations.
- **Assistant pill.** The pill is part of the navigation shell and is initially unavailable. Adding
  an AI conversation, prompt handling, persistence, or a destination is separate product work.
- **Routes and data.** This initiative creates no workout, routine, exercise, assistant, or
  Firestore behavior.

## Approach

### Ownership boundary

Expo Router continues to own the route tree, selected tab, deep links, auth guard, and each tab's
native `Stack`. A local iOS-only Expo module owns only presentation and interaction for the dock:

```text
NativeTabs (visible)               UIKit owns all five items, Create included
        │ tabPress on the Create trigger
        ▼
features/navigation-dock/          React adapter + store: expanded state,
        │ native props and events  descriptors, measured bottomInset
        ▼
packages/navigation-dock/          ExpoView + UIKit/native materials
        │ dismiss / actionPress
        └──────────────────────────► React adapter
```

**Superseded by requirement 1.** This plan proposed keeping `NativeTabs` mounted for its controller
while hiding its visual bar and routing semantic tab IDs through the adapter. Phase 0 proved that
integration works ([`phase-0-evidence.md`](reference/phase-0-evidence.md) gate 1) and it was built —
then the user directed that the real bar be used, which deletes the entire tab-routing path rather
than reconfiguring it. The dock is a sibling overlay that renders no tabs, reports no selection, and
holds no route knowledge; `features/navigation-dock/` calls Expo Router zero times.

### Native module

Create an iOS-only local module — shipped at `packages/navigation-dock/` as `@hipefit/navigation-dock`
— using the Expo Modules API. Its exported full-screen `ExpoView` contains the expanded surface; as of
Phase 4.6 it contains no button. The container passes touches through outside its controls while collapsed, captures
the full backdrop while expanded, and does not search for or mutate private `react-native-screens`
subviews.

The bridge contract is frozen before parallel implementation. As shipped, after requirements 1 and 3
removed the tab and assistant halves of it:

- Props: `expanded`, `actions` (descriptors with enabled state), `reduceMotion`, `colorScheme`, and
  `bottomInset`. ~~Selected tab ID, assistant availability.~~
- Events: `onDismissRequest`, `onActionPress`. ~~Tab press, repeated-tab press, assistant press~~,
  and ~~`onCreatePress`~~, which went away in Phase 4.6 with the button itself.
- ~~Metrics: native dock height and required content clearance, reported to React after layout.~~ The
  direction of this reversed: with the real tab bar there is nothing for the view to measure, so
  React sends the offset down instead of receiving it.
- Ownership: React owns expanded state and the descriptors; native code owns rendering, hit-testing,
  animation execution, native materials, and accessibility focus changes.

Swift receives semantic IDs rather than route strings, and no longer receives routes at all — the
adapter performs no navigation, so native code cannot invent or bypass URLs by construction.

Use public iOS 26 glass APIs behind availability checks. On iOS 16.4 through 25, use semantic colors
and `UIVisualEffectView` material. All interactive controls are native accessibility elements with
44pt-or-larger targets, Dynamic Type labels, correct tab/button traits, VoiceOver focus transfer,
escape dismissal, and Reduce Motion behavior.

### Layout and content clearance

**Reversed by requirement 1.** The dock was to be responsible for safe-area-aware geometry and to
report its occupied height upward, letting the adapter reserve clearance and the measured constants
be deleted. Keeping the system tab bar makes that impossible: there is no public API for the bar's
height or its minimize state, so the overlay has nothing to measure and the measured constants in
`floating-action-button-metrics.ts` are what position it. Clearance therefore did not move — the
existing `FLOATING_ACTION_BUTTON_CONTENT_INSET` still does the job, and no screen changed. Phase 0
still verified both bounded SwiftUI `List` screens and the `LegendList` exercise catalogue.

**Phase 4.6 then removed the problem rather than solving it.** Once Create became a tab bar item,
nothing floated over content any more, so `contentInsetAdjustmentBehavior` covers the whole bottom
edge on its own: the content-inset constant and the Exercises list's extra padding are both gone, and
so is the pinned circle diameter that was coupled to them. What survives is only the offset that
positions the panel.

The expanded surface is modal interaction state, not a route. Opening it blocks content and tab
interaction behind the backdrop; closing it restores focus to Create. Tab selection, app
backgrounding, sign-out, and successful action navigation all dismiss it.

### Rejected alternatives

- ~~**Detached `role="search"` tab.** It produces the desired separate circle on iOS 26, but remains
  a Search tab semantically, becomes an ordinary fifth tab before iOS 26, and requires a dummy route
  that programmatic navigation can still enter.~~ **Overturned in Phase 4.6 — this is what shipped.**
  Two of the three objections were answerable and one was accepted. Semantics: an explicit icon and
  label override the system ones, and the item is reported outside the four-tab group, so it
  presents and announces as Create. The dummy route: it exists, and it redirects, which is the guard
  the objection asked for. The pre-iOS-26 degradation is real and accepted, because the alternative
  — an overlay floating above the bar — could not produce the required placement on any version.
- **Module-owned `UITabBarController`.** It would duplicate Expo Router's selected-state,
  deep-link, auth, restoration, and independent-stack responsibilities.
- **Private `react-native-screens` traversal or tab-bar subclassing.** Attaching by implementation
  detail would make minor dependency upgrades a navigation risk.
- **A full-screen `@expo/ui` sibling alone.** It can render the panel but cannot robustly coordinate
  z-order, pass-through hit testing, and adaptive native tab geometry without returning to measured
  offsets.
- **Enabling or inventing destinations.** Navigation-shell work does not authorize workout,
  routine, custom-exercise, or assistant flows.

## Multi-agent execution model

Task frontmatter is the canonical status. Agents must not start a later phase because another task
looks nearly finished; the exit gate for the phase must be recorded first.

| Workstream             | Exclusive ownership                                                                                                                                              | May run in parallel with                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Native module          | `packages/navigation-dock/**` and its generated pod metadata                                                                                                     | Router adapter after the bridge contract is frozen             |
| Router adapter         | [`app/(private)/_layout.tsx`](<../../../app/(private)/_layout.tsx>), `features/navigation-dock/**`, and eventual removal of `features/floating-action-button/**` | Native module                                                  |
| Insets integration     | Only the explicitly assigned screen/list files that need clearance changes                                                                                       | Native module and Router adapter after metrics shape is frozen |
| Development validation | Read-only simulator/device evidence through `agent-device`                                                                                                       | Every implementation wave                                      |
| Documentation          | The durable documents named below                                                                                                                                | Final integration validation                                   |
| QA                     | Read-only `qa-mobile` pass                                                                                                                                       | Nothing until manual approval; fixes return to original owners |

One integration owner alone runs Pods and owns [`ios/Podfile.lock`](../../../ios/Podfile.lock). The
native worker must not edit the private route layout, the Router worker must not edit module files,
and the inset worker must not edit either ownership area.

Detailed handoff notes live under [`tasks/`](tasks/):

- [`build-native-module.md`](tasks/build-native-module.md)
- [`integrate-router.md`](tasks/integrate-router.md)
- [`integrate-content-clearance.md`](tasks/integrate-content-clearance.md)
- [`validate-during-development.md`](tasks/validate-during-development.md)
- [`reconcile-documentation.md`](tasks/reconcile-documentation.md)
- [`manual-verification-gate.md`](tasks/manual-verification-gate.md)
- [`qa-and-hardening.md`](tasks/qa-and-hardening.md)

## Documentation impact

- **Affected flows.** Update [`start-workout.md`](../../flows/start-workout.md) and
  [`create-routine.md`](../../flows/create-routine.md) because their global create entry point
  changes from an anchored menu to the native dock panel. Both must continue to state that their
  actions are disabled. No new flow is created for the unavailable assistant pill or Custom
  Exercise placeholder.
- **Affected shared systems.** Update [`navigation.md`](../../app/navigation.md) for the custom
  dock, Router/native ownership, dismissal rules, and clearance contract; update
  [`ui.md`](../../app/ui.md) for the native-view boundary, materials, hit testing, motion, and
  accessibility; update [`architecture.md`](../../app/architecture.md) to establish `packages/` as
  the local iOS native integration boundary.
- **New durable documents.** None. Navigation remains the right current-state home for the shared
  dock; the unavailable assistant is not yet a user journey.
- **Moved citations.** Removing `features/floating-action-button/` requires searching all docs and
  source comments for both file names and re-citing the replacement in the same change.
- **`AGENTS.md`.** No change is planned. The existing bare-workflow, iOS-only, documentation, and
  module boundaries already cover this work.

## Implementation phases

### Phase 0: freeze the contract and prove risky assumptions

- [~] Capture current screenshots, accessibility trees, tab behavior, and final-row clearance with
  `agent-device` before modifying navigation. **Not captured.** Implementation began before a
  baseline build existed, so the pre-change state is carried by
  `floating-action-button-metrics.ts` (which records the measured accessibility rects) and
  `navigation.md` instead. Post-integration evidence is captured in full to compensate.
- [x] Freeze semantic tab IDs, the three existing disabled action descriptors, assistant
      unavailable state, open/close rules, dimensions, size classes, and portrait support. →
      [`bridge-contract.md`](reference/bridge-contract.md), [`design-spec.md`](reference/design-spec.md)
- [x] Scaffold the local iOS Expo view module and prove autolinking on deployment target 16.4.
      `use_expo_modules!` is present in `ios/Podfile` and `modules/` is the default local-module
      directory, so no Podfile change is required.
- [x] Prove full-screen native pass-through hit testing when collapsed and backdrop capture when
      expanded. Contracted as a `hitTest` override; verified at runtime in Phase 2.
- [x] Prove hidden `NativeTabs` preserve all four tab stacks, deep linking, repeated selection, and
      auth transitions when driven by semantic events from the native dock. →
      [`phase-0-evidence.md`](reference/phase-0-evidence.md) gate 1
- [x] Prove native layout metrics can clear the final row of both SwiftUI `List` and `LegendList`.
      → [`phase-0-evidence.md`](reference/phase-0-evidence.md) gate 3
- [~] Verify iOS 26 material and the pre-iOS-26 fallback compile from the same Swift source.
  Specified as availability checks in one source; **compilation is confirmed in Phase 3**, and
  the fallback cannot be visually verified on this machine (no pre-26 runtime installed).
- [x] **Exit gate:** no ownership assumption failed. The preferred integration (hidden `NativeTabs`
      plus a sibling native overlay) is supported by public API on both sides, so no architecture
      decision is required and Phase 1 proceeds.

### Phase 1: freeze interfaces and start parallel foundations

**Outcome: complete.** The metrics half of the contract was published and then removed; see the
Approach note above.

- [x] Publish the final typed props, events, semantic IDs, and metrics contract in the native
      module bindings. → [`index.ts`](../../../packages/navigation-dock/index.ts)
- [x] Native-module agent begins [`build-native-module.md`](tasks/build-native-module.md).
- [x] Router agent begins [`integrate-router.md`](tasks/integrate-router.md) against the frozen
      contract, using a temporary adapter boundary until the native view lands.
- [x] Development validator begins
      [`validate-during-development.md`](tasks/validate-during-development.md) and reports evidence
      without editing either ownership area.
- [x] **Exit gate:** module and adapter compile independently and agree on every prop/event name.

### Phase 2: build the native interaction and integrate routing

**Outcome: complete, with the scope revision above.** The drawn tab capsule and the assistant pill
were built, then removed at the user's direction; tab routing through the adapter was removed with
them. Runtime evidence on iOS 26.5 (iPhone 17 Pro): the panel opens from Create and dismisses via
the backdrop, the Close button and every navigation; the three actions are inert and announce as
disabled; the whole background leaves the accessibility tree while expanded; touches pass through to
the list while collapsed; and the last row of the Exercises list clears the dock.

- [x] Native agent implements collapsed dock, ~~selected states, assistant placeholder,~~ Create
      control, backdrop, configurable action grid, open/close animations, accessibility, and
      availability-specific materials.
- [x] Router agent ~~derives selected tab, maps native tab events to Expo Router,~~ controls
      expansion, dismisses on lifecycle/navigation changes, and mounts the dock globally.
- [x] Insets owner applies native-reported clearance only where integration evidence shows it is
      required through
      [`integrate-content-clearance.md`](tasks/integrate-content-clearance.md); measured
      floating-button constants remain until parity is proven. **Superseded** — parity was never
      provable, so the constants stayed and no screen changed.
- [x] Run bounded `agent-device` checks after the collapsed dock, ~~tab routing,~~ expanded panel,
      and content-clearance milestones.
- [x] **Exit gate:** all four tabs, Create open/close, disabled actions, backdrop, and last-row
      clearance work in one development build.

### Phase 3: remove the old implementation and harden integration

**Outcome: complete, and partly undone by Phase 4.6.** `create-floating-action-button.tsx` was
deleted here and `floating-action-button-metrics.ts` survived, because the pivot had removed the
mechanism that would have replaced it. Pods were run once by the integration owner and
`ios/Podfile.lock` carries the autolinked `HipefitNavigationDock`. One design ruling was made here —
the Create circle **pinned to 60pt** rather than glyph-derived, knowingly relaxing this plan's "no
measured constants" rule, because `FLOATING_ACTION_BUTTON_CONTENT_INSET` was `91 + 60 + 12 − 83` and
a scaling circle would make that measured constant silently wrong. **Phase 4.6 deleted both the
ruling and the constant**: UIKit sizes the circle now. `bun run type-check`, `bun run lint`,
`bun run format:check` and an iOS development build all pass.

- [x] Remove the old floating-action-button component ~~and metrics~~ only after visual and
      behavioral parity is demonstrated. The metrics survived this phase by necessity, and were
      finally removed in Phase 4.6 with the directory around them.
- [x] Run Pods once under the integration owner and retain the authoritative lockfile change.
- [x] Review native lifecycle cleanup, retained view/controller risks, bridge event ordering,
      hit-testing, accessibility focus, and ~~route-state synchronization~~ (nothing to synchronize
      once the tabs went back to UIKit).
- [~] Run type-check, lint, formatting, an iOS development build, and a final pre-handoff
  `agent-device` smoke pass on the available iOS 26 and oldest supported simulator runtimes. All
  green on iOS 26.5; **the oldest supported runtime is not installed on this machine**, so that half
  did not run.
- [x] **Exit gate:** no known implementation blocker remains and the build is ready for durable
      documentation reconciliation.

### Phase 4: reconcile durable documentation

**Outcome: complete.** Seven durable documents updated: `navigation.md`, `ui.md`,
`architecture.md`, `database.md`, `start-workout.md`, `create-routine.md`, `log-workout.md`, plus
`docs/README.md`. No stale citation to the deleted component survives in source. Two knowingly
deferred items: `AGENTS.md` has no `modules/` entry in its Boundaries list now that local native code
is a real layer, and this plan directory still cites the deleted file as historical intent, which is
what `docs/plans/` is for.

- [x] Complete [`reconcile-documentation.md`](tasks/reconcile-documentation.md).
- [x] Verify every old floating-action-button citation is removed or redirected.
- [x] Confirm durable docs describe only shipped behavior: three disabled Create actions and ~~an
      unavailable assistant pill~~ no assistant at all.
- [x] **Exit gate:** code and every document under **Documentation impact** agree.

### Phase 4.5: reference-fidelity refinement

**Outcome: complete**, on user direction to refine the shipped code against the reference. Four
changes, each verified on iOS 26.5 in light and dark:

- [x] The backdrop became a **dimming scrim** instead of a full-screen `.systemUltraThinMaterial`.
      The blur obscured the screen where the reference de-emphasises it, and — the load-bearing half
      — glass renders by refracting its backdrop, so the card floating on a blurred screen had
      nothing to sample and stopped reading as a surface. Dimming is what makes the glass look like
      glass.
- [x] Panel padding became **asymmetric** (18pt vertical, 10pt horizontal) with tighter column
      spacing, so each column takes close to a third of the card as it does in the reference.
      Symmetric padding costs ~12pt a column, which is what wrapped a two-word label at the default
      text size.
- [x] Action labels are **semibold**, built from the resolved preferred descriptor so `.caption1`
      Dynamic Type scaling survives the weight change.
- [x] Opening the panel fires `hapticImpact()`. Closing, the backdrop, the escape gesture and the
      actions stay silent.
- [x] **Exit gate:** `type-check`, `lint`, `format:check` and an iOS development build pass, and the
      expanded panel was re-captured in both appearances.

### Phase 4.6: the Create button moves into the tab bar

**Outcome: complete.** The user rejected the button floating above the bar and required the
reference placement — beside it. Phase 4.5 had recorded that as unreachable with the system tab bar.
**That was wrong**, and the correction is the largest structural change since the pivot:

- [x] Create is a fifth `NativeTabs.Trigger` with `role="search"`, which is how iOS 26 renders a
      detached circle beside the tab bar capsule. Verified: the capsule shrinks and the circle sits
      vertically centred on it, matching the reference.
- [x] `disabled` prevents selection; the press still arrives as `tabPress` with `isPrevented: true`.
      Verified in the log and in the tree — tapping it never changes the selected tab.
- [x] Explicit icon and label override the system magnifying glass, so it presents and announces as
      Create / Close. The accessibility tree shows it as a sibling of the four-tab capsule inside
      `[tab-bar]`, never `[selected]`.
- [x] [`app/(private)/create.tsx`](<../../../app/(private)/create.tsx>) added: a trigger must name a
      route, and `disabled` does not stop programmatic navigation, so it redirects to Home.
- [x] `expanded` lifted into
      [`use-navigation-dock-store.ts`](../../../features/navigation-dock/store/use-navigation-dock-store.ts),
      because the button and the panel are now mounted in different trees.
- [x] The native view lost `DockCreateControl`, the `onCreatePress` event and `createDiameter`. It
      is the panel and the scrim only.
- [x] The backdrop covers and blocks the whole screen and **draws nothing**: expanded is fully modal
      and completely invisible. Four revisions on user review got here — a full-screen blur (which
      starved the glass card), a black dimming scrim, then two wrong geometries (dimming stopping at
      the tab bar left a bright band; touches stopping there left a bar that silently navigated), and
      finally the shade removed altogether because the reference leaves the screen behind the card
      alone. A tap outside the card only ever dismisses.
- [x] `features/floating-action-button/` **deleted**. Its surviving measurements moved to
      [`navigation-dock-metrics.ts`](../../../features/navigation-dock/navigation-dock-metrics.ts),
      smaller: the content-inset constant is gone, because nothing floats over content any more. The
      Exercises list dropped its extra bottom padding; verified the last row still clears.
- [x] **Exit gate:** `pod install` (a Swift file was deleted), `type-check`, `lint`, `format:check`
      and an iOS build pass; light, dark and accessibility XXXL re-captured.

Two costs, both accepted rather than hidden:

- **Pre-iOS 26 the circle is not detached** — a search-role item is an ordinary fifth item inside the
  bar. Unverified; no pre-26 runtime is installed.
- **The glyph swaps instead of cross-fading.** A tab bar item cannot animate between two images.
- **VoiceOver cannot reach Close while the panel is open**, because `accessibilityViewIsModal` hides
  the tab bar the button now belongs to. The escape gesture is the route, and QA must tap the circle
  by coordinate rather than by accessibility query.

### Phase 5: mandatory manual verification gate

- [ ] Complete the development checks in
      [`manual-verification-gate.md`](tasks/manual-verification-gate.md).
- [ ] Deliver the development build plus a concise manual checklist to the user.
- [ ] Pause all progression. Do not spawn `qa-mobile`, begin formal QA, or mark this plan completed.
- [ ] Record explicit user approval to continue to QA.

### Phase 6: dedicated QA after user approval

- [ ] Only after explicit approval, spawn the read-only `qa-mobile` agent and execute
      [`qa-and-hardening.md`](tasks/qa-and-hardening.md).
- [ ] Route defects back to the original native, Router, or inset owner; keep file ownership
      disjoint while fixes run in parallel.
- [ ] Re-run targeted `agent-device` checks after fixes, then ask `qa-mobile` for focused retests.
- [ ] Complete the final code review and required command gates.
- [ ] Mark task notes done and this plan completed only when implementation, durable docs, manual
      approval, and QA evidence agree.

## Verification

```bash
pod install --project-directory=ios
bun run type-check
bun run lint
bunx prettier --write <files-touched>
bun run format:check
bun run ios:development
```

Development-time `agent-device` checks cover:

- four-tab switching, selected state, repeated selection, and retained stack depth — now the system
  tab bar's own behavior, checked rather than implemented;
- Create `+` to `x`, backdrop/escape dismissal, and blocked touches behind the expanded panel;
- disabled action behavior;
- last-row clearance on every tab;
- light/dark appearance, Dynamic Type, Reduce Motion, VoiceOver labels/traits/focus;
- iOS 26 material and the oldest available supported-runtime fallback.

The dedicated `qa-mobile` acceptance pass is intentionally excluded until Phase 5 receives explicit
user approval.

## Acceptance criteria

Rewritten for the shipped scope. The two criteria this plan opened with — custom tab controls and an
assistant pill — are struck rather than deleted, so the record shows they were dropped by decision
rather than quietly missed.

- [x] The four tabs navigate, reflect selection and preserve each tab's Stack state. Delivered by
      the **real system tab bar**, unchanged by this work, which is why it is met by construction.
- [x] Create is an independent button, never exposed as a Search tab or carrying a selected-tab
      trait. It **is** a `role="search"` trigger — the rejection of that approach elsewhere in this
      plan was overturned in Phase 4.6 — but `disabled` plus an explicit icon and label make it
      behave and announce as a button. Verified in the accessibility tree: `[button] "Create"`,
      outside the four-tab group, never `[selected]`.
- [x] The Create circle sits **beside** the tab bar, as the reference shows, on iOS 26.
- [x] Opening Create presents the native panel and blocking backdrop; Close, backdrop tap and any
      navigation dismiss it. Verified at runtime. App-backgrounding and sign-out dismissal are wired
      and reviewed but **not exercised on device** — they are on the manual checklist.
- [x] The three existing actions remain visible and disabled, and the grid accepts up to nine typed
      descriptors without native route knowledge. Verified: taps are inert, VoiceOver announces
      `[disabled]`.
- [x] No content or final list row is obscured, verified on Home, Workouts, Exercises and Settings
      at default text size and on Exercises at accessibility XXXL.
- [x] The expanded surface matches [`design-spec.md`](reference/design-spec.md) — dimming scrim,
      thirds-width columns, semibold labels, glass card — with the one reference property the system
      tab bar makes unreachable named there rather than quietly missed. Captured in light and dark on
      iOS 26.5.
- [~] iOS 26 uses the public glass material — **verified on 26.5**. The iOS 16.4–25
  `UIVisualEffectView` fallback compiles from the same source but is **unverified**: no pre-26
  runtime exists on this machine.
- [~] VoiceOver, Dynamic Type, Reduce Motion, hit targets and focus restoration are implemented and
  code-reviewed. Verified at runtime: modality (the background leaves the accessibility tree),
  disabled announcement, Dynamic Type to accessibility XXXL. **Unverified:** a real VoiceOver
  pass, Reduce Motion, and focus restoration — including the known caveat that focus may land on
  Create for an instant during a forced sign-out.
- [x] Every document named under **Documentation impact** is updated and all removed paths re-cited.
- [ ] The user manually approves the integrated build before `qa-mobile` starts. ← **current gate**
- [ ] Dedicated QA findings are resolved or explicitly accepted after the manual gate.

Dropped by user direction, not by omission:

- ~~Four custom-drawn dock tab controls driven through Expo Router by semantic ID.~~
- ~~The assistant pill is visibly and accessibly unavailable.~~

## Non-goals

- Implementing workout execution, routine creation, custom-exercise creation, or any Firestore
  writes.
- Implementing an AI assistant journey or making the assistant pill interactive.
- Inventing six additional actions solely to fill a 3×3 screenshot.
- Replacing Expo Router, moving route ownership into Swift, or constructing a second
  `UITabBarController`.
- Using private UIKit or `react-native-screens` internals.
- Reviving Android or adding Android fallbacks.
- Adding an automated test runner.

## Follow-up decisions

- **Final nine-action inventory.** Add actions only when each has a named user goal, availability
  state, icon, and destination; the current implementation starts with the existing three.
- **Assistant destination.** A future assistant journey requires its own product scope and flow
  document before the pill becomes enabled.
- **Repeated-tab behavior.** Phase 0 records current native behavior and chooses pop-to-root,
  scroll-to-top, or no-op explicitly rather than changing it accidentally.
- **Non-phone size classes and rotation.** The first implementation targets the app's supported
  iPhone portrait experience; broader size-class support requires measurements and acceptance
  criteria before expansion.
