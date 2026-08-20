---
type: app
status: current
area: architecture
updated: 2026-08-20
---

# Application architecture

Hipefit is an iOS-only Expo (SDK 57, bare workflow) app. This document describes the durable,
cross-feature shape of the code — what the layers are, why they are separated the way they are, and
where a new piece of work belongs. It does not restate APIs; follow the links for detail.

Rules that every agent must obey unconditionally live in [AGENTS.md](../../AGENTS.md). This document
explains the reasoning behind them and the parts of the system no single rule covers. The Firestore
schema is in [docs/db-structure.md](../db-structure.md).

## The layering

There are four layers on the read path and no service tier between them:

```text
app/            route files — title, navigation chrome, one feature island
features/       screen bodies, row components, and the Zustand store per domain
database/       Firestore refs, document types, subscription orchestration
Firebase        Firestore / Auth, via @react-native-firebase directly
```

Four things sit beside those layers rather than inside them: `theme/` (colors, shared SwiftUI
modifier arrays, shared RN styles), `ui/` (reusable native primitives), `lib/` + `hooks/`
(formatting, constants, haptics, cross-feature hooks), and `packages/` (workspace packages the app
consumes by name — today one iOS native module; see
[`packages/`: the local native boundary](#packages-the-local-native-boundary)).

The absence of an API/service layer is deliberate. Active reads are live `onSnapshot` subscriptions
and the small write surface uses Firebase operations directly, so a wrapper would only add a name to
pass through. What _is_ centralized is the part that actually varies: document paths
(`database/refs.ts`), persisted types and runtime decoders, and subscription lifetime
(`database/use-firestore-subscriptions.ts`).

## Feature-based organization

A screen is a route file plus a feature island. The route file owns navigation chrome —
`Stack.Screen.Title`, toolbars, search bars — and renders a single component from `features/`, which
owns the body and reads its own stores. See
[app/(private)/(home)/index.tsx](<../../app/(private)/(home)/index.tsx>) against
[features/home/home-content.tsx](../../features/home/home-content.tsx) for the canonical pair.

The split exists because Expo Router's file tree is a _routing_ structure, and screen composition
should not have to move when a route moves. It also keeps the chrome declarations — several of which
must be literal JSX children of `Stack.Toolbar` to render at all — isolated from the part of the
screen that changes most.

Inside `features/<name>/`:

- `<name>-content.tsx` is the screen island the route renders
  ([features/workouts/workouts-content.tsx](../../features/workouts/workouts-content.tsx),
  [features/settings/settings-content.tsx](../../features/settings/settings-content.tsx));
- one named component per file for anything reused or large enough to read on its own
  ([features/home/home-header.tsx](../../features/home/home-header.tsx),
  [features/exercises/exercise-row.tsx](../../features/exercises/exercise-row.tsx));
- `store/use-<name>-store.ts` for the domain's Zustand store;
- measured native constants live next to the feature that measured them
  ([features/exercises/row-metrics.ts](../../features/exercises/row-metrics.ts),
  [features/navigation-dock/navigation-dock-metrics.ts](../../features/navigation-dock/navigation-dock-metrics.ts)).

Two features do not follow the pattern, both knowingly.
[app/(private)/exercises/index.tsx](<../../app/(private)/exercises/index.tsx>) keeps the list, the
filter state and the placeholder data in the route file because the screen _is_ the list; and
[features/auth/index.tsx](../../features/auth/index.tsx) is a bare `index.tsx` left over from an
earlier convention. Neither is a template to copy.

[features/calendar/](../../features/calendar) is a third, and this one **is** deliberate. It is the
only feature grouped into `components/`, `helpers/` and `hooks/` behind an
[index.tsx](../../features/calendar/index.tsx) that publishes the component and its
[types.ts](../../features/calendar/types.ts) contract and nothing else. It earned the exception by
size: fourteen files, roughly twice the next largest feature, at which point a flat directory stops
telling you which of them a screen is allowed to import. The `calendar-` filename prefix went with
the flattening — the directory already says it. Nothing outside the feature reaches past
`@/features/calendar`.

Copy it only when a feature reaches a comparable size. Below that the flat layout is easier to read,
which is why the other eight features keep it, and a half-populated `components/` directory is worse
than no directory at all.

One feature directory has no route of its own. `features/navigation-dock/` is mounted by the tab
layout rather than by a screen — it is the React adapter for the native create panel, plus the store
the tab layout shares with it and the measured tab bar geometry both need. Its contract is in
[navigation.md](navigation.md).

## State: one Zustand store per domain

Stores are module-level singletons created with `create()` and live at
`features/<name>/store/use-<name>-store.ts`. Zustand rather than context because the stores must be
usable from outside React, where the subscription hook drives them through `getState()`, and because
components select narrow slices instead of re-rendering on every unrelated snapshot.

Two stores hold Firestore data:

| Store                                                                    | Holds                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [useUserStore](../../features/user/store/use-user-store.ts)              | profile, newest body measurement/current weight, and profile/settings/weigh-in writes |
| [useExerciseStore](../../features/exercises/store/use-exercise-store.ts) | localized, visible exercise/category/equipment view models                            |

Each exposes `subscribe(uid)` returning a teardown. The teardown detaches listeners and clears the
slice back to initial values, including `isLoading: true`; there are no separate `reset()` actions.

Conventions worth knowing before writing another store:

- **Every `onSnapshot` has an error callback** that logs with a store-specific prefix and completes
  that listener's loading condition. The UI currently presents a failed listener like empty data.
- **Every snapshot crosses the decoder boundary.** Malformed documents are logged and dropped before
  they enter Zustand; TypeScript casts are not used as runtime validation.
- **`isLoading` drives redaction, not an early return.** Screens render their real structure with
  plausible placeholder values and apply `redacted('placeholder')` while loading. See
  [features/home/home-content.tsx](../../features/home/home-content.tsx) and
  [theme/modifiers.ts](../../theme/modifiers.ts).
- **Derived data is computed in stores, not screens.** Localized exercise view models are published
  centrally so consumers agree.
- **Writes live on the owning store.** Auth creates or self-heals the user document. The user store
  updates profile/settings and appends weigh-ins. Other data stores are read-only today.

[useExerciseStore](../../features/exercises/store/use-exercise-store.ts) is the complex catalogue
store. It fans out over five Firestore collections: global exercises, categories and equipment, plus
the user's custom exercises and custom categories. It keeps raw decoded snapshots in a closure and
recomputes localized, visibility-filtered view models when any source or relevant user setting
changes. The details and trust boundary live in [database.md](database.md).

## Auth is a different kind of store

[useAuthStore](../../features/auth/store/use-auth-store.ts) does not follow the data stores'
`subscribe(uid)` shape because it is what produces the uid. It exposes `initialize()`, which installs the
Firebase `onAuthStateChanged` listener and returns a teardown, plus `signInWithApple()` and
`signOut()`.

`initialize()` is deliberately idempotent: four call sites invoke it (the root layout, the entry
redirect, the login route and the auth screen it renders), and without the guard each call would
overwrite the shared unsubscribe slot — leaking the previous listener and letting one component's
cleanup tear down a listener it did not create. The comment at the guard records this.

Sign-in also owns first-run provisioning and restored-session repair. Every authenticated callback
ensures `users/{uid}` exists before publishing the user to the protected app. Creation is one document
write with default body/settings fields; no reference data is copied. Apple's name-once-only behavior
is handled by filling only missing name fields, so a non-empty user-edited display name is preserved.

## Subscription orchestration

[database/use-firestore-subscriptions.ts](../../database/use-firestore-subscriptions.ts) is the only
place data subscriptions start. It reads `user` from the auth store and, in one effect keyed on that
user, calls `subscribe(uid)` on the two data stores and returns a teardown that unsubscribes both of
them. It is called exactly once from [app/_layout.tsx](../../app/_layout.tsx), above the auth gate.

Centralizing this buys three things a per-screen `useEffect` cannot: data is already streaming before
any screen mounts, so tab switches are instant; sign-out tears every listener down in one place, so
no store can keep serving the previous user's documents; and there is exactly one answer to "who
listens to what", instead of a listener count that grows with screen mounts.

The consequence is that every subscribed collection stays live for the whole session. Workout and
workout-template schemas remain in the database boundary, rules, and admin tooling, but the client
does not subscribe to those collections or derive state from them.

## `database/`: the Firestore boundary

Everything Firestore-shaped is consolidated under [database/](../../database) and imported through
the barrel [database/index.ts](../../database/index.ts), which re-exports refs, types, and decoders.
The subscription hook is imported by its own path because it consumes that vocabulary rather than
defining it.

[database/refs.ts](../../database/refs.ts) exposes helpers only for the six collections the client
currently accesses, plus the `users/{uid}` document helper. The schema still defines nine collections;
workout and workout-template paths can return with their future implementation. Path discipline
matters: user-owned collections are nested under `users/{uid}`, so an inline path is one typo away
from the wrong subtree and would scatter schema changes through feature code.

[database/types.ts](../../database/types.ts) declares document interfaces, full `Ref` strings,
localized maps, Firestore `Timestamp`, and `WithId<T> = { id: string; data: T }`.
[database/decoders.ts](../../database/decoders.ts) validates unknown snapshot data and official writes;
malformed read documents are logged and dropped. Firestore rules add owner isolation and top-level
checks but cannot iterate nested exercise/set arrays or verify references. The schema and full trust
boundary are in [docs/db-structure.md](../db-structure.md) and [database.md](database.md).

## The UI layer

The UI is not a fifth layer beneath `database/`. It is the vocabulary the screen bodies in
`features/` are written in — real SwiftUI rendered from React through `@expo/ui` — supported by
`theme/` (the token, modifier and style source), `ui/` (reusable native primitives) and the hooks and
wrappers in `hooks/` and `lib/`. [ui.md](ui.md) is the authority for building in it; two structural
facts belong here because they shape where code can live at all.

**`Host` is a one-way boundary between two component trees.** That is a placement constraint, not
just a styling one: a screen island is shaped around a single `Host`, and a shape reused across
screens has to pick a side of the bridge before it can move into [ui/](../../ui) — the SwiftUI
primitives are host-less and compose inside a screen's `Host`, the plain-RN ones are usable only
outside one. The rules for building inside that boundary are in [ui.md](ui.md).

**Styling is two vocabularies over one semantic token source**, which is why `theme/` sits beside the
layers rather than inside them: [theme/colors.ts](../../theme/colors.ts) is the semantic token source,
[theme/modifiers.ts](../../theme/modifiers.ts) holds the shared SwiftUI arrays and
[theme/styles.ts](../../theme/styles.ts) the shared RN styles, so a screen never owns a color or a
reusable layout of its own. Fixed artwork may stay with the feature that owns it: Avatar's reference
swatches live in [`features/avatar/avatar-backgrounds.ts`](../../features/avatar/avatar-backgrounds.ts)
rather than pretending to be semantic UI roles. What the shared tokens are, how the two vocabularies
stay named alike, and the ordering rule that constrains how the shared arrays may be reused are all
in [ui.md](ui.md).

Shared formatting lives in [lib/format.ts](../../lib/format.ts) — check it before writing a local
helper. It holds the greeting and casing helpers, the metric/imperial converters, and the calendar
date-ID and month/day formatters. Duration and volume helpers do **not** exist: they left with the
workout store and will be written by whoever rebuilds it.

## `packages/`: the local native boundary

[packages/](../../packages) is where native code the app owns lives. Each subdirectory is a
workspace package: a `package.json`, an `expo-module.config.json`, an `ios/` directory of Swift plus
a podspec, and an `index.ts` that types the bridge and calls `requireNativeView`. There is exactly
one today, [packages/navigation-dock/](../../packages/navigation-dock/index.ts) — published to the
app as `@hipefit/navigation-dock` — which draws the global create panel and its scrim.

The boundary is worth stating plainly because it is the only place in the repository where app
behavior is written in Swift:

- **A package is imported by name, never by path.**
  `import { NavigationDockView } from '@hipefit/navigation-dock'`, not a `@/`-aliased path — the
  `@/*` alias maps to the repository root and deliberately does not reach in here. That is the line
  between the two directories: something reachable only by a relative path belongs in `features/`.
- **`packages/` is for views and APIs UIKit must own.** A native module is not the answer to "this
  should look different" — `@expo/ui` renders real SwiftUI already. It is the answer to a
  requirement the SwiftUI bridge structurally cannot serve; [ui.md](ui.md#when-a-hand-written-native-view-is-correct)
  lists the three that produced this one and is the authority for how such a view must behave.
- **Linking is automatic and native config stays committed.** The package is a real dependency:
  root `package.json` declares `workspaces: ["packages/*"]` and depends on
  `@hipefit/navigation-dock` at `workspace:*`, so Bun symlinks it into `node_modules` and Expo
  autolinking finds it there by its `expo-module.config.json` — exactly as it finds a published
  module. Hence no entry in `app.config.js` and none in the `Podfile`. What there _is_, is a
  `Podfile.lock` entry pointing at `../packages/navigation-dock/ios`, so adding, changing **or
  removing** a local package means `pod install --project-directory=ios` and committing that lock
  change.

  **The install layout is pinned, and must stay pinned.** Bun defaults a workspace install to the
  _isolated_ linker, which stops hoisting transitive dependencies to the project root. Expo's Metro
  config resolves `metro-runtime` from the root and Metro resolves its own transform worker the same
  way, so the isolated layout takes the dev server down with
  `Cannot read properties of undefined (reading 'transformFile')` while every package is nonetheless
  installed. [bunfig.toml](../../bunfig.toml) pins the hoisted linker for that reason.

  The same episode surfaced a second rule. Adding workspaces also exposed a package the app imported
  but never declared, relying on it being hoisted as someone else's transitive dependency. **If a
  file imports it, `package.json` declares it.** A transitive dependency is an implementation detail
  of the package that owns it, free to vanish in a patch release, and the failure surfaces at an
  unrelated moment with nothing pointing back at the import that caused it.

- **The React side of a native view belongs in `features/`, not in `packages/`.** `index.ts` exports
  a typed view and nothing else — no state, no store reads, no navigation. The adapter that owns
  those is [features/navigation-dock/navigation-dock.tsx](../../features/navigation-dock/navigation-dock.tsx),
  which is what keeps the module reusable and the app logic testable by reading. Nothing under
  `app/` imports from `packages/`.
- **The bridge is a contract in two files.** Prop and event names appear in the Swift
  `ModuleDefinition` and in `index.ts`, and nothing checks that they agree: an unknown prop is
  dropped silently and an unknown event never reaches JS. Rename in both or not at all.

## Environments

Three environments, each a distinct bundle identifier, Xcode scheme, Firebase project and App Store
Connect record:

| Environment | Scheme          | Bundle identifier                         | Info.plist                                             |
| ----------- | --------------- | ----------------------------------------- | ------------------------------------------------------ |
| development | `Hipefit-dev`   | `com.kyrylokorota.hipefitapp.development` | [Info-dev.plist](../../ios/Hipefit/Info-dev.plist)     |
| staging     | `Hipefit-stage` | `com.kyrylokorota.hipefitapp.staging`     | [Info-stage.plist](../../ios/Hipefit/Info-stage.plist) |
| production  | `Hipefit`       | `com.kyrylokorota.hipefitapp`             | [Info-prod.plist](../../ios/Hipefit/Info-prod.plist)   |

The selection is **native, not JavaScript**. All three `GoogleService-Info-*.plist` files are bundled,
and [ios/Hipefit/AppDelegate.swift](../../ios/Hipefit/AppDelegate.swift) picks one at launch by
inspecting `Bundle.main.bundleIdentifier`, then calls `FirebaseApp.configure(options:)` with it.
Nothing in the JS bundle needs to know which environment it is running in, which is why no store or
screen reads an environment variable.

The `ios:*` scripts in [package.json](../../package.json) copy the matching `.env.<environment>` file
to `.env.local` and launch `expo run:ios` with the right scheme; [eas.json](../../eas.json) maps the
same three names to build and submit profiles. The `.env` files currently define
`EXPO_PUBLIC_APP_ENV` and `SECRET_API_KEY`, neither of which is read anywhere in the TypeScript
sources — treat them as reserved rather than load-bearing.

Being a bare workflow, [ios/](../../ios) is committed and authoritative: native configuration is
edited there, not synthesized from [app.config.js](../../app.config.js), which carries only the
Expo-level settings (`expo-router` plugin, typed routes, React Compiler). New Architecture is enabled
in [ios/Podfile.properties.json](../../ios/Podfile.properties.json). Adding or removing a dependency
with native code means running `pod install --project-directory=ios` and committing the
`Podfile.lock` change in the same commit.

## What is deliberately absent

Stated plainly so nothing here is mistaken for shipped behavior:

- **There is no workout player.** Start and Add to Workout affordances remain disabled in Home, the
  exercise list rows, the exercise detail sheet, and the create panel — the reusable workout cards
  that once carried them were deleted with the workout store. The `Workout` document type and
  validation remain in place, but there is no workout store, read request, or write path.
- **All three global create actions are stubs:** Start Workout, New Workout Template, and Custom Exercise
  each ship `enabled: false` in
  [features/navigation-dock/navigation-dock-actions.ts](../../features/navigation-dock/navigation-dock-actions.ts),
  and native swallows their touches. See [navigation.md](navigation.md) for the panel itself.
- **There is no automated test suite.** No test runner is installed; `bun run type-check` is the
  verification gate, with `bun run lint` and `bun run format:check` alongside it.
- **There is no Android project**, by decision — see [AGENTS.md](../../AGENTS.md). Reviving it is a
  project-wide change, not a per-component one.
- **`ios/hipefit-watch Watch App/` is an unmodified Xcode template** (a "Hello, world!" `ContentView`)
  with schemes wired up per environment. There is no watch feature.
