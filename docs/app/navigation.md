---
type: app
status: current
area: navigation
updated: 2026-08-21
---

# Navigation

Routing is [Expo Router](https://docs.expo.dev/router/introduction/) (`expo-router ~57.0.8` — it
now tracks the SDK version rather than its own major), file-based over the `apps/mobile/app/`
directory. Typed
routes are on, so route strings are checked at compile
time — see [`apps/mobile/app.config.ts`](../../apps/mobile/app.config.ts), which also registers the
`expo-router` plugin and
the `hipefitapp` URL scheme. There is no custom linking configuration anywhere in the repo: the URL
space is exactly what the file tree describes.

## The tree

```text
apps/mobile/app/
├── _layout.tsx              Root Stack + auth gate
├── index.tsx                Entry redirect
├── (public)/
│   └── login.tsx            Apple Sign-In
└── (private)/
    ├── _layout.tsx          NativeTabs (4 tabs + Create) + the native panel
    ├── create.tsx           No screen — the Create tab item's required route
    ├── (home)/              path "/"
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── workouts/
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── exercises/
    │   ├── _layout.tsx
    │   └── index.tsx
    └── settings/
        ├── _layout.tsx      Also declares the edit-profile sheet presentation
        ├── index.tsx
        └── edit-profile.tsx
```

That is the whole route surface. Eight route files: seven screens, one of which is a sheet, plus
`create.tsx`, which is not a screen at all — it exists because a tab trigger must name a route, and
it redirects. There is
no
`apps/mobile/app/+not-found.tsx`, so an unmatched path falls through to Expo Router's built-in unmatched
screen rather than anything this app authored.

## The auth gate

[`apps/mobile/app/_layout.tsx`](../../apps/mobile/app/_layout.tsx) is a single `Stack` registering
three things: `index`,
`(public)/login`, and `(private)` — the last wrapped in `Stack.Protected` with
`guard={isLoggedIn}`.

`Stack.Protected` is not a redirect. A false guard **excludes** the wrapped screens from the
navigator's screen list, so while signed out the `(private)` subtree does not exist as far as
React Navigation is concerned. That is why signing out needs no navigation call: `signOut` in
[`apps/mobile/src/stores/use-auth-store.ts`](../../apps/mobile/src/stores/use-auth-store.ts) flips
delegates the Firebase operation to the auth service, then the `onAuthStateChanged` listener flips
`isLoggedIn`, the guard closes, and the private routes are gone. The same mechanism makes a private
deep link unreachable while signed out — it cannot resolve to a screen that is not registered.

What actually decides _where_ you land is the entry redirect in
[`apps/mobile/app/index.tsx`](../../apps/mobile/app/index.tsx): signed in → `/(private)/(home)`, signed
out → `/(public)/login`.
[`apps/mobile/app/(public)/login.tsx`](<../../apps/mobile/app/(public)/login.tsx>) repeats the same check
and redirects to home if a session appears while it is mounted, which is what carries a successful
Apple Sign-In out of the login screen — the auth screen itself never navigates.

Three details are load-bearing:

- **Auth state is resolved before anything renders.** While `useAuthStore().isLoading` is true the
  root layout renders an empty view rather than a route tree, so no screen flashes before the
  guard has an answer. `index.tsx` and `login.tsx` return `null` under the same condition.
- **`initialize()` is idempotent on purpose.** Four components call it — the root layout,
  `index`, `login`, and `AuthScreen`, which `login` renders, so that route calls it twice. Only
  the first call installs the Firebase listener; the store's comment records what breaks
  otherwise.
- **Navigation chrome is themed separately.** The root layout feeds a `ThemeProvider` from the
  scheme that `Appearance.setColorScheme` actually resolved to, so large titles and toolbars match
  the SwiftUI content underneath. See
  [`apps/mobile/src/hooks/use-app-color-scheme.ts`](../../apps/mobile/src/hooks/use-app-color-scheme.ts).

## Groups: `(public)` and `(private)`

Both are route groups, so neither contributes a path segment. `(public)/login.tsx` is `/login`;
the private tabs are `/`, `/workouts`, `/exercises`, `/settings`. The groups exist to give the
guard a single node to wrap and to keep the signed-out screen physically separate from everything
that assumes a session.

Redirect targets in code are written group-qualified (`/(private)/(home)`) even though the
unqualified form resolves to the same screen. It reads as "this specific file", which is what a
guard boundary wants.

## Why each tab is a folder with its own `<Stack />`

Four tabs, four directories, each containing a `_layout.tsx` that is (three times out of four)
literally `return <Stack />`. The redundancy is deliberate:

- **Independent history per tab.** A native stack per tab is what makes each tab remember its own
  push depth and hand UIKit its own navigation controller — the standard iOS tab behaviour. A flat
  route file per tab has nowhere to put pushed screens, so any future detail screen would land in
  a stack shared across tabs.
- **A place for per-tab screen options.** Settings already needs this:
  [`apps/mobile/app/(private)/settings/_layout.tsx`](<../../apps/mobile/app/(private)/settings/_layout.tsx>)
  is the one
  layout with explicit `<Stack.Screen>` declarations, because the Edit Profile sheet's presentation
  is route configuration and has to be declared where the route is registered.
- **Large titles.** `Stack.Screen.Title large` only means anything inside a stack. Workouts,
  Exercises, and Settings use one; Home deliberately hides its header because its avatar, greeting,
  and display name form a single custom heading in the body.

The cost is three near-empty files. Each carries a comment explaining that it is intentionally
bare and that the screen supplies its own chrome.

### Home's path is `/`, not `/home`

The Home tab lives in `(home)` — parentheses, so the group adds no segment and the tab sits at the
app root. One consequence that has to be respected in two places at once: the tab trigger in
[`apps/mobile/app/(private)/_layout.tsx`](<../../apps/mobile/app/(private)/_layout.tsx>) is
`name="(home)"`, **with** the
parentheses, because a trigger names the child directory, not the URL it produces. Dropping them
addresses a directory that does not exist.

## Screen chrome is declared in the screen

Private tab screens render their `Stack.Screen.Title` and any `Stack.Toolbar` or `Stack.SearchBar`
chrome as siblings of their content instead of configuring it in the layout. See
[`apps/mobile/app/(private)/workouts/index.tsx`](<../../apps/mobile/app/(private)/workouts/index.tsx>)
for the minimal shape — an island from `apps/mobile/src/features/` plus a title — and
[`apps/mobile/app/(private)/exercises/index.tsx`](<../../apps/mobile/app/(private)/exercises/index.tsx>)
for the maximal one.

The reason is that chrome depends on screen state. Home opts out of chrome with
`headerShown: false`:
[`apps/mobile/src/features/home/home-header.tsx`](../../apps/mobile/src/features/home/home-header.tsx)
combines
the avatar, display name, greeting, and today's date in the body. The greeting is recomputed across
noon/18:00 and the date across midnight, both on one timer plus an `AppState` resume, by
[`apps/mobile/src/features/home/use-clock.ts`](../../apps/mobile/src/features/home/use-clock.ts) — iOS
suspends timers in the
background, so a resume has to re-read them.
Exercises' search bar writes into the same `useState` that filters the list. Configuring it from the
layout would mean lifting that state above the screen that owns it for no benefit.

The pattern also keeps route files thin. A route is normally a title plus one island from
`apps/mobile/src/features/` —
[`apps/mobile/src/features/home/home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx),
[`apps/mobile/src/features/workouts/workouts-content.tsx`](../../apps/mobile/src/features/workouts/workouts-content.tsx),
[`apps/mobile/src/features/settings/settings-content.tsx`](../../apps/mobile/src/features/settings/settings-content.tsx).
Exercises
is the deliberate exception: the route file owns the `LegendList`, the search and filter state, and
the detail sheet, because all four are the same state.

One sharp edge is recorded in the Exercises screen:

- **`Stack.SearchBar` needs `hideWhenScrolling={false}` here.** UIKit's default hides the bar until
  the user drags past the top, and that drag never arrives because the SwiftUI rows swallow the
  upward pan — the search bar would simply never appear.

## Tabs and the create affordance

[`apps/mobile/app/(private)/_layout.tsx`](<../../apps/mobile/app/(private)/_layout.tsx>) is the only
interesting layout. It
renders two siblings inside one flex `View`: the `NativeTabs` navigator — which contains **five**
triggers, the four tabs plus Create — and the action panel that overlays it.

### The tabs are the system's

`NativeTabs` (from `expo-router/unstable-native-tabs`) is a real `UITabBar` and owns it outright.
Tab selection, per-tab history, repeated-selection behaviour, deep links and state restoration are
UIKit's; on iOS 26 the bar already draws itself as the floating glass capsule the design asks for.
Home, Workouts and Settings each carry an SF Symbol pair for the unselected and selected states;
Exercises passes the single symbol `checklist`, which has no `.fill` counterpart. (Each trigger also
passes a Material icon name, which is inert on this iOS-only app.)

**There is no custom tab rendering and no JS tab routing anywhere in the app.** Neither
`apps/mobile/src/features/navigation-dock/` nor `packages/navigation-dock/` draws a tab, reports a
selection, or
knows the tab set exists. Anything about tab behaviour is a question about UIKit and Expo Router,
not about this repository.

### The Create button is a tab bar item

**Create is the fifth `NativeTabs.Trigger`, with `role="search"`.** That role is the whole trick: on
iOS 26 UIKit draws a search-role item as a _detached circle beside_ the tab bar capsule, shrinking
the capsule to make room. That geometry is unreachable any other way — a `UITabBar` spreads its items
across the full width (measured, four items end at x=377 of 402), so a circle drawn beside the bar by
an overlay lands on top of the last item.

Three things make a search tab behave as a button rather than as a tab:

- **`disabled`** prevents the native selection, so tapping navigates nowhere. The press still arrives
  as `tabPress` with `isPrevented: true`, and that is what opens the panel. This suppresses only the
  native tap: `router.push('/create')` still resolves, which is why
  [`apps/mobile/app/(private)/create.tsx`](<../../apps/mobile/app/(private)/create.tsx>) exists and
  redirects to Home.
- **An explicit `Icon` and `Label`** override the system magnifying glass and title, so it presents
  and announces as Create — and as Close, with an `xmark`, while the panel is open.
- **Detachment keeps it out of the tab group.** In the accessibility tree, `[tab-bar]` holds the
  capsule of four `[button]`s and, as its sibling, a separate `"Create"` group. It is never one of
  the four and never carries `[selected]`.

**The pre-iOS-26 cost.** The detached circle is an iOS 26 rendering. On 16.4–25 a search-role item is
an ordinary fifth item _inside_ the bar — still labelled Create, still opening the panel, but sharing
the bar's width. **Unverified**: no pre-26 runtime is installed on the development machine.

Because the button is a tab bar item and the panel is an overlay, neither contains the other, so
`expanded` lives in
[`apps/mobile/src/stores/use-navigation-dock-store.ts`](../../apps/mobile/src/stores/use-navigation-dock-store.ts).
That store is **not** a domain store: no Firestore data, no `subscribe(uid)`, not started by
[`apps/mobile/src/hooks/use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts).
It is transient UI state that happens to need two call sites.

### The panel is a native overlay

Four files, one of them a workspace package of native code:

- [`apps/mobile/src/features/navigation-dock/navigation-dock.tsx`](../../apps/mobile/src/features/navigation-dock/navigation-dock.tsx)
  — the React adapter the tab layout mounts, edge to edge over the whole screen.
- [`apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts)
  — the three action descriptors, in grid order.
- [`apps/mobile/src/features/navigation-dock/navigation-dock-metrics.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-metrics.ts)
  — the measured tab bar geometry.
- [`packages/navigation-dock/`](../../packages/navigation-dock/index.ts) — the Expo view module
  whose single UIKit view draws the action panel and the scrim behind it. **It draws no button and
  no tabs.** The files above import it by package name, `@hipefit/navigation-dock`, not by path. Why
  it is hand-written UIKit rather than `@expo/ui`, and the material, motion and accessibility rules
  it follows, are in [`docs/app/ui.md`](ui.md).

This replaced an anchored SwiftUI `Menu` — a `UIMenu` presented from the button.
`NativeTabs.BottomAccessory` remains rejected **for this button**, because it only ever renders a
full-width pill and the design calls for a circle. That is a rejection of the slot for the Create
affordance, not of the API: a full-width pill is exactly the shape an active-workout accessory wants,
which is what [`@hipefit/expandable-accessory`](../../packages/expandable-accessory/README.md) is
built to fill. No route mounts it yet.

Ownership divides three ways:

| Owner                                | Owns                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Expo Router (`NativeTabs`)           | The four tabs, the Create item's rendering and placement, and every navigation behaviour.               |
| React (`apps/mobile/src/`)           | The `expanded` store, action descriptors, measured offset, colour scheme, Reduce Motion, and dismissal. |
| Native (`packages/navigation-dock/`) | Everything the panel draws: layout, materials, animation, hit testing, VoiceOver.                       |

`expanded` is **controlled and one-way**. The view never flips its own copy; it animates toward
whatever prop arrives. That is precisely what lets a dismissal originating outside the view win over
a stale native state. The bridge is props in, events out — the module declares no `Function` or
`AsyncFunction`, so there is no imperative surface and no second source of truth.

### Dismissal rules

The panel closes on all of the following, and every one of them routes through the same React state:

- **A backdrop tap**, including a sighted tap on the visible Create circle while expanded. The native
  overlay covers the tab bar, so that tap arrives as `onDismissRequest` with `reason: 'backdrop'`, not
  as a second `tabPress`.
- **The VoiceOver escape gesture**, which arrives as `onDismissRequest` with `reason: 'escape'`.
- **Any navigation** — a push, a presented sheet, a deep link, or the redirect that follows a session
  change. The adapter listens to the navigation container's `state` event rather than watching route
  state in an effect. Not a tab switch while the panel is up: the scrim is modal and swallows it.
- **The app entering the background.** `'background'` only, never `'inactive'`: iOS reports
  `inactive` for Control Center, a notification banner and a system alert, and the user is still
  standing in front of the panel for all three.
- **The session ending.** A `useAuthStore` subscription, for a revoked token or a deleted account.
  Signing out through Settings cannot reach this — that button is behind the scrim.

The last three are subscriptions to something outside React rather than effects on rendered state,
because panel visibility is transient modal state and the things that should close it are events.

**Expanded is fully modal, and completely invisible.** The backdrop covers the whole screen and
blocks every touch behind it, the tab bar included, and `accessibilityViewIsModal` takes the same
region out of the VoiceOver tree — both applied the moment the state changes rather than when the
animation finishes. It **draws nothing**: no dimming, no blur, so the screen behind the panel is
untouched and the card's own material is what separates it from the content. A tap anywhere outside
the card dismisses and does nothing else: **a tab tap while the panel is open does not navigate**,
and a tap on the Create circle dismisses through the backdrop rather than through the button. While
collapsed, the overlay is a hole in the touch layer everywhere.

That combination is easy to misread as a bug in either direction, so both halves are deliberate: an
invisible barrier is still a barrier, and the shade was removed because the reference leaves the
screen behind the card alone. Two earlier revisions got the geometry wrong too — stopping the dimming
at the tab bar drew a bright band across the bottom, and stopping only the touches there left a tab
bar that silently still navigated from underneath.

**One accessibility consequence.** `accessibilityViewIsModal` hides the tab bar, and therefore the
Create/Close button, from VoiceOver while the panel is up. The escape gesture is the route, wired
through `accessibilityPerformEscape`. The practical consequence for QA: while the panel is open,
`Close` cannot be found by an accessibility-driven driver and must be tapped by coordinate.

One haptic fires: `hapticImpact()` when Create **opens** the panel. Nothing fires on close, on the
scrim, on the escape gesture, or on an action. Opening puts something new on screen, which is what
that intent name means; dismissal does not, and iOS itself stays silent when a sheet goes away. It
fires from the press handler in the tab layout rather than from a store updater — an updater must be
pure and may be called twice, which would be a doubled tap.

### Being an overlay rather than an accessory

The consequences are structural, not stylistic:

- The overlay **cannot observe the tab bar**. Neither its height nor its minimize state is exposed
  by any API — Expo records this as a known native-tabs limitation — so every value in
  [`apps/mobile/src/features/navigation-dock/navigation-dock-metrics.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-metrics.ts)
  is measured on a running simulator and annotated with the measurement rather than derived.
  Re-measure — do not recompute — after any change to the bar. `NavigationDock` passes
  `NAVIGATION_DOCK_BOTTOM_INSET` to the native view as `bottomInset`, which anchors the panel above
  the bar. The native side treats the safe area as a **floor** under that number and never as an
  addend — the measured constant already contains the home indicator, because on iOS 26 the floating
  bar is inset within the safe area.
- `minimizeBehavior="never"` on the navigator follows from that, and is mandatory rather than
  cosmetic. It is there for the panel: a bar that shrinks on scroll leaves the panel anchored to a
  position the bar no longer occupies.
- **No screen pads for the create affordance.** It used to be a circle floating above the bar, which
  `contentInsetAdjustmentBehavior` knows nothing about, so the Exercises list carried an extra bottom
  inset to keep its last row clear. The button is a tab bar item now, so the automatic inset already
  covers everything on screen and that padding is gone.
- Declaring the trigger in the tab layout is what makes Create appear on all four tabs from one
  declaration instead of a `+` per screen. The comment in
  [`apps/mobile/app/(private)/workouts/index.tsx`](<../../apps/mobile/app/(private)/workouts/index.tsx>)
  marks where it used
  to live.

### A resolved HIG divergence

This used to record a deliberate divergence: the create button floated in the content layer, which
Apple's HIG advises against, and the iOS HIG has no floating-action-button idiom at all — the term is
Material Design's. **Both are now moot.** The button is a `UITabBar` item that UIKit places and
draws, so there is nothing floating in the content layer and nothing Android-flavoured left to name;
the former floating-action-button feature is deleted. What remains of the trade is the
pre-iOS-26 rendering noted above.

### The actions are stubs

**The panel's three actions — Start Workout, New Workout Template, Custom Exercise — are disabled
stubs.**
They render, they are unreachable, and there is nowhere to send them: no route in `apps/mobile/app/`
creates a
workout, a template, or an exercise. Each descriptor in
[`apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts)
ships `enabled: false`, and the native control is disabled with `isEnabled = false` rather than by
switching off user interaction — so a disabled action **swallows** its touch instead of dropping it
through to the panel behind. `onActionPress` is wired to an empty handler rather than left off, so
the seam stays visible: an unhandled event is how a stub quietly becomes a navigation to the wrong
place later.

Going live means flipping `enabled` and giving `onActionPress` a destination, which is a state change
and so also earns a haptic.

## Sheets

Only one sheet is a route:
[`apps/mobile/app/(private)/settings/edit-profile.tsx`](<../../apps/mobile/app/(private)/settings/edit-profile.tsx>),
presented as a `formSheet` with two detents, configured in the Settings layout because presentation
belongs to route registration.

Everything else that looks like a sheet is a SwiftUI presentation inside a screen — the exercise
detail in
[`apps/mobile/src/features/exercises/exercise-detail-sheet.tsx`](../../apps/mobile/src/features/exercises/exercise-detail-sheet.tsx)
is driven by component state, so it has no URL, no back-stack entry, and no route file. Reach for
a route only when the sheet should be addressable or survive a push; otherwise keep it local.

## Imperative navigation

There are exactly two imperative navigation calls in the app, both in Settings:
`router.push('/settings/edit-profile')` in
[`apps/mobile/src/features/settings/settings-content.tsx`](../../apps/mobile/src/features/settings/settings-content.tsx),
and
`router.back()` in
[`apps/mobile/src/features/settings/edit-profile-form.tsx`](../../apps/mobile/src/features/settings/edit-profile-form.tsx)
**after** a successful write. The ordering there is a rule, not an accident: dismissing a form
sheet reads to the user as a completed save, so the dismissal must follow the write.

Everything else navigates declaratively — tab switches through `NativeTabs`, session transitions
through the guard and the two `Redirect`s. Note that a SwiftUI `List` cannot host an
`expo-router` `<Link>` (an RN view cannot nest in the native tree), so rows that push a route use
a SwiftUI `Button` with `router.push` and a hand-drawn disclosure chevron; the reasoning is
written out in `settings-content.tsx`.

## Related

- [`docs/app/architecture.md`](architecture.md) — application structure and shared systems.
- [`docs/app/ui.md`](ui.md) — the UI system: `Host` ownership, primitives, typography, control hit
  testing and accessibility.
- [`AGENTS.md`](../../AGENTS.md) — the subset of these rules an agent must know without reading this
  document.
