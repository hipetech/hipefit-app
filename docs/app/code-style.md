---
type: app
status: current
area: code-style
updated: 2026-08-12
---

# Code style and authoring

How to write code in this repository: the shape each kind of module takes, where a new piece of
work goes, and the conventions that are not enforced by a tool.

This document is about **authoring mechanics**. It is not the UI authority — modifier order,
typography, color, lists, haptics and motion belong to [ui.md](ui.md), and the layer boundaries this
document assumes are argued in [architecture.md](architecture.md). Unconditional rules an agent must
know before reading anything live in [AGENTS.md](../../AGENTS.md), which links here for the detail.

## The one rule behind the rest

**Match the file you are editing, and the files beside it** — except where this document says
otherwise. Most conventions here were read off the existing code. Where a file deliberately diverges
it says so in a comment, and that comment is the specification — see the "documented divergence"
cases in [ui/avatar.tsx](../../ui/avatar.tsx) and
[features/exercises/row-metrics.ts](../../features/exercises/row-metrics.ts).

The two decomposition rules — [one component per
file](#maximum-decomposition-one-component-per-file) and [logic
extracted](#logic-is-extracted-not-inlined) — are the exception: they are a **standard the codebase
is being moved to**, not a description of it. New and edited code follows them. The files that do
not yet are listed under [Known gaps](#known-gaps) rather than left for you to discover.

## Module vocabulary

Six kinds of module. Each has one shape, and picking the right one is most of the decision.

| Kind             | Lives at                                     | Shape                                              |
| ---------------- | -------------------------------------------- | -------------------------------------------------- |
| Route            | `app/**/*.tsx`                               | `export default function Name()`                   |
| Screen island    | `features/<name>/<name>-content.tsx`         | `export const NameContent = () => …`, no props     |
| Component        | `features/<name>/<thing>.tsx`, `ui/*.tsx`    | `export const Thing = ({ … }: ThingProps) => …`    |
| Hook             | `hooks/use-*.ts`, `features/<name>/use-*.ts` | `export const useThing = (…): T => …`              |
| Store            | `features/<name>/store/use-<name>-store.ts`  | `export const useNameStore = create<NameState>(…)` |
| Helper/constants | `lib/*.ts`, `features/<name>/*-helpers.ts`   | Named `export const` per value; no default export  |

`features/<name>/…` in that table means the feature's flat directory, which is what eight of the nine
features are. [features/calendar/](../../features/calendar) groups the same six kinds into
`components/`, `helpers/` and `hooks/` behind an `index.tsx`; the shapes are unchanged, only where
the files sit. [architecture.md](architecture.md#feature-based-organization) records why, and when
copying it is warranted.

### Routes

A route file is the only place `export default` appears, because Expo Router requires it. It is
named for the route, not the screen body: `Home`, `Workouts`, `SettingsLayout`. Keep it thin —
navigation chrome plus one island from `features/`, as in
[app/(private)/(home)/index.tsx](<../../app/(private)/(home)/index.tsx>). Chrome rules are in
[navigation.md](navigation.md).

[app/(private)/exercises/index.tsx](<../../app/(private)/exercises/index.tsx>) holds list state in
the route file because the screen _is_ the list. It is a documented exception, not a template.

### Components

```tsx
export interface ChipProps {
  /** Text shown inside the capsule. */
  label: string;
  /** Status treatment. @default 'secondary' */
  variant?: ChipVariant;
}

export const Chip = ({ label, variant = 'secondary' }: ChipProps) => (
  <Text modifiers={[foregroundStyle(labelColor[variant])]}>{label}</Text>
);
```

Four things are load-bearing there, and every component in the repo follows them
([ui/chip.tsx](../../ui/chip.tsx), [ui/card.tsx](../../ui/card.tsx),
[features/workouts/routine-card.tsx](../../features/workouts/routine-card.tsx),
[features/exercises/exercises-empty.tsx](../../features/exercises/exercises-empty.tsx)):

- **Arrow function with destructured, typed props.** Not `React.FC`, not `function`, and not a
  props object read through a parameter name. `React.FC` appears nowhere in the codebase — it adds
  an implicit `children` and buys nothing under TypeScript 6.
- **Defaults in the destructure**, never inside the body, so the signature is the whole contract.
- **Props are an exported `interface`** named `<Component>Props`, with a doc comment per prop and
  the default recorded as `@default`. Exported even when nothing imports it yet: it is the
  component's published contract.
- **Implicit return when the body is one expression**; a block body only once there are hooks or
  derived values.

The two plain-RN primitives are the sanctioned exceptions.
[ui/text.tsx](../../ui/text.tsx) extends React Native's own `Text` props inline instead of declaring
an interface, and exports only the `TextVariant` union;
[ui/progress.tsx](../../ui/progress.tsx) keeps `ProgressProps` file-local. Both are documented in
[ui.md](ui.md#component-files-and-props).

### Maximum decomposition: one component per file

**Every component gets its own file and is exported. No file-local components, at any size, at any
call-site count.** A component that exists only to be used once in the file next to it still gets a
file, a name, an exported `Props` interface, and a doc comment.

This is a stronger rule than "one _exported_ component per file". The test is not "is it reused" or
"is it big enough" — it is "is it a component". If it returns JSX, it is a component, and it lives
alone.

The same applies to the JSX you have not extracted yet. When a screen body grows a section, a row, a
header or a placeholder that could be named, that is a component: name it and move it out rather
than letting the island absorb it. A screen island should read as a composition of named parts, not
as a tree with inline branches.

Where the file goes:

- used by one feature → `features/<name>/<thing>.tsx`;
- used by more than one feature → [ui/](../../ui), subject to the host-side rules in
  [ui.md](ui.md#the-ui-primitives).

Decomposing early does **not** mean generalizing early. Extract the component with exactly the props
its one call site needs; widen the contract only when a second call site actually asks for it. A
single-use component in its own file is correct, a single-use component with five speculative props
is not.

**When you extract, the reasoning goes with it.** Comments explaining why a component looks the way
it does belong in the new file, not left behind in the parent — see
[Comments carry the reasoning](#comments-carry-the-reasoning).

### Hooks

A hook is a `use`-prefixed arrow function with an **explicit return type**, in a file named after
it. Cross-feature hooks live in [hooks/](../../hooks); a hook only one feature uses stays beside it,
like [features/home/use-clock.ts](../../features/home/use-clock.ts).

Two patterns worth copying. [hooks/use-app-color-scheme.ts](../../hooks/use-app-color-scheme.ts) is
a one-line store selector that exists to name a mapping used in several places. `use-clock.ts` is
the other end — a subscription with a timer, an `AppState` listener and a cleanup that tears down
both — and it shows the house rule for effects: **every listener and timer is removed in the
returned teardown**, no exceptions.

### Stores

One store per domain at `features/<name>/store/use-<name>-store.ts`. The state interface is
file-local and declares the actions alongside the data;
[useUserStore](../../features/user/store/use-user-store.ts) is the smallest complete example and the
one to copy.

```ts
interface UserState {
  _uid: string | null;
  profile: UserProfile | null;
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  reset: () => void;
}
```

The contract every data store implements:

- **`subscribe(uid)` returns a teardown that both detaches the listeners and clears the state**,
  including back to `isLoading: true`. `reset()` is the same clearing without the detach.
- **Every `onSnapshot` takes an error callback** logging with a `[StoreName]` prefix, and clearing
  `isLoading` where the store has a single listener.
- **Derived collections are computed in the snapshot handler**, not in the screen, so every consumer
  agrees on them.
- **A leading underscore marks internal state** — `_uid` is captured by `subscribe` and read through
  `get()`, never exported as a module-level variable.
- **Never call `subscribe` from a screen.** Lifetime belongs to
  [database/use-firestore-subscriptions.ts](../../database/use-firestore-subscriptions.ts).

[useAuthStore](../../features/auth/store/use-auth-store.ts) does not take this shape because it
produces the uid, and [useExerciseStore](../../features/exercises/store/use-exercise-store.ts) fans
out over four collections; read [architecture.md](architecture.md#state-one-zustand-store-per-domain)
before touching either.

### Helpers and constants

Named `export const` arrow functions with explicit return types, grouped by subject:
[lib/format.ts](../../lib/format.ts) for strings and dates, [lib/haptics.ts](../../lib/haptics.ts)
for feedback, [lib/constants.ts](../../lib/constants.ts) for shared values. No default exports, no
utility grab-bag, no classes.

**Check `lib/` before writing a local helper.** Most date, duration and volume strings already
exist. Measured native constants stay beside the feature that measured them
([features/exercises/row-metrics.ts](../../features/exercises/row-metrics.ts)).

Wrappers get **intent names**, not implementation names — `hapticSuccess`, not
`notificationAsync(Success)`. The point of the wrapper is that call sites say what happened.

### Logic is extracted, not inlined

**A function that is not a component and not a hook belongs in a helper module, not in the file that
happens to call it.** Component and screen files hold JSX and the wiring that renders it; the
computation behind them is named, exported and lives elsewhere.

What this covers: mapping a document to a view model, deriving a label, computing a modifier array,
formatting, sorting, filtering, any arithmetic beyond reading a field. If you can name it, it is a
helper.

Where it goes:

- used by one feature → `features/<name>/<subject>-helpers.ts`, or a named module when the subject
  deserves one (`row-metrics.ts` is the existing precedent);
- used by more than one feature → `lib/`, grouped by subject rather than dumped in a `utils.ts`.

Helpers are **pure and independently testable**: arguments in, value out, no store reads and no
component state. A function that needs store data takes it as a parameter — the caller does the
reading. That is what keeps the helper callable from anywhere and the component free of logic.

Callbacks passed to JSX are the boundary case. An inline `onPress={() => setOpen(true)}` is wiring
and stays; an inline callback that computes something is a helper wearing a disguise, and gets
extracted.

Two deliberate exceptions, both about encapsulation rather than size:

- **A module-private function that exists to enforce the module's own contract stays private.**
  `fire` in [lib/haptics.ts](../../lib/haptics.ts) is the case — it gates on platform and swallows
  rejections, and exporting it would publish machinery whose whole purpose is that call sites cannot
  bypass it. Keep such a function unexported, in the module it guards, and say why in a comment.
- **A closure that genuinely captures component state** — a value that cannot be passed as an
  argument without recreating the closure — stays where it is. This is rare; check whether the
  capture is real before claiming it, since most such functions turn out to be pure once their
  inputs are written out as parameters.

## Recipes

### Adding a component

1. **Its own file, always** — even for a single use, even for five lines. See
   [One component per file](#maximum-decomposition-one-component-per-file).
2. **Where.** One feature → `features/<name>/`. Two or more features → [ui/](../../ui). A `ui/`
   primitive must pick a side of the `Host` bridge: host-less SwiftUI (composes inside a screen's
   `Host`) or plain RN (never inside one). See [architecture.md](architecture.md#the-ui-layer).
3. **File.** `features/<name>/<thing>.tsx`, lowercase-hyphenated, named for the component.
4. **Write it** in the order every component file uses: imports → module-scope constants (styles,
   modifier arrays, lookup maps) → `export interface ThingProps` → doc comment → `export const
Thing`.
5. **Keep logic out of it.** Anything computed goes to a helper module — see
   [Logic is extracted, not inlined](#logic-is-extracted-not-inlined).
6. **Style it** per [ui.md](ui.md) — no hardcoded color, no hoisted-array splicing, no `as const` on
   a modifier array.
7. **Render it** from a screen island, not from a route file.
8. **Verify** with the command sequence below.

### Adding a hook

Cross-feature → `hooks/use-<thing>.ts`; otherwise `features/<name>/use-<thing>.ts`. Explicit return
type. If it subscribes to anything, return a teardown that removes **all** of it.

### Adding a store

Only for a new domain — a new slice of an existing domain is a field on the existing store. Copy the
`UserState` shape above, add `subscribe`/`reset`, wire it into
[database/use-firestore-subscriptions.ts](../../database/use-firestore-subscriptions.ts) (the one
place subscriptions start), and take its refs and types from `@/database`. Read
[database.md](database.md) first.

### Adding a helper

Write it as a helper from the start — do not inline it and plan to extract later. One feature →
`features/<name>/<subject>-helpers.ts`. More than one → `lib/`, extending `format.ts` /
`constants.ts` when the subject already exists there, a new file when it does not. Pure function,
explicit return type, exported.

### Adding a screen

Route file under `app/` (chrome, [navigation.md](navigation.md)) plus
`features/<name>/<name>-content.tsx` (body, its own store reads). The island owns the `Host`; the
route file owns nothing but chrome.

## TypeScript

[tsconfig.json](../../tsconfig.json) is stricter than `strict` alone, and two flags change how code
gets written:

- **`noUncheckedIndexedAccess`** — `array[0]` is `T | undefined`. Guard it or use `.find()`; do not
  reach for `!`.
- **`noUnusedLocals` / `noUnusedParameters`** — an unused import or parameter fails `type-check`,
  not just lint.

Also on: `noImplicitReturns`, `noFallthroughCasesInSwitch`. `@/*` maps to the repository root, so
imports are `@/theme/colors`, never a `../../` climb out of a directory.

Beyond that:

- **No `any`.** There are zero occurrences today; `unknown` plus a narrow is the answer.
- **`interface` for object shapes, `type` for unions and aliases** — `ChipProps` is an interface,
  `ChipVariant` and `Difficulty` are types.
- **Firestore documents cross into the app as `WithId<T>`** and are cast at the store boundary.
  Import both from `@/database` ([database/types.ts](../../database/types.ts)); the barrel is the
  import path, not the individual files.
- **Explicit return types on exported functions and hooks.** Components are exempt — the JSX return
  is self-evident.
- **`as const` is for value literals** — `BOUNDARY_HOURS` in `use-clock.ts`, `variantStyles` in
  `ui/text.tsx`. **Never on an `@expo/ui` modifier array** (TS4104); see
  [ui.md](ui.md#where-styles-live).

## Naming and files

- **Files and directories are lowercase-hyphenated**: `routine-card.tsx`, `use-user-store.ts`,
  `row-metrics.ts`. [ui/Image.tsx](../../ui/Image.tsx) is the single exception — a one-line
  `expo-image` re-export named after the symbol it forwards. Do not read it as a precedent.
- **Components are PascalCase**, matching their file: `routine-card.tsx` → `RoutineCard`.
- **Variables and functions are camelCase.** Module-scope constants are `SCREAMING_SNAKE`
  (`EMPTY_STATE_HEIGHT`, `HISTORY_PAGE_SIZE`, `GROUPED_ROW_RADIUS`), and file-local modifier arrays
  carry a `_MODIFIERS` suffix.
- **Hooks are `use`-prefixed**, stores are `use<Domain>Store`, screen islands are `<Name>Content`.
- **Named exports everywhere except route files.**

Imports are sorted by Prettier ([.prettierrc.js](../../.prettierrc.js)) into: types, then
`react`/`react-native`, then third party, then `@/`, then relative. Never hand-order them — run the
formatter.

## Comments carry the reasoning

This is the repository's most distinctive convention and the one most worth preserving. Comments
here do not restate the code; they record what a reader cannot recover from it. Four kinds earn
their place, and all four are **required** in the situations named:

**Why this and not the obvious alternative.**
[features/workouts/routine-card.tsx](../../features/workouts/routine-card.tsx) explains why its
three lines take no `monospacedDigit()` — they are sentence fragments, not standalone figures — so
nobody "fixes" them into consistency with the Activity counters.

**Measured values, with the conditions and a re-measure instruction.**
[features/exercises/row-metrics.ts](../../features/exercises/row-metrics.ts) records the device, the
OS version and the scan that produced each constant, then says **re-measure, do not re-derive**. A
measured number without its measurement is a magic number.

**Version-pinned findings about a dependency.** [lib/haptics.ts](../../lib/haptics.ts) names the
file and version it checked (`@expo/ui` 57.0.7) before concluding no `sensoryFeedback` modifier
exists. Pin the version, or the finding cannot be rechecked after an upgrade.

**Traps found the hard way.** [ui/card.tsx](../../ui/card.tsx) spends a paragraph on why `frame`
must sit between `padding` and `background`, including the symptom that exposed it (routine cards at
visibly uneven widths). The symptom is the valuable part.

Two rules follow:

- **Order-dependent code needs its reasoning inline** — a modifier array whose sequence matters, an
  effect whose cleanup order matters. [ui.md](ui.md#modifier-order-is-semantics) explains why order
  is semantics here.
- **A deliberate deviation from a documented rule must say so in the file.** An unexplained
  deviation reads as a bug and will be "corrected" by the next agent.

Delete comments that only restate the line below them. `// set loading to true` is noise; the
`isLoading` comment in a store that explains _redaction rather than an early return_ is not.

## Known gaps

The decomposition rules above are newer than the code. These are the files that predate them, found
by scanning for module-scope components and non-exported functions. Fix the ones you touch; do not
treat them as precedent.

**File-local components** — each needs its own file:

| File                                                                                   | Components                                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [features/workouts/workouts-content.tsx](../../features/workouts/workouts-content.tsx) | `SectionHeader`, `PlaceholderRoutineCard`, `PlaceholderHistoryRow`, `EmptyRow` |
| [app/(private)/exercises/index.tsx](<../../app/(private)/exercises/index.tsx>)         | `ItemSeparator`                                                                |

**Inlined logic** — each needs a helper module:

| File                                                                   | Functions                                |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| [features/home/home-content.tsx](../../features/home/home-content.tsx) | `toRecentWorkoutRow`, `counterModifiers` |
| [features/home/use-clock.ts](../../features/home/use-clock.ts)         | `msUntilNextBoundary`                    |

All of these are pure functions of their arguments — none captures component state — so each can be
extracted mechanically. `fire` in [lib/haptics.ts](../../lib/haptics.ts) is **not** in this list: it
is a deliberate module-private guard, the first exception under
[Logic is extracted, not inlined](#logic-is-extracted-not-inlined).

This section is the migration's checklist. Delete a row when it lands, and delete the section when
it is empty.

## TODOs and unfinished work

Do not leave a bare `TODO`. Unshipped affordances are rendered `disabled` with a comment naming what
they wait on, and where several wait on the same thing they share one constant so the whole set is
enabled together — `mods.primaryActionButtonDisabled` in
[theme/modifiers.ts](../../theme/modifiers.ts) exists for exactly that. What is deliberately absent
is listed in [architecture.md](architecture.md#what-is-deliberately-absent); add to that list rather
than scattering markers.

## Verification

Run in this order, always, before calling work done:

```bash
bun run type-check              # the primary gate — there is no test runner
bun run lint
bunx prettier --write <files-touched>
```

`type-check` first because a type error usually invalidates whatever lint would have said.
[eslint.config.js](../../eslint.config.js) layers `eslint-config-expo` with `jsx-a11y` and disables
stylistic rules that would fight Prettier; it deliberately ignores `.agents/**` (vendored upstream
skills) and `docs/.obsidian/**`.

Husky runs `lint-staged` on commit ([package.json](../../package.json)), which applies `eslint --fix`
and `prettier --write` to staged files. That is a safety net, not the gate — it cannot catch a type
error, and it will silently reformat work you have not looked at.

Adding or removing a dependency with native code also means
`pod install --project-directory=ios` and committing the `Podfile.lock` change in the same commit.

Markdown is covered by `format:check`, so run `bunx prettier --write` on any document you touch. The
documentation conventions themselves — frontmatter, link style, which directory a document belongs
in — are in [docs/README.md](../README.md).
