---
type: app
status: current
area: navigation
updated: 2026-08-04
---

# Navigation

Routing is [Expo Router](https://docs.expo.dev/router/introduction/) (`expo-router ~57.0.8` — it
now tracks the SDK version rather than its own major), file-based over the `app/` directory. Typed
routes are on, so route strings are checked at compile
time — see [`app.config.js`](../../app.config.js), which also registers the `expo-router` plugin and
the `hipefitapp` URL scheme. There is no custom linking configuration anywhere in the repo: the URL
space is exactly what the file tree describes.

## The tree

```text
app/
├── _layout.tsx              Root Stack + auth gate
├── index.tsx                Entry redirect
├── (public)/
│   └── login.tsx            Apple Sign-In
└── (private)/
    ├── _layout.tsx          NativeTabs + floating create button
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

That is the whole route surface. Eight screens, one of which is a sheet. There is no
`app/+not-found.tsx`, so an unmatched path falls through to Expo Router's built-in unmatched
screen rather than anything this app authored.

## The auth gate

[`app/_layout.tsx`](../../app/_layout.tsx) is a single `Stack` registering three things: `index`,
`(public)/login`, and `(private)` — the last wrapped in `Stack.Protected` with
`guard={isLoggedIn}`.

`Stack.Protected` is not a redirect. A false guard **excludes** the wrapped screens from the
navigator's screen list, so while signed out the `(private)` subtree does not exist as far as
React Navigation is concerned. That is why signing out needs no navigation call: `signOut` in
[`features/auth/store/use-auth-store.ts`](../../features/auth/store/use-auth-store.ts) flips
`isLoggedIn` through the `onAuthStateChanged` listener, the guard closes, and the private routes
are gone. The same mechanism makes a private deep link unreachable while signed out — it cannot
resolve to a screen that is not registered.

What actually decides _where_ you land is the entry redirect in
[`app/index.tsx`](../../app/index.tsx): signed in → `/(private)/(home)`, signed out →
`/(public)/login`. [`app/(public)/login.tsx`](<../../app/(public)/login.tsx>) repeats the same check
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
  [`hooks/use-app-color-scheme.ts`](../../hooks/use-app-color-scheme.ts).

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
  [`app/(private)/settings/_layout.tsx`](<../../app/(private)/settings/_layout.tsx>) is the one
  layout with explicit `<Stack.Screen>` declarations, because the Edit Profile sheet's presentation
  is route configuration and has to be declared where the route is registered.
- **Large titles.** `Stack.Screen.Title large` only means anything inside a stack. Without the
  per-tab stack there is no navigation bar to own the title, and the title would have to be drawn
  in the body.

The cost is three near-empty files. Each carries a comment explaining that it is intentionally
bare and that the screen supplies its own chrome.

### Home's path is `/`, not `/home`

The Home tab lives in `(home)` — parentheses, so the group adds no segment and the tab sits at the
app root. One consequence that has to be respected in two places at once: the tab trigger in
[`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>) is `name="(home)"`, **with** the
parentheses, because a trigger names the child directory, not the URL it produces. Dropping them
addresses a directory that does not exist.

## Screen chrome is declared in the screen

`Stack.Screen.Title`, `Stack.Toolbar` and `Stack.SearchBar` are rendered by the screen component,
as siblings of its content, not configured in the layout. Every route file in the tree follows
this; see [`app/(private)/workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>) for the
minimal shape — an island from `features/` plus a title — and
[`app/(private)/exercises/index.tsx`](<../../app/(private)/exercises/index.tsx>) for the maximal one.

The reason is that chrome depends on screen state. In
[`app/(private)/(home)/index.tsx`](<../../app/(private)/(home)/index.tsx>) the title _is_ the
greeting — there is no "Home" title and no heading in the body, because both would say the same
thing twice — recomputed across noon/18:00 and across an overnight resume by
[`features/home/use-greeting.ts`](../../features/home/use-greeting.ts). Exercises' toolbar icon
reflects whether a difficulty filter is active, and its search bar writes into the same `useState`
that filters the list. Configuring either from the layout would mean lifting that state above the
screen that owns it for no benefit.

The pattern also keeps route files thin. A route is normally a title plus one island from
`features/` — [`features/home/home-content.tsx`](../../features/home/home-content.tsx),
[`features/workouts/workouts-content.tsx`](../../features/workouts/workouts-content.tsx),
[`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx). Exercises
is the deliberate exception: the route file owns the `LegendList`, the search and filter state, and
the detail sheet, because all four are the same state.

Two sharp edges, both recorded in the Exercises screen:

- **`Stack.Toolbar.*` children must be literal JSX.** A `.map()` or a wrapper component does not
  render. The four difficulty options are written out one by one for that reason.
- **`Stack.SearchBar` needs `hideWhenScrolling={false}` here.** UIKit's default hides the bar until
  the user drags past the top, and that drag never arrives because the SwiftUI rows swallow the
  upward pan — the search bar would simply never appear.

## Tabs and the create button

[`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>) is the only interesting layout. It
renders `NativeTabs` (from `expo-router/unstable-native-tabs`, a real `UITabBar`) with four
triggers. Home, Workouts and Settings each carry an SF Symbol pair for the unselected and selected
states; Exercises passes the single symbol `checklist`, which has no `.fill` counterpart. (Each
trigger also passes a Material icon name, which is inert on this iOS-only app.)

The global create affordance is a **sibling** of `NativeTabs`, not a child: a single `Host`
positioned absolutely inside a flex `View` that parents both.
[`features/floating-action-button/create-floating-action-button.tsx`](../../features/floating-action-button/create-floating-action-button.tsx)
holds it. `NativeTabs.BottomAccessory` is the API-supported slot and was rejected because it only
ever renders a full-width pill, and the design calls for a circle.

### Being an overlay rather than an accessory

The consequences are structural, not stylistic:

- The overlay **cannot observe the tab bar**. Neither its height nor its minimize state is exposed
  by any API — Expo records this as a known native-tabs limitation — so every offset in
  [`features/floating-action-button/floating-action-button-metrics.ts`](../../features/floating-action-button/floating-action-button-metrics.ts)
  is measured on a running simulator and annotated with the measurement rather than derived.
  Re-measure — do not recompute — after any change to the bar.
- `minimizeBehavior="never"` on the navigator follows from that, and is mandatory rather than
  cosmetic. It is there for the create button, not for the tab bar: a bar that shrinks on scroll
  leaves the fixed-offset overlay behind, and pinning it is the only way to keep the two lined up.
- Scrolling screens must pad for it themselves. `contentInsetAdjustmentBehavior` accounts for the
  tab bar, which the button floats above, so the Exercises list adds
  `FLOATING_ACTION_BUTTON_CONTENT_INSET` to its content padding. No SwiftUI `List` screen needs
  this yet, and `@expo/ui` exposes no content-inset hook for one.
- Declaring it in the tab layout is what makes it appear on all four tabs from one declaration
  instead of a `+` per screen. The comment in
  [`app/(private)/workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>) marks where it used
  to live.

### The menu contract

Tap and long press open the **same** anchored SwiftUI `Menu`. That holds only because the component
deliberately passes **no `onPrimaryAction`**: supplying one routes tap to a JS callback and leaves
long press alone opening the menu, which is two presentations for one control — the defect measured
and root-caused in a QA pass on iOS 26. Do not reintroduce it, and do not add a JS `onLongPress` /
`onTapGesture` or an `@expo/ui` `ContextMenu` beside it. The `Menu` already owns both gestures.

Two behaviours look like defects and are not:

- **The open menu covers the button and drops it from the accessibility tree.** An anchored `UIMenu`
  on iOS 26 does not lift a portal snapshot of its source view the way a genuine context menu does.
  The same QA pass measured Files' ••• menu covering its own source and vanishing from the
  accessibility tree identically. This is platform-standard; the only way around it is abandoning
  SwiftUI `Menu` for a hand-built popover, so do not engineer around the overlap.
- **No haptic fires here, and none should.** With no JS callback there is no event to fire one from,
  and UIKit's own menu presentation already carries its feedback.

Hit area and accessibility belong on the glyph inside the `Menu`'s `label`, never on the `Menu`
itself — that is a general rule about SwiftUI controls in this app rather than a create-button one,
and it lives in [`docs/app/ui.md`](ui.md).

### A recorded HIG divergence

The button floats in the content layer and is drawn with Liquid Glass, which Apple's HIG explicitly
advises against; the iOS HIG also has no floating-action-button idiom at all, the term being
Material Design's — which is why `features/floating-action-button/` spells the name out instead of
using the Android-flavoured "FAB" abbreviation. Both were weighed against the accessory pill and
accepted with the user. A deliberate divergence, not an oversight to fix.

### The actions are stubs

**The menu's three actions — Start Workout, New Routine, Custom Exercise — are disabled stubs.**
They render, they are unreachable, and they have no `onPress` because there is nowhere to go: no
route in `app/` creates a workout, a routine, or an exercise. Going live means dropping
`mods.disabledOnly` and adding an `onPress`, which is a state change and so also earns a haptic.
Same for the Resume button in
[`features/workouts/active-workout-banner.tsx`](../../features/workouts/active-workout-banner.tsx),
which is disabled until a workout player exists.

## Sheets

Only one sheet is a route:
[`app/(private)/settings/edit-profile.tsx`](<../../app/(private)/settings/edit-profile.tsx>),
presented as a `formSheet` with two detents, configured in the Settings layout because presentation
belongs to route registration.

Everything else that looks like a sheet is a SwiftUI presentation inside a screen — the exercise
detail in
[`features/exercises/exercise-detail-sheet.tsx`](../../features/exercises/exercise-detail-sheet.tsx)
is driven by component state, so it has no URL, no back-stack entry, and no route file. Reach for
a route only when the sheet should be addressable or survive a push; otherwise keep it local.

## Imperative navigation

There are exactly two imperative navigation calls in the app, both in Settings:
`router.push('/settings/edit-profile')` in
[`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx), and
`router.back()` in
[`features/settings/edit-profile-form.tsx`](../../features/settings/edit-profile-form.tsx)
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
