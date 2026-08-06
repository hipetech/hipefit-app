---
type: reference
status: frozen
area: navigation
created: 2026-08-05
---

# Native dock bridge contract

> **Revisions — user direction, 2026-08-05.** Two passes shrank this bridge; the sections below are
> superseded where they conflict.
>
> **Pass 1 — the four tabs became the real system tab bar and the assistant was dropped.**
>
> - **Removed props:** `tabs`, `selectedTabId`, `assistant`.
> - **Removed events:** `onTabPress`, `onTabReselect`, `onAssistantPress`, `onMetricsChange`.
> - **Metrics section below no longer applies.** The module reports nothing; the direction reversed,
>   and React sends an offset down instead.
>
> **Pass 2 — the Create button became a `role="search"` tab bar item**, so it left this view
> entirely.
>
> - **Removed event:** `onCreatePress`. The press is now a `tabPress` on the trigger in
>   `app/(private)/_layout.tsx`, and `expanded` lives in
>   `features/navigation-dock/store/use-navigation-dock-store.ts`.
>
> **The bridge as shipped:**
>
> - **Props:** `expanded`, `actions`, `reduceMotion`, `colorScheme`, and `bottomInset: number` — the
>   distance from the bottom of the screen to the top of the tab bar, supplied by React from
>   `NAVIGATION_DOCK_BOTTOM_INSET`. A sibling overlay cannot measure the system tab bar through
>   public API, so this is passed in rather than self-measured, and the module must not walk the
>   hierarchy looking for a `UITabBar`.
> - **Events:** `onDismissRequest`, `onActionPress`.
>
> Semantic tab IDs are no longer part of the bridge. The action IDs are unchanged.

Frozen Phase 1 deliverable. The native module and the Router adapter are built in parallel against
this file; neither worker may rename a prop or event unilaterally. Changes go through the
integration owner.

## Ownership

| Concern                                                     | Owner  |
| ----------------------------------------------------------- | ------ |
| Expanded state, action wiring, the measured offset          | React  |
| Rendering, hit testing, animation, materials, accessibility | Native |

Native code receives **semantic IDs only**. It never sees a route string and never calls Expo
Router — and as of pass 2 the adapter does not either.

## Semantic IDs

Tab IDs are frozen as `home`, `workouts`, `exercises`, `settings`. The adapter in
`features/navigation-dock/` is the sole place these become Expo Router destinations:

| ID          | Route                  |
| ----------- | ---------------------- |
| `home`      | `/(private)/(home)`    |
| `workouts`  | `/(private)/workouts`  |
| `exercises` | `/(private)/exercises` |
| `settings`  | `/(private)/settings`  |

Action IDs are frozen as `start-workout`, `new-routine`, `custom-exercise`. All three ship
`enabled: false`.

## Props

```ts
export interface NavigationDockTab {
  id: string;
  label: string;
  /** SF Symbol name for the unselected state. */
  systemImage: string;
  /** SF Symbol name for the selected state; falls back to `systemImage`. */
  selectedSystemImage?: string;
}

export interface NavigationDockAction {
  id: string;
  label: string;
  systemImage: string;
  enabled: boolean;
}

export interface NavigationDockAssistant {
  placeholder: string;
  enabled: boolean;
}

export interface NavigationDockViewProps {
  tabs: NavigationDockTab[];
  /** Must match one `tabs[].id`. Native renders selection; it never chooses it. */
  selectedTabId: string;
  expanded: boolean;
  /** At most nine. Native renders three per row in descriptor order. */
  actions: NavigationDockAction[];
  assistant: NavigationDockAssistant;
  reduceMotion: boolean;
  /** `null` follows the device. Applied as `overrideUserInterfaceStyle`. */
  colorScheme: 'light' | 'dark' | null;
  onTabPress: (event: { nativeEvent: { id: string } }) => void;
  onTabReselect: (event: { nativeEvent: { id: string } }) => void;
  onCreatePress: () => void;
  onDismissRequest: (event: {
    nativeEvent: { reason: 'backdrop' | 'escape' };
  }) => void;
  onAssistantPress: () => void;
  onActionPress: (event: { nativeEvent: { id: string } }) => void;
  onMetricsChange: (event: {
    nativeEvent: { dockHeight: number; contentClearance: number };
  }) => void;
}
```

## Events

- **`onTabPress`** — a tab other than the selected one was activated.
- **`onTabReselect`** — the already-selected tab was activated. Emitted as a distinct event so the
  adapter implements the Phase 0 repeated-selection decision explicitly rather than inheriting it.
- **`onCreatePress`** — the Create control was activated. It is a _toggle request_; native does not
  change `expanded` itself, it waits for the prop to come back.
- **`onDismissRequest`** — the backdrop was tapped or an escape/accessibility-escape gesture fired.
- **`onAssistantPress`** — emitted only if `assistant.enabled`. While unavailable, native swallows
  the touch and emits nothing.
- **`onActionPress`** — emitted only for an action whose `enabled` is `true`. Disabled actions
  swallow the touch.
- **`onMetricsChange`** — emitted after layout and on every subsequent change to safe area, Dynamic
  Type, or dock size. Never emitted with unchanged values.

## Metrics semantics

Both values are in points, measured from the **bottom of the view**, and both are computed from the
live safe area and Dynamic Type — never from device-specific constants.

- **`dockHeight`** — the height the collapsed dock physically occupies: from the bottom of the
  screen to the top of the assistant pill, inclusive of the bottom safe-area inset.
- **`contentClearance`** — the padding a scrolling surface must add so its final row clears the
  collapsed dock. This is `dockHeight` minus whatever the system already subtracts through
  `contentInsetAdjustmentBehavior`, so consumers add it directly with no further arithmetic.

The expanded panel deliberately does **not** affect either value: it is transient modal state, and
changing content insets on expand would visibly reflow the list behind the backdrop.

## Invariants

- React owns `selectedTabId` and `expanded`. Native animates toward whatever it is handed and never
  holds its own copy as the source of truth.
- Native never traverses, retains, subclasses, or mutates `react-native-screens` views.
- While collapsed the view passes touches through everywhere except its own controls; while
  expanded the backdrop captures the full screen.
- Every interactive control has a ≥44×44pt hit area, a Dynamic Type label, and the correct trait
  (tab controls are tabs; Create is a button; the assistant pill is a disabled button).
- Dismissing the panel returns VoiceOver focus to the Create control.
