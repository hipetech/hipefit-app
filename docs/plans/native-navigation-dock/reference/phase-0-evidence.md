---
type: reference
status: complete
area: navigation
created: 2026-08-05
---

# Phase 0 evidence

Records what was proven before implementation began, with the evidence each conclusion rests on.
Verified against the installed dependency versions, not documentation or memory.

## Gate 1 — hidden native tabs retain the native controller

**Proven.** `NativeTabs` accepts a public, documented `hidden?: boolean`:

- `node_modules/expo-router/build/native-tabs/types.d.ts` — `NativeTabsProps.hidden`, documented
  "When set to `true`, hides the tab bar."
- `node_modules/expo-router/build/native-tabs/NativeTabsView.ios.js:47` — forwards it to the host
  as `tabBarHidden`.
- `node_modules/react-native-screens/lib/typescript/components/tabs/host/TabsHost.types.d.ts` —
  `TabsHostPropsBase.tabBarHidden`, `@platform android, ios`.
- `node_modules/react-native-screens/ios/tabs/host/RNSTabsHostComponentView.mm:243-252` — applies
  it via `[_controller setTabBarHidden:animated:]` on iOS 18+, falling back to
  `_controller.tabBar.hidden`.

Both paths are public UIKit against the existing `UITabBarController`, which stays alive and keeps
owning tab selection, per-tab stacks, deep links, and state restoration. Nothing traverses,
subclasses, retains, or mutates a private `react-native-screens` view, and no second controller is
constructed. The plan's preferred integration therefore stands, and no architecture decision is
required.

## Gate 2 — repeated selection

With the native bar hidden there are no native tab-bar taps, so UIKit's own repeated-selection
side effects (`TabSelectedEvent.hasTriggeredSpecialEffect` in
`TabsHost.types.d.ts`) can no longer fire. Repeated selection becomes entirely the adapter's
decision rather than inherited behavior — which is exactly what the plan's follow-up decision asked
for.

**Decision: pop that tab's stack to root.** It matches what `UITabBarController` does today, so the
change is invisible to a user, and `settings/edit-profile` is currently the only screen deep enough
to notice. The adapter receives it as a distinct `onTabReselect` event so the behavior is explicit
in code rather than incidental.

## Gate 3 — content clearance

`setTabBarHidden:` removes the bar's own contribution to the safe area, so the measured
`TAB_BAR_CONTAINER_HEIGHT = 83` subtraction in
`features/floating-action-button/floating-action-button-metrics.ts` stops applying the moment the
bar is hidden. Clearance becomes wholly the dock's to report, which is why `contentClearance` in
the bridge contract is defined as a directly-addable value with no further arithmetic at the call
site.

Runtime verification of the final row on both the SwiftUI `List` screens and the Exercises
`LegendList` happens against the integrated build, before the measured constants are removed.

## Gate 4 — runtime coverage limits

Only **iOS 26.5** is installed locally:

```
iOS 26.5 (26.5 - 23F77) - com.apple.CoreSimulator.SimRuntime.iOS-26-5
```

There is no pre-iOS-26 simulator on this machine, so the `UIVisualEffectView` fallback material can
be compiled and reviewed but **cannot be visually verified here**. This is a known, disclosed gap
carried into the manual verification gate rather than a silent omission.

## Baseline

`bun run type-check` and `bun run lint` both pass on `main` before any dock work, so later failures
are attributable to this initiative.
