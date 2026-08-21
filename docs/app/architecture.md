---
type: app
status: current
area: architecture
updated: 2026-08-21
---

# Application architecture

Hipefit is an iOS-only Expo SDK 57 app in a Bun workspace. The Expo app uses the bare workflow and
lives under [`apps/mobile/`](../../apps/mobile). This document describes the cross-feature layers,
their boundaries, and where new work belongs.

Rules that every agent must follow live in [`AGENTS.md`](../../AGENTS.md). The Firestore schema is
documented in [`docs/db-structure.md`](../db-structure.md).

## Layers

The mobile read path is split across these layers:

| Layer             | Location                                                                              | Owns                                                               |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Routes            | [`apps/mobile/app/`](../../apps/mobile/app)                                           | Expo Router files, navigation chrome, and one feature island       |
| Features          | [`apps/mobile/src/features/`](../../apps/mobile/src/features)                         | Screen bodies and feature-specific components                      |
| Stores            | [`apps/mobile/src/stores/`](../../apps/mobile/src/stores)                             | Zustand state, actions, and subscription-facing state updates      |
| Services          | [`apps/mobile/src/services/`](../../apps/mobile/src/services)                         | App-specific Firebase queries, listeners, provisioning, and writes |
| Firebase bindings | [`@hipefit/firebase/react-native`](../../packages/firebase/src/react-native/index.ts) | React Native Firebase SDK instances and typed ref builders         |
| Firebase          | [Firestore configuration](../../firebase/firebase.json)                               | Auth and persisted data                                            |

Cross-cutting mobile code sits beside those layers under
[`apps/mobile/src/`](../../apps/mobile/src): [`theme/`](../../apps/mobile/src/theme) holds shared
modifier arrays and React Native styles, [`components/`](../../apps/mobile/src/components) holds
app-owned React Native wrappers, [`lib/`](../../apps/mobile/src/lib) holds formatting, constants,
and haptics, and [`hooks/`](../../apps/mobile/src/hooks) holds cross-feature hooks.

Workspace packages under [`packages/`](../../packages) are imported through package contracts.
Portable Firestore contracts belong to `@hipefit/schemas`, framework-free catalogue and
localization logic belongs to `@hipefit/domain`, and SDK-bound refs belong to
`@hipefit/firebase/react-native`. This keeps Firebase calls out of stores without forcing unrelated
consumers through one SDK-neutral Firebase API.

## Feature organization

A screen is a route plus a feature island. The route owns navigation chrome such as
`Stack.Screen.Title`, toolbars, and search bars. It renders a component from
[`apps/mobile/src/features/`](../../apps/mobile/src/features), which owns the screen body and reads
the stores it needs. Compare the canonical pair:

- [`apps/mobile/app/(private)/(home)/index.tsx`](<../../apps/mobile/app/(private)/(home)/index.tsx>)
- [`apps/mobile/src/features/home/home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx)

The split keeps Expo Router's routing tree separate from screen composition. It also isolates
navigation declarations that must remain literal children of Router components from the screen body
that changes more often.

Most feature directories are flat:

- `<name>-content.tsx` is the island rendered by the route, as in
  [`workouts-content.tsx`](../../apps/mobile/src/features/workouts/workouts-content.tsx) and
  [`settings-content.tsx`](../../apps/mobile/src/features/settings/settings-content.tsx).
- A component that needs its own name gets its own file, as in
  [`home-header.tsx`](../../apps/mobile/src/features/home/home-header.tsx) and
  [`exercise-row.tsx`](../../apps/mobile/src/features/exercises/exercise-row.tsx).
- Measured native constants stay with the feature that measured them, as in
  [`row-metrics.ts`](../../apps/mobile/src/features/exercises/row-metrics.ts) and
  [`navigation-dock-metrics.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-metrics.ts).

Stores and Firebase operations are not feature-local. Domain stores live in
[`apps/mobile/src/stores/`](../../apps/mobile/src/stores), and SDK operations live in
[`apps/mobile/src/services/`](../../apps/mobile/src/services). Feature components import them through
the `@/` alias, which maps to [`apps/mobile/src/`](../../apps/mobile/src).

The exercises route is a documented exception to the thin-route rule.
[`apps/mobile/app/(private)/exercises/index.tsx`](<../../apps/mobile/app/(private)/exercises/index.tsx>)
owns its virtualized list, search state, expansion state, and detail-sheet selection because the
screen is the list. It is not a template for other routes.

[`apps/mobile/src/features/auth/index.tsx`](../../apps/mobile/src/features/auth/index.tsx) retains a
generic `index.tsx` name from an earlier layout. New screen islands use the `<name>-content.tsx`
convention instead.

[`apps/mobile/src/features/calendar/`](../../apps/mobile/src/features/calendar) is deliberately
grouped into `components/`, `helpers/`, and `hooks/` behind
[`index.tsx`](../../apps/mobile/src/features/calendar/index.tsx). The calendar is large enough that a
flat directory no longer shows which modules are public. Code outside the feature imports its
component and types through `@/features/calendar`. Copy this structure only when a feature reaches a
similar size.

[`apps/mobile/src/features/navigation-dock/`](../../apps/mobile/src/features/navigation-dock) has no
screen route. The private layout mounts it as the React adapter for the native create panel. Its UI
state lives in
[`use-navigation-dock-store.ts`](../../apps/mobile/src/stores/use-navigation-dock-store.ts) because
the trigger and panel are mounted in different parts of the route layout. Its navigation contract is
documented in [navigation.md](navigation.md).

## Stores

Zustand stores are module-level singletons created with `create()` under
[`apps/mobile/src/stores/`](../../apps/mobile/src/stores):

| Store                                                                                 | Holds                                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`useAuthStore`](../../apps/mobile/src/stores/use-auth-store.ts)                      | Firebase user, auth loading state, Apple sign-in, and sign-out           |
| [`useUserStore`](../../apps/mobile/src/stores/use-user-store.ts)                      | Profile, newest body measurement, current weight, and user write actions |
| [`useExerciseStore`](../../apps/mobile/src/stores/use-exercise-store.ts)              | Localized and visibility-filtered exercise catalogue view models         |
| [`useNavigationDockStore`](../../apps/mobile/src/stores/use-navigation-dock-store.ts) | Whether the native create panel is expanded                              |

Zustand is used instead of React context because subscription orchestration drives stores through
`getState()` outside component trees, while components can select narrow slices.

The two Firestore data stores expose `subscribe(uid)`, which returns a teardown. A teardown removes
the service listeners and restores the store's initial loading state. They do not expose separate
`reset()` actions. The navigation-dock store is UI state and has no Firestore lifecycle.

Data-store conventions:

- Every Firestore listener has an error callback. The service forwards errors to the owning store,
  which logs a store-specific prefix and completes that listener's loading condition. Most UI
  surfaces present a failed listener like empty data. If the user store finishes without a profile,
  the exercise catalogue clears its lists and shows an empty state because it cannot safely choose a
  locale or hidden-ref settings.
- Every snapshot crosses a decoder from `@hipefit/schemas` before publication. Malformed documents
  are logged and dropped instead of being trusted through a TypeScript cast.
- Loading drives redaction rather than an early return. Screens render their normal structure with
  plausible placeholders and apply `redacted('placeholder')`. See
  [`home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx) and
  [`modifiers.ts`](../../apps/mobile/src/theme/modifiers.ts).
- Stores own state and actions. Services own Firebase operations. Framework-free derivation belongs
  in `@hipefit/domain`.

The exercise store subscribes to five Firestore collections through
[`exercise-service.ts`](../../apps/mobile/src/services/exercise-service.ts). It keeps decoded raw
inputs in its subscription closure and calls
[`buildExerciseCatalogue`](../../packages/domain/src/exercises/catalogue.ts) whenever a source or a
relevant user setting changes. The package function localizes labels, resolves refs, filters hidden
or retired entries, and returns the published view models.

## Auth

[`useAuthStore`](../../apps/mobile/src/stores/use-auth-store.ts) does not use the data stores'
`subscribe(uid)` shape because it produces the UID. It delegates SDK work to
[`auth-service.ts`](../../apps/mobile/src/services/auth-service.ts) and exposes `initialize()`,
`signInWithApple()`, and `signOut()`.

`initialize()` is idempotent because the root layout, entry redirect, login route, and auth screen
all call it. The guard prevents each call from replacing the shared unsubscribe slot or letting one
caller's cleanup remove another caller's listener.

The auth service also owns first-run profile provisioning and restored-session repair. Every
authenticated callback ensures `users/{uid}` exists before the store publishes the user to the
protected app. Creation writes one document with default profile, body, and settings fields. Apple's
name-once behavior is handled by filling only missing name fields, so a non-empty user-edited display
name remains unchanged.

## Subscription orchestration

[`use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts) is the
only place data subscriptions start. It watches the auth user, starts the user and exercise stores
for that UID, and returns a teardown for both. The root layout mounts it once in
[`apps/mobile/app/_layout.tsx`](../../apps/mobile/app/_layout.tsx), above the protected route tree.

This starts data before a feature screen mounts, keeps tab switches from creating duplicate
listeners, and removes every user-scoped listener on sign-out. The consequence is that all seven
current snapshot listeners remain live for the authenticated session. The app does not subscribe to
workouts or workout templates.

## Firebase and data packages

The boundary has four parts:

- [`@hipefit/schemas`](../../packages/schemas/src/index.ts) owns persisted document interfaces,
  structural timestamps, `WithId<T>`, runtime decoders, write assertions, `Ref` strings, and path
  strings. It has no runtime dependencies or Firebase SDK import.
- [`@hipefit/domain`](../../packages/domain/src/index.ts) owns framework-free operations over those
  contracts. Its current implementation is the exercise catalogue merge and localization fallback.
- [`@hipefit/firebase/react-native`](../../packages/firebase/src/react-native/index.ts) owns React
  Native Firebase Auth and Firestore instances plus ref builders. It builds refs from path strings in
  `@hipefit/schemas`.
- [`apps/mobile/src/services/`](../../apps/mobile/src/services) owns the mobile app's query shapes,
  subscriptions, auth provisioning, and writes. It imports SDK operations directly and passes
  decoded values or errors to stores.

There is no app-local database barrel. App code imports contracts from `@hipefit/schemas`, catalogue
logic from `@hipefit/domain`, and refs or SDK instances from `@hipefit/firebase/react-native`.
Features normally reach Firebase-backed behavior through stores, not by calling services directly.
The full trust boundary is documented in [database.md](database.md).

## UI ownership

The UI vocabulary spans a shared package and app-local adapters:

- [`@hipefit/ui`](../../packages/ui/src/index.ts) owns the host-less SwiftUI `Card`, `Chip`, and
  `Separator` primitives plus semantic `colors`.
- [`apps/mobile/src/components/`](../../apps/mobile/src/components) owns app-specific React Native
  `Text`, `Progress`, and `Image` wrappers.
- [`apps/mobile/src/theme/colors.ts`](../../apps/mobile/src/theme/colors.ts) re-exports the package
  colors so existing mobile code has one app-local token import.
- [`apps/mobile/src/theme/modifiers.ts`](../../apps/mobile/src/theme/modifiers.ts) owns shared SwiftUI
  modifier arrays, while [`styles.ts`](../../apps/mobile/src/theme/styles.ts) owns shared React Native
  layout styles.

`Host` remains a one-way boundary between React Native and SwiftUI trees. Shared SwiftUI primitives
are host-less and compose inside a screen's `Host`. App React Native components are used in the React
Native tree, including through `RNHostView` where a SwiftUI tree explicitly hosts one. The placement,
modifier-order, typography, and color rules are documented in [ui.md](ui.md).

Fixed artwork may stay with its feature. For example,
[`avatar-backgrounds.ts`](../../apps/mobile/src/features/avatar/avatar-backgrounds.ts) owns Avatar's
reference swatches rather than treating artwork colors as semantic UI roles.

Shared formatting lives in [`apps/mobile/src/lib/format.ts`](../../apps/mobile/src/lib/format.ts).
It contains greeting and casing helpers, metric and imperial converters, and calendar date and label
formatters. Duration and volume helpers do not exist because workout persistence is not implemented.

## Workspace packages

[`package.json`](../../package.json) declares `apps/*` and `packages/*` workspaces. The current
packages are:

| Package                                                                         | Kind                  | Owns                                              |
| ------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------- |
| [`@hipefit/config`](../../packages/config/package.json)                         | Shared configuration  | TypeScript and ESLint bases                       |
| [`@hipefit/domain`](../../packages/domain/src/index.ts)                         | Pure TypeScript       | Framework-free catalogue and localization logic   |
| [`@hipefit/expandable-accessory`](../../packages/expandable-accessory/index.ts) | React                 | Router provider, slots, outlets, and zoom trigger |
| [`@hipefit/firebase`](../../packages/firebase/src/react-native/index.ts)        | SDK-bound TypeScript  | Target-specific Firebase instances and refs       |
| [`@hipefit/navigation-dock`](../../packages/navigation-dock/index.ts)           | Expo native view      | UIKit create panel, scrim, and bridge types       |
| [`@hipefit/schemas`](../../packages/schemas/src/index.ts)                       | Pure TypeScript       | Persisted contracts, validation, and path strings |
| [`@hipefit/ui`](../../packages/ui/src/index.ts)                                 | SwiftUI through React | `Card`, `Chip`, `Separator`, and semantic colors  |

Package contracts are imported by name, never through a relative path into `packages/`. Each
workspace that imports a package declares it at `workspace:*` in its own `package.json`.
The root TypeScript program includes every `.ts` and `.tsx` file under `packages/`, including source
that no consumer imports yet.

`@hipefit/firebase` exposes a React Native entry instead of pretending every Firebase SDK has one
shared API. A future SDK target gets its own entry point. `@hipefit/domain` and `@hipefit/schemas`
remain free of React and React Native Firebase so non-mobile consumers can reuse them.

`@hipefit/navigation-dock` has Swift source, a podspec, `expo-module.config.json`, and a typed
`requireNativeView` bridge. `@hipefit/expandable-accessory` is React-only because it coordinates a
provider across the NativeTabs and root Stack trees. The mobile adapter for the native package stays
in
[`navigation-dock.tsx`](../../apps/mobile/src/features/navigation-dock/navigation-dock.tsx), where it
can read app state and navigation.

The install layout is pinned. Bun's isolated linker prevents Expo's Metro dependencies from being
resolved from the workspace root, so [`bunfig.toml`](../../bunfig.toml) selects the hoisted linker.
If a source file imports a dependency, the importing workspace declares it rather than relying on a
transitive hoist.

Native bridge prop and event names appear in both the Swift `ModuleDefinition` and the TypeScript
entry point. Nothing checks that they match: unknown props are dropped and unknown events never
reach JavaScript. Rename both sides together.

## Environments

Each environment has its own bundle identifier, Xcode scheme, Firebase project, and App Store
Connect record:

| Environment | Scheme          | Bundle identifier                         | Info.plist                                                           |
| ----------- | --------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| development | `Hipefit-dev`   | `com.kyrylokorota.hipefitapp.development` | [`Info-dev.plist`](../../apps/mobile/ios/Hipefit/Info-dev.plist)     |
| staging     | `Hipefit-stage` | `com.kyrylokorota.hipefitapp.staging`     | [`Info-stage.plist`](../../apps/mobile/ios/Hipefit/Info-stage.plist) |
| production  | `Hipefit`       | `com.kyrylokorota.hipefitapp`             | [`Info-prod.plist`](../../apps/mobile/ios/Hipefit/Info-prod.plist)   |

Environment selection is native. All three Firebase plist files are bundled, and
[`AppDelegate.swift`](../../apps/mobile/ios/Hipefit/AppDelegate.swift) selects one from the bundle
identifier before configuring Firebase. Stores and screens do not choose a Firebase environment.

Root `ios:*` scripts in [`package.json`](../../package.json) delegate to
[`apps/mobile/package.json`](../../apps/mobile/package.json), which copies the matching root
`.env.<environment>` file to `apps/mobile/.env.local` and launches the correct scheme.
[`apps/mobile/eas.json`](../../apps/mobile/eas.json) maps the same environment names to build and
submit profiles.

The committed [`apps/mobile/ios/`](../../apps/mobile/ios) directory is authoritative for native
configuration. [`apps/mobile/app.config.ts`](../../apps/mobile/app.config.ts) contains only Expo-level
settings. New Architecture is enabled in
[`Podfile.properties.json`](../../apps/mobile/ios/Podfile.properties.json). Adding or removing native
code requires running `pod install` from `apps/mobile/ios/` and committing the resulting
[`Podfile.lock`](../../apps/mobile/ios/Podfile.lock) change.

## Deliberately absent

- There is no workout player. Start and Add to Workout affordances remain disabled. Workout and
  workout-template contracts and validation exist, but there is no app ref, listener, store, or
  write path for either collection.
- The three global create actions are disabled in
  [`navigation-dock-actions.ts`](../../apps/mobile/src/features/navigation-dock/navigation-dock-actions.ts).
- There is no automated test runner. `bun run type-check` is the primary code gate, with
  `bun run lint` and `bun run format:check` beside it.
- There is no Android project. Reviving Android is a project-wide decision recorded in
  [`AGENTS.md`](../../AGENTS.md).
- [`apps/mobile/ios/hipefit-watch Watch App/`](<../../apps/mobile/ios/hipefit-watch Watch App>) is an
  unmodified Xcode template. It does not implement a watch feature.
