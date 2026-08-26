---
type: app
status: current
area: code-style
updated: 2026-08-21
---

# Code style and authoring

This document defines module shapes, naming, comments, and decomposition for current work. UI rules
such as modifier order, typography, color, lists, haptics, and motion belong to [ui.md](ui.md).
Layer boundaries are documented in [architecture.md](architecture.md). Unconditional repository
rules live in [`AGENTS.md`](../../AGENTS.md).

## Match the local context

Match the file you are editing and the files beside it unless this document states a migration rule.
Preserve comments that record measured values or deliberate divergences. Examples include
[`avatar.tsx`](../../apps/mobile/src/features/avatar/avatar.tsx) and
[`row-metrics.ts`](../../apps/mobile/src/features/exercises/row-metrics.ts).

Two standards are still being applied to older files: one named component per file, and non-React
logic extracted from component files. New code follows both. When editing an older file, move it
toward these standards without expanding the task into unrelated cleanup.

## Module vocabulary

| Kind                     | Location                                                             | Shape                                                         |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| Route                    | [`apps/mobile/app/**/*.tsx`](../../apps/mobile/app)                  | `export default function Name()`                              |
| Screen island            | [`apps/mobile/src/features/<name>/`](../../apps/mobile/src/features) | `export const NameContent: React.FC = () => ...`              |
| Feature component        | [`apps/mobile/src/features/<name>/`](../../apps/mobile/src/features) | `export const Thing: React.FC<ThingProps> = (...) => ...`     |
| App component            | [`apps/mobile/src/components/`](../../apps/mobile/src/components)    | App-specific React Native wrapper                             |
| Shared SwiftUI component | [`packages/ui/src/`](../../packages/ui/src)                          | Host-less primitive exported by `@hipefit/ui`                 |
| Hook                     | [`apps/mobile/src/hooks/`](../../apps/mobile/src/hooks) or a feature | `export const useThing = (...): T => ...`                     |
| Store                    | [`apps/mobile/src/stores/`](../../apps/mobile/src/stores)            | `export const useNameStore = create<NameState>(...)`          |
| Service                  | [`apps/mobile/src/services/`](../../apps/mobile/src/services)        | Named functions that execute app-specific Firebase operations |
| Helper or constants      | [`apps/mobile/src/lib/`](../../apps/mobile/src/lib) or a feature     | Named exports, no default export                              |

The `@/*` alias maps to [`apps/mobile/src/*`](../../apps/mobile/src). It does not map to the
repository root or to `apps/mobile/app`. Workspace packages are imported by package name.

### Routes

Expo Router requires default exports, so route files are the only normal use of `export default`.
Keep a route to navigation chrome and one feature island. The Home route is the canonical example:
[`apps/mobile/app/(private)/(home)/index.tsx`](<../../apps/mobile/app/(private)/(home)/index.tsx>).
Navigation conventions are in [navigation.md](navigation.md).

[`apps/mobile/app/(private)/exercises/index.tsx`](<../../apps/mobile/app/(private)/exercises/index.tsx>)
is a documented exception. Its virtualized list and list state stay in the route because the screen
is the list. Do not copy that structure to ordinary screens.

### Components

Components are arrow functions typed with `React.FC`. Props use an exported interface with a doc
comment for each field. Put defaults in the destructure.

```tsx
import type React from 'react';

export interface ChipProps {
  /** Text shown inside the capsule. */
  label: string;
  /** Status treatment. @default 'secondary' */
  variant?: ChipVariant;
}

export const Chip: React.FC<ChipProps> = ({ label, variant = 'secondary' }) => (
  <Text>{label}</Text>
);
```

The standard has four parts:

- Use an arrow function with typed, destructured props.
- Type the component as `React.FC<Props>`, or `React.FC` when it has no props.
- Export the props interface as `<Component>Props`. Declare `children` explicitly when the component
  accepts it.
- Use an expression body for one expression. Use a block when the component has hooks, derived
  values, or branches.

[`Avatar`](../../apps/mobile/src/features/avatar/avatar.tsx) and
[`HomeHeader`](../../apps/mobile/src/features/home/home-header.tsx) show the current component
signature. Older unannotated arrow components and function declarations are migration gaps, not
alternate conventions.

The app-owned React Native wrappers are deliberate boundary modules:

- [`text.tsx`](../../apps/mobile/src/components/text.tsx) wraps React Native `Text`, extends the
  wrapped component's props inline, and exports `TextVariant`.
- [`progress.tsx`](../../apps/mobile/src/components/progress.tsx) keeps its props local.
- [`image.tsx`](../../apps/mobile/src/components/image.tsx) re-exports `expo-image`'s `Image`.

These wrappers own app-specific React Native behavior. They do not belong in `@hipefit/ui`, whose
current exports are the host-less SwiftUI `Card`, `Chip`, and `Separator` plus semantic colors.

### One named component per file

Every component gets its own file and a name. This includes a component used once by the file beside
it. If it returns JSX as a component, it lives alone rather than as a file-local declaration.

A screen island should read as a composition of named parts. Extract sections, rows, headers, and
placeholders before the island becomes a large inline tree. Keep the extracted contract as narrow as
its current caller needs; extraction is not a reason to add speculative props.

Placement follows ownership:

- A component used by one feature stays under
  [`apps/mobile/src/features/<name>/`](../../apps/mobile/src/features).
- App-specific React Native primitives live in
  [`apps/mobile/src/components/`](../../apps/mobile/src/components).
- Reusable host-less SwiftUI primitives live in [`packages/ui/src/`](../../packages/ui/src) and are
  exported by `@hipefit/ui`.

When extracting a component, move comments that explain its behavior or measured layout into the new
file. Do not leave the reasoning attached to the old call site.

### Hooks

A hook is a `use`-prefixed arrow function with an explicit return type. Cross-feature hooks live in
[`apps/mobile/src/hooks/`](../../apps/mobile/src/hooks). A hook used by one feature stays in that
feature, such as [`use-clock.ts`](../../apps/mobile/src/features/home/use-clock.ts).

[`use-app-color-scheme.ts`](../../apps/mobile/src/hooks/use-app-color-scheme.ts) is a small selector
that names a shared mapping. `use-clock.ts` shows the effect rule: every listener and timer is removed
by the returned cleanup.

### Stores

Domain and cross-cutting Zustand stores live in
[`apps/mobile/src/stores/`](../../apps/mobile/src/stores), not inside features. Keep the state
interface file-local and declare actions beside data.

```ts
interface UserState {
  _uid: string | null;
  profile: UserProfile | null;
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
}
```

The data-store contract is:

- `subscribe(uid)` returns a teardown that removes service listeners and restores initial state,
  including `isLoading: true`.
- Listener errors use store-specific prefixes and complete the failed listener's loading condition.
- Stores publish state and expose actions. They do not import React Native Firebase query or write
  functions.
- A leading underscore marks internal state such as `_uid`.
- Screens never call `subscribe`. Lifetime belongs to
  [`use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts).

[`useUserStore`](../../apps/mobile/src/stores/use-user-store.ts) is the smallest complete data-store
example. [`useExerciseStore`](../../apps/mobile/src/stores/use-exercise-store.ts) coordinates five
decoded catalogue sources and a user-store subscription. [`useAuthStore`](../../apps/mobile/src/stores/use-auth-store.ts)
produces the UID, so it has an idempotent `initialize()` lifecycle instead of `subscribe(uid)`.
[`useNavigationDockStore`](../../apps/mobile/src/stores/use-navigation-dock-store.ts) is UI state and
has no Firebase lifecycle.

### Services

Mobile Firebase operations live in [`apps/mobile/src/services/`](../../apps/mobile/src/services).
Services import SDK refs from `@hipefit/firebase/react-native` and contracts, decoders, and write
assertions from `@hipefit/schemas`.

- [`auth-service.ts`](../../apps/mobile/src/services/auth-service.ts) owns auth subscription, Apple
  credential exchange, sign-out, and user-profile provisioning.
- [`user-service.ts`](../../apps/mobile/src/services/user-service.ts) owns profile and newest
  measurement listeners plus user writes.
- [`exercise-service.ts`](../../apps/mobile/src/services/exercise-service.ts) owns the five exercise
  catalogue listeners and snapshot decoding.

Services return data or invoke typed handlers. They do not import Zustand stores or React
components. Stores call services and translate their results into application state.

### Packages and feature logic

Use package boundaries rather than app source paths when code is shared by responsibility:

- `@hipefit/schemas` owns persisted contracts, validation, and Firestore path strings.
- `@hipefit/firebase/react-native` owns React Native Firebase instances and ref builders.
- `@hipefit/ui` owns shared SwiftUI primitives and semantic colors.

Pure logic used by one mobile feature stays in that feature. Exercise catalogue construction and
view models live in
[`exercise-catalogue.ts`](../../apps/mobile/src/features/exercises/exercise-catalogue.ts), and the
locale fallback lives in
[`exercise-localization.ts`](../../apps/mobile/src/features/exercises/exercise-localization.ts). The
store and service import the feature contract without moving state or Firebase operations into the
feature.

Do not import a file under [`packages/`](../../packages) through `@/` or a relative path. If a
workspace imports a package, its `package.json` declares that package at `workspace:*`.

### Helpers and constants

Use named exports and explicit return types. Shared mobile formatting belongs in
[`apps/mobile/src/lib/format.ts`](../../apps/mobile/src/lib/format.ts), haptics in
[`haptics.ts`](../../apps/mobile/src/lib/haptics.ts), and shared values in
[`constants.ts`](../../apps/mobile/src/lib/constants.ts). Do not create a generic `utils.ts`.

Check [`apps/mobile/src/lib/`](../../apps/mobile/src/lib) before adding a local helper. Casing,
greetings, unit conversion, and calendar date helpers already exist. Measured native constants stay
beside the feature that measured them, as in
[`row-metrics.ts`](../../apps/mobile/src/features/exercises/row-metrics.ts).

Wrappers get intent names such as `hapticSuccess`, not names copied from the wrapped implementation.
Call sites should state what happened.

### Extract non-React logic

A function that is not a component or hook belongs in a helper module unless it is private machinery
that enforces that module's own contract. Component files hold JSX and wiring. Mapping, formatting,
sorting, filtering, arithmetic, and reusable modifier construction are named and extracted.

Placement:

- Logic used by one feature goes in a feature helper, such as
  [`avatar-utils.ts`](../../apps/mobile/src/features/avatar/avatar-utils.ts), or in a named helper
  directory for a large feature such as
  [`calendar/helpers/`](../../apps/mobile/src/features/calendar/helpers).
- Shared mobile helpers go in [`apps/mobile/src/lib/`](../../apps/mobile/src/lib), grouped by subject.
- Pure projection over decoded contracts used by one feature stays in that feature.

Helpers are pure when their job is derivation: arguments in, value out, with no component state or
store reads. Pass store data as an argument. An inline `onPress={() => setOpen(true)}` is component
wiring and can stay inline; an inline callback that computes a domain value should be extracted.

Module-private enforcement is the main exception. The private `fire` function in
[`haptics.ts`](../../apps/mobile/src/lib/haptics.ts) gates on platform behavior and swallows rejected
haptic promises. Exporting it would expose machinery callers should not bypass, so it stays private
with an explanatory comment.

## Recipes

### Add a component

1. Give it its own lowercase-hyphenated file.
2. Put a feature-specific component under `apps/mobile/src/features/<name>/`.
3. Put an app-specific React Native primitive under `apps/mobile/src/components/`.
4. Put a reusable host-less SwiftUI primitive under `packages/ui/src/` and export it from
   `@hipefit/ui`.
5. Order the file as imports, module constants, exported props interface, component doc comment, and
   exported `React.FC` arrow component.
6. Move computation to a helper and preserve comments that explain behavior or measured layout.
7. Apply [ui.md](ui.md) for colors, modifier order, typography, and `Host` placement.

### Add a hook

Use `apps/mobile/src/hooks/use-<thing>.ts` for a cross-feature hook or keep it in one feature. Give it
an explicit return type. If it subscribes, return a cleanup that removes every listener and timer.

### Add a store

Create `apps/mobile/src/stores/use-<name>-store.ts` only for a new state domain. A new slice of an
existing domain belongs on its existing store. If the store reads Firestore, add app-specific SDK
operations to a service, expose `subscribe(uid)` with a teardown, and register the store in
[`use-firestore-subscriptions.ts`](../../apps/mobile/src/hooks/use-firestore-subscriptions.ts). Read
[database.md](database.md) first.

### Add a service

Create `apps/mobile/src/services/<domain>-service.ts` for app-specific Firebase operations. Import
refs from `@hipefit/firebase/react-native`, validate persisted data through `@hipefit/schemas`, and
return values or typed callbacks without importing stores.

### Add a helper

Start with a helper instead of leaving computation inline. Use a feature helper for one feature,
or `apps/mobile/src/lib/` for shared mobile behavior. Use a named export and explicit return type.

### Add a screen

Create a route under [`apps/mobile/app/`](../../apps/mobile/app) for navigation chrome and a screen
island under [`apps/mobile/src/features/<name>/`](../../apps/mobile/src/features) for the body. The
island owns its `Host` and store reads. The route does not call services.

## TypeScript

[`apps/mobile/tsconfig.json`](../../apps/mobile/tsconfig.json) extends Expo's base and the shared
strict configuration in [`packages/config/tsconfig.json`](../../packages/config/tsconfig.json). The
root [`tsconfig.json`](../../tsconfig.json) extends the same shared configuration for Firebase,
scripts, and every TypeScript source file under `packages/`. Package files are checked even before a
consumer imports or re-exports them.

Settings that affect authoring:

- `noUncheckedIndexedAccess`: `array[0]` is `T | undefined`. Guard it or use a lookup that expresses
  the intended absence. Do not use `!` to silence it.
- `noUnusedLocals` and `noUnusedParameters`: unused imports and parameters fail type-check.
- `noImplicitReturns` and `noFallthroughCasesInSwitch` are enabled.
- Do not use `any`. Narrow `unknown` instead.
- Use `interface` for object shapes and `type` for unions and aliases.
- Give exported functions and hooks explicit return types. Components use `React.FC`.
- Firestore documents enter the app as decoded `WithId<T>` values from `@hipefit/schemas`.
- Use `as const` for value literals, not for `@expo/ui` modifier arrays. Read
  [ui.md](ui.md#where-styles-live) before sharing modifier arrays.

Both TypeScript configurations map `@/*` to `apps/mobile/src/*`. Imports such as
`@/theme/colors` stay within mobile source. Import workspace packages by names such as
`@hipefit/schemas` and `@hipefit/firebase/react-native`.

## Naming and imports

- Files and directories are lowercase-hyphenated: `exercise-row.tsx`, `use-user-store.ts`, and
  `row-metrics.ts`.
- Components are PascalCase and match their file names.
- Variables and functions are camelCase.
- Module constants use `SCREAMING_SNAKE_CASE`. Modifier arrays use a `_MODIFIERS` suffix.
- Hooks start with `use`, stores use `use<Domain>Store`, and screen islands use `<Name>Content`.
- Use named exports except where Expo Router requires a route default export.

Prettier configuration in [`.prettierrc.js`](../../.prettierrc.js) sorts imports in this order:
types, React and React Native, third-party and workspace packages, `@/` imports, then relative
imports. Run Prettier instead of ordering them by hand.

## Comments carry reasoning

Comments should record facts a reader cannot recover from the code. Keep them for these cases:

- A non-obvious alternative was rejected for a concrete reason.
- A measured value records the device, OS, measurement, and re-measure instruction.
- A dependency behavior is pinned to the checked version.
- Order-dependent code records the symptom and required order.
- A deliberate deviation from a documented rule explains why it exists.

[`calendar/components/day.tsx`](../../apps/mobile/src/features/calendar/components/day.tsx) explains
why the cell receives `isOutsideMonth` instead of reading library metadata directly.
[`row-metrics.ts`](../../apps/mobile/src/features/exercises/row-metrics.ts) records measured device and
OS conditions and says to re-measure rather than derive. [`haptics.ts`](../../apps/mobile/src/lib/haptics.ts)
records the checked `@expo/ui` version. [`packages/ui/src/card.tsx`](../../packages/ui/src/card.tsx)
explains why `frame` must sit between `padding` and `background`, including the uneven-width symptom
that exposed the order dependency.

Delete comments that restate the line below them. Keep comments that explain redaction instead of an
early return, listener ownership, bridge behavior, or measured geometry.

## Known migration gaps

The one-component-per-file rule is newer than some source. Current file-local components include:

| File                                                                                              | Components to extract when the file is changed                                         |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`workouts-content.tsx`](../../apps/mobile/src/features/workouts/workouts-content.tsx)            | `SectionHeader`, `PlaceholderWorkoutTemplateCard`, `PlaceholderHistoryRow`, `EmptyRow` |
| [`exercises/index.tsx`](<../../apps/mobile/app/(private)/exercises/index.tsx>)                    | `ItemSeparator`                                                                        |
| [`calendar/components/pager.tsx`](../../apps/mobile/src/features/calendar/components/pager.tsx)   | `RollingPager`                                                                         |
| [`settings/edit-profile-form.tsx`](../../apps/mobile/src/features/settings/edit-profile-form.tsx) | `LoadedEditProfileForm`                                                                |

Examples of computation still in component or hook files include `counterModifiers` in
[`home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx) and
`msUntilNextBoundary` in [`use-clock.ts`](../../apps/mobile/src/features/home/use-clock.ts). Extract a
gap when working in that area. Do not use it as precedent for new code.

## TODOs and unfinished work

Do not leave a bare `TODO`. Unshipped actions render disabled with a comment naming what they wait
on. Actions that wait on the same capability should share one modifier or flag. For example,
`mods.primaryActionButtonDisabled` in
[`apps/mobile/src/theme/modifiers.ts`](../../apps/mobile/src/theme/modifiers.ts) keeps both Add to
Workout buttons disabled until the workout player exists. Current absences are listed in
[architecture.md](architecture.md#deliberately-absent).

## Verification

For code changes, run:

```bash
bun run type-check
bun run lint
bunx prettier --write <files-touched>
```

Type-check runs first because type errors can invalidate lint results. Root
[`eslint.config.js`](../../eslint.config.js) extends `@hipefit/config/eslint` and ignores generated or
vendored directories documented in that file. Husky and `lint-staged` are configured in
[`package.json`](../../package.json), but the pre-commit hook does not replace the type-check gate.

Adding or removing native code also requires
running `pod install` from `apps/mobile/ios/` and committing the resulting
[`apps/mobile/ios/Podfile.lock`](../../apps/mobile/ios/Podfile.lock) change.

Markdown is covered by `format:check`, so format every edited document. Documentation placement,
frontmatter, and link conventions are in [`docs/README.md`](../README.md).
