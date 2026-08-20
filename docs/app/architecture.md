---
type: app
status: current
area: architecture
updated: 2026-08-18
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
consumes by name — today one iOS native module and one pure React integration; see
[`packages/`: reusable workspace boundaries](#packages-reusable-workspace-boundaries)).

The absence of an API/service layer is deliberate. Every read is a live `onSnapshot` subscription and
every write is a one-line `updateDoc`/`writeBatch` against a ref helper, so a wrapper would only add
a name to pass through. What _is_ centralized is the part that actually varies: document paths
(`database/refs.ts`) and subscription lifetime (`database/use-firestore-subscriptions.ts`).

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
  ([features/workouts/routine-card.tsx](../../features/workouts/routine-card.tsx),
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
which is why the other nine features keep it, and a half-populated `components/` directory is worse
than no directory at all.

One feature directory has no route of its own. `features/navigation-dock/` is mounted by the tab
layout rather than by a screen — it is the React adapter for the native create panel, plus the store
the tab layout shares with it and the measured tab bar geometry both need. Its contract is in
[navigation.md](navigation.md).

## State: one Zustand store per domain

Stores are module-level singletons created with `create()` and live at
`features/<name>/store/use-<name>-store.ts`. Zustand rather than context because the stores must be
usable from outside React — the subscription hook drives them through `getState()` — and because
components select narrow slices instead of re-rendering on every unrelated snapshot.

Four stores hold Firestore data and share one shape:

| Store                                                                    | Holds                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| [useUserStore](../../features/user/store/use-user-store.ts)              | the user profile document, plus its two write methods     |
| [useWorkoutStore](../../features/workouts/store/use-workout-store.ts)    | workouts, the derived recent list and the in-progress one |
| [useRoutineStore](../../features/routines/store/use-routine-store.ts)    | routines and the non-archived subset                      |
| [useExerciseStore](../../features/exercises/store/use-exercise-store.ts) | the merged exercise catalogue and group list              |

Each exposes `subscribe(uid)` returning a teardown function, and `reset()`. The important detail is
that **the teardown returned by `subscribe` clears the store's state itself** — it detaches the
listeners and then sets the slice back to its initial values, including `isLoading: true`. `reset()`
is the same clearing without the detach; nothing in the app currently calls it (verified by search),
so it exists as an API for a caller that does not yet exist rather than as part of the live
lifecycle.

Conventions worth knowing before writing a fifth store:

- **Every `onSnapshot` takes an error callback** that logs with a `[StoreName]` prefix. Where a store
  has a single listener the callback also clears `isLoading` so a permission failure cannot leave the
  screen redacted forever. The exercise store is the exception: `isLoading` there is derived from how
  many of its four listeners have fired, so its callbacks log only.
- **`isLoading` drives redaction, not an early return.** Screens render the real structure with
  plausible placeholder values and apply `redacted('placeholder')` while loading — see
  `PLACEHOLDER_STATS` / `PLACEHOLDER_WORKOUTS` in
  [features/home/home-content.tsx](../../features/home/home-content.tsx) and
  `mods.listInsetGroupedRedacted` in [theme/modifiers.ts](../../theme/modifiers.ts). One code path,
  no skeleton components, and no layout jump when data lands.
- **Derived collections are computed in the store, not in the screen.** `recentWorkouts`,
  `inProgressWorkout` and `activeRoutines` are produced inside the snapshot handler so every consumer
  agrees on them.
- **Writes live on the store that owns the document.** `updateSettings` / `updateProfile` on the user
  store are the only writes outside auth today; both read the uid from store state (`_uid`, captured
  by `subscribe`) rather than from a module-level variable.

[useExerciseStore](../../features/exercises/store/use-exercise-store.ts) is the one genuinely complex
store and is worth reading before touching the catalogue. It fans out over four collections — global
exercises, the user's sparse overrides, the user's custom exercises, and the user's groups — keeps the
raw snapshots in a closure rather than in store state, and republishes a single merged, sorted
`MergedExercise[]` on every change. Only the merged result is public, so screens never re-implement
the override rules; `isLoading` stays true until all four listeners have fired at least once, which
is what stops the list from flashing an un-overridden catalogue.

## Auth is a different kind of store

[useAuthStore](../../features/auth/store/use-auth-store.ts) does not follow the `subscribe(uid)` /
`reset()` shape, because it is what produces the uid. It exposes `initialize()`, which installs the
Firebase `onAuthStateChanged` listener and returns a teardown, plus `signInWithApple()` and
`signOut()`.

`initialize()` is deliberately idempotent: four call sites invoke it (the root layout, the entry
redirect, the login route and the auth screen it renders), and without the guard each call would
overwrite the shared unsubscribe slot — leaking the previous listener and letting one component's
cleanup tear down a listener it did not create. The comment at the guard records this.

Sign-in also owns first-run provisioning: `signInWithApple` writes the user profile document and
seeds the user's exercise groups from the global collection in a single batch, and Apple's
name-once-only behaviour is handled by backfilling `firstName`/`lastName` when a later sign-in
happens to carry them.

## Subscription orchestration

[database/use-firestore-subscriptions.ts](../../database/use-firestore-subscriptions.ts) is the only
place data subscriptions start. It reads `user` from the auth store and, in one effect keyed on that
user, calls `subscribe(uid)` on the four data stores and returns a teardown that unsubscribes all of
them. It is called exactly once, from [app/_layout.tsx](../../app/_layout.tsx), above the auth gate.

Centralizing this buys three things a per-screen `useEffect` cannot: data is already streaming before
any screen mounts, so tab switches are instant; sign-out tears every listener down in one place, so
no store can keep serving the previous user's documents; and there is exactly one answer to "who
listens to what", instead of a listener count that grows with screen mounts.

The consequence to keep in mind is that every subscribed collection is loaded for the whole session.
That is affordable because the collections are per-user and small — the global exercise catalogue is
the only unbounded one — and it is the reason the workout store can hold every workout while exposing
a `RECENT_WORKOUTS_LIMIT` slice ([lib/constants.ts](../../lib/constants.ts)).

## `database/`: the Firestore boundary

Everything Firestore-shaped is consolidated under [database/](../../database) and imported through
the barrel [database/index.ts](../../database/index.ts), which re-exports `refs.ts` and `types.ts`.
(The subscription hook is imported by its own path, since it is a consumer of the barrel rather than
part of it.)

[database/refs.ts](../../database/refs.ts) holds one helper per collection and per document —
`workoutsRef(uid)`, `routineRef(uid, id)`, `exercisesRef()` and so on — and is the reason no screen
or store contains a string like `'users'`. Path discipline matters here more than it looks: almost
every collection is nested under `users/{uid}`, so an inline path is one typo away from reading or
writing another user's subtree, and a schema change would otherwise mean grepping for string
literals.

[database/types.ts](../../database/types.ts) declares the document interfaces, re-exports Firestore's
`Timestamp`, and defines `WithId<T> = { id: string; data: T }` — the shape every document takes once
it is in a store, because Firestore keeps the id outside `data()` and the app needs both. Snapshot
data is cast to these interfaces at the store boundary; they are the app's assertion about the
schema, not a validated one. The schema of record is [docs/db-structure.md](../db-structure.md), and
[scripts/db/index.ts](../../scripts/db/index.ts) seeds the global collections.

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
helper, since most date, duration and volume strings already exist there.

## `packages/`: reusable workspace boundaries

[packages/](../../packages) holds code intentionally consumed through a package contract rather
than the root `@/*` alias. There are two packages:

| Package                                                                          | Kind             | Owns                                                      |
| -------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| [`@hipefit/navigation-dock`](../../packages/navigation-dock/index.ts)            | Expo native view | UIKit create panel, scrim, and bridge types               |
| [`@hipefit/expandable-accessory`](../../packages/expandable-accessory/README.md) | Pure React       | Router provider, content slots, outlets, and zoom trigger |

The distinction is load-bearing. `navigation-dock` has `expo-module.config.json`, Swift, a podspec,
and a typed `requireNativeView` bridge. `expandable-accessory` has none of those: it packages a
reusable React coordination problem because its provider must span a NativeTabs subtree and a root
Stack route, not because anything needs new native code.

- **A package is imported by name, never by path.**
  `import { NavigationDockView } from '@hipefit/navigation-dock'`, not a `@/`-aliased path — the
  `@/*` alias maps to the repository root and deliberately does not reach in here. That is the line
  between the two directories: something reachable only by a relative path belongs in `features/`.
- **Native packages are for views and APIs UIKit must own.** A native module is not the answer to
  "this should look different" — `@expo/ui` renders real SwiftUI already. It is the answer to a
  requirement the SwiftUI bridge structurally cannot serve; [ui.md](ui.md#when-a-hand-written-native-view-is-correct)
  lists the three that produced this one and is the authority for how such a view must behave.
- **Linking follows package kind.** Root `package.json` declares `workspaces: ["packages/*"]` and
  both package dependencies at `workspace:*`, so Bun symlinks both into `node_modules`.
  `navigation-dock` is native-autolinked through `expo-module.config.json` and has a `Podfile.lock`
  entry pointing at `../packages/navigation-dock/ios`; changing its native dependency relationship
  requires `pod install --project-directory=ios`. `expandable-accessory` is TypeScript only, so
  adding it changed `bun.lock` but requires no pod install or native rebuild.

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

- **The app-specific side stays in `features/`.** The native package's `index.ts` exports a typed
  view and nothing else — no state, store reads, or navigation. Its adapter is
  [features/navigation-dock/navigation-dock.tsx](../../features/navigation-dock/navigation-dock.tsx).
  Likewise, the expandable package knows only controlled `active`, an Expo Router `href`, React
  nodes, and route state. A consumer remains responsible for feature state and visuals under
  `features/`, while route files own the package outlets.
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

- **There is no workout player.** Every "Start Workout" affordance is rendered `disabled` — in
  [features/home/home-content.tsx](../../features/home/home-content.tsx), in
  [features/workouts/workouts-content.tsx](../../features/workouts/workouts-content.tsx) and in the
  create panel — and `mods.primaryActionButtonDisabled` in [theme/modifiers.ts](../../theme/modifiers.ts)
  exists so those TODOs are dropped together. The `Workout` document type and the workout store are
  in place; nothing writes a workout yet.
- **All three global create actions are stubs** — Start Workout, New Routine and Custom Exercise
  each ship `enabled: false` in
  [features/navigation-dock/navigation-dock-actions.ts](../../features/navigation-dock/navigation-dock-actions.ts),
  and native swallows their touches. See [navigation.md](navigation.md) for the panel itself.
- **There is no automated test suite.** No test runner is installed; `bun run type-check` is the
  verification gate, with `bun run lint` and `bun run format:check` alongside it.
- **There is no Android project**, by decision — see [AGENTS.md](../../AGENTS.md). Reviving it is a
  project-wide change, not a per-component one.
- **`ios/hipefit-watch Watch App/` is an unmodified Xcode template** (a "Hello, world!" `ContentView`)
  with schemes wired up per environment. There is no watch feature.
