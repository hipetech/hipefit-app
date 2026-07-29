# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, OpenAI Codex, GitHub Copilot, OpenCode) when working with code in this repository. It is the single source of truth — `CLAUDE.md` and `.github/copilot-instructions.md` are symlinks to it (see [Cross-agent setup](#cross-agent-setup)).

## Project Overview

Hipefit is a fitness tracking **iOS** app built with React Native, Expo (SDK 57, bare workflow), and Firebase. It uses file-based routing (Expo Router v6), `@expo/ui` (real SwiftUI) for native UI, and Zustand for state management.

**iOS-only, deliberately.** The `android/` project, every `.android.tsx` fallback and the `bun run android` script were removed. Reviving Android means regenerating a bare native project — a deliberate project-wide decision, not a per-component one.

## Commands

```bash
# Package manager: bun (always use bun, not npm/yarn)
bun install

# Run iOS simulator (copies env file and selects Xcode scheme)
bun run ios:development    # .env.development → Hipefit-dev scheme
bun run ios:staging        # .env.staging → Hipefit-stage scheme
bun run ios:production     # .env.production → default scheme

# Verification, linting and formatting
bun run type-check         # tsc --noEmit — the primary verification gate
bun run lint               # ESLint check
bun run lint:fix           # ESLint with auto-fix
bun run format             # Prettier format all files
bun run format:check       # Prettier check only

# Data
bun run db:seed            # Seed Firestore (scripts/db/index.ts)
```

Note: Husky pre-commit hook runs `bun run lint:fix` automatically.

## Architecture

### Routing (Expo Router - file-based)

Each tab is a folder with its own `<Stack />`, not a flat route file:

```
app/
├── _layout.tsx              # Root layout: auth guard via Stack.Protected
├── index.tsx                # Entry redirect based on auth state
├── (public)/login.tsx       # Apple Sign-In (unauthenticated)
└── (private)/               # Protected routes (requires auth)
    ├── _layout.tsx          # Bottom tab navigation (Expo Router NativeTabs)
    ├── (home)/              # Home tab — the group keeps its path at "/"
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── workouts/
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── exercises/           # Route file also owns the LegendList + filter state
    │   ├── _layout.tsx
    │   └── index.tsx
    └── settings/
        ├── _layout.tsx      # Only layout with explicit <Stack.Screen> decls
        ├── index.tsx
        └── edit-profile.tsx # The one route-based sheet (formSheet, detents)
```

Conventions that surprise people:

- **Home's path is `/`, not `/home`** — it's the group `(home)`. `NativeTabs.Trigger name="(home)"` must keep the parentheses.
- **Screen chrome lives in the screen, not the layout.** `<Stack.Screen.Title>`, `<Stack.Toolbar>` and `<Stack.SearchBar>` are declared in each `index.tsx`; three of the four tab `_layout.tsx` files are bare `<Stack />`.
- **`Stack.Toolbar.*` children must be literal JSX** — a `.map()` or a wrapper component will not render.
- Route files stay thin (title + a `features/` island). Exercises is the current exception.

### Feature-based organization

```
features/
└── [feature-name]/
    ├── [feature]-content.tsx        # Screen island the route renders
    ├── [component].tsx              # One named component per file (routine-card, exercise-row, …)
    └── store/use-[feature]-store.ts # Zustand store
```

Screen components live in `features/`, route files in `app/` import from features. `features/auth/index.tsx` is the last remaining bare `index.tsx` — legacy, not the pattern to copy.

### UI Components

UI is built with **`@expo/ui`** — real SwiftUI, rendered from React. Key rules:

- **`Host` per island, never nested.** Import `Host` only from `@expo/ui` root. Every native subtree lives inside one `Host` (pass `colorScheme={useAppColorScheme()}`). **Never pass `seedColor`** — leaving it unset makes SwiftUI use the system accent, which is the intended look; see `theme/colors.ts:12-16`. No flexbox inside a `Host` — use `@expo/ui/swift-ui` `VStack`/`HStack`/`Spacer` + the `modifiers={[…]}` prop. Remote images inside a `Host` go through `RNHostView` + expo-image, never a second `Host`.
- **One file per component — no platform splits.** The old `<name>.d.ts` + `<name>.ios.tsx` + `<name>.android.tsx` triple is gone. Write a plain `<name>.tsx` that imports `@expo/ui/swift-ui` directly and declares its own exported `Props` interface. **Do not reintroduce `.ios.tsx` / `.android.tsx` suffixes** — if Android is ever revived, that is a deliberate project-wide decision, not something to reinstate one component at a time.
- **Reusable native primitives** in `ui/` (imported from the bare path e.g. `@/ui/card`): `Card`, `Chip`, `Separator`, `Avatar`. Plain-RN primitives (usable in or out of a `Host`): `Text` (Apple text-style variants — see Typography below), `Progress`, `Image` (expo-image).
- **Theming:** `@/theme/colors` is the only token source — semantic colors come from `Color.ios.*` (the type-safe `expo-router` wrapper, never raw `PlatformColor`), wrapped in `Platform.select` purely to supply the `default` web fallback. No hardcoded hex outside that file and no brand accent (the purple `brand`/`BRAND_SEED` pair was removed). The user's theme is applied app-wide via `Appearance.setColorScheme` in `app/_layout.tsx` (driven by `useAppColorScheme`, which reads `profile.settings.theme` from Firestore). No CSS, no className, no Tailwind — RN styling here is plain style objects; where those objects live is the next bullet.
- **Static styles and modifier arrays live at module scope**, above the component; JSX carries only what genuinely depends on props or state. RN styles go through one `const styles = StyleSheet.create({…})` per file (it is an identity function that only freezes in `__DEV__`, so `Color.ios.*` tokens stored in it still resolve against the live light/dark trait); `@expo/ui` modifier arrays are plain `const` arrays, because `StyleSheet.create` is typed for `ViewStyle`/`TextStyle`/`ImageStyle` and `ViewModifier[]` is none of those. **Never `as const` a modifier array** — `modifiers` is a mutable `ModifierConfig[]` and a `readonly` tuple will not assign to it (TS4104). File-local arrays are `SCREAMING_SNAKE` with a `_MODIFIERS` suffix; cross-file shapes live in `@/theme/styles` (`layout.*`) and `@/theme/modifiers` (`mods.*`), the latter being the SwiftUI half of the typography vocabulary `ui/text.tsx` owns on the RN side. Editing a shared entry moves every screen that uses it — diverge by inlining the one site, never by editing the shared value. **Compose only at the ends** (`[...MODS, dyn]` / `[dyn, ...MODS]`), never splicing a dynamic modifier into the middle of a hoisted run: `@expo/ui` applies the array with a reduce, so index 0 is the _innermost_ modifier and order is semantics. `ui/chip.tsx` is the worked example — its one dynamic modifier sits at index 1 of 7, so that array deliberately stays inline. **This deliberately overrides the bundled Expo skills.** Both `.agents/skills/expo-native-ui/SKILL.md:109` and `.agents/skills/building-native-ui/SKILL.md:121` say "Inline styles not StyleSheet.create unless reusing styles is faster"; in this repo reusing **is** the default and hoisting is the rule. Both skills are vendored from upstream (`source: expo/skills` in `skills-lock.json`, tracked by `computedHash`), so editing them would be clobbered on the next sync and would invalidate the recorded hash — which is why the divergence is recorded here instead. Do not "correct" the codebase back to match the skills.
- **Typography — one vocabulary across both trees.** `ui/text.tsx` exposes Apple's 11 text styles under exactly the names in the `textStyle` union of `@expo/ui`'s `font()` modifier (`largeTitle · title · title2 · title3 · headline · body · callout · subheadline · footnote · caption · caption2`), so an RN `Text` and a SwiftUI `Text` are described identically. Always `font({ textStyle })`, never `font({ size })` — the latter is frozen and ignores Dynamic Type. The one sanctioned exception is `ui/avatar.tsx` (initials sized relative to a fixed-pixel circle); it carries a comment explaining why. Variants are typography only — `textAlign`, margins and borders belong at the call site. Counters that update in place use `monospacedDigit()` (SwiftUI) / `fontVariant: ['tabular-nums']` (RN) so digits stop jittering.
- **Grouped screens are SwiftUI `List` + `Section` + `listStyle('insetGrouped')`** inside one `Host` — this is the default idiom for Home, Workouts and Settings. Note `List` is _not_ virtualized: every row is a live JSX node, so it suits bounded content only. Exercises is the deliberate exception — an unbounded catalogue, so it keeps `@legendapp/list` (`LegendList`) with each row as its own `Host` island and reproduces the grouped look by hand from the **measured** constants in `features/exercises/row-metrics.ts`. Those values track what SwiftUI actually draws (the real corner radius is ~22pt on iOS 26, not the widely-quoted 10pt) — re-measure them, don't re-derive them.
- Beware: `title` on a `Section` silently wins over a custom `header` slot whenever it is non-empty, and `badge()` on a `Section` renders a stray count. Use one or the other, and prefer `header` when you need control.
- **A SwiftUI `Menu` hit-tests and labels its `label` view, not the `Menu`.** Modifiers on the `Menu` apply to the menu _container_ and silently do nothing to the interactive part — this has bitten twice, first with `accessibilityLabel` (which produced two nodes, one of them a stray full-screen element) and then with `contentShape` (no effect at all, measured). Anything about **hit area, accessibility or appearance of the control itself** goes on the leaf inside `label`. In particular a glyph is only as tappable as it is large: pair `frame(...)` with `contentShape(...)` **on the label, in that order**, or the visible target and the real one disagree — a 24pt glyph inside a 60pt circle leaves an 18pt dead ring and fails Apple's 44pt minimum. `frame` alone is not enough; hit-testing follows drawn content, not layout bounds.
- **The global create button is a floating overlay**, not `NativeTabs.BottomAccessory` (`app/(private)/_layout.tsx` + `features/floating-action-button/`). It is a `Host` positioned absolutely as a **sibling of `NativeTabs`**, because the design calls for a circle and the accessory only ever renders a full-width pill. Three consequences, none optional: the overlay **cannot observe the tab bar** — its height and minimize state have no API (a documented native-tabs limitation), so `features/floating-action-button/floating-action-button-metrics.ts` carries **measured** constants and `<NativeTabs minimizeBehavior="never">` is mandatory or the bar shrinks on scroll and the button drifts; tap and long press both open the **same** anchored SwiftUI `Menu`, and there is deliberately **no `onPrimaryAction`** (it routes tap to a JS callback instead of the menu — the defect in `docs/plans/create-fab-menu-defect.md`), so never add a JS `onLongPress` / `onTapGesture` or a `ContextMenu` beside it, and note that the open menu **covers the button and drops it from the accessibility tree** exactly as Apple's own anchored menus do (measured against Files' ••• menu) — platform-standard, not a bug to route around; with no JS callback left, no haptic fires here and none should, since UIKit's presentation carries its own; and the button lives in the content layer, which Apple's HIG advises against for Liquid Glass and where the iOS HIG has no floating-action-button idiom at all (the term is Material Design's, which is why the feature spells it out rather than using the Android-flavoured "FAB" abbreviation) — a deliberate, recorded divergence, not an oversight to "fix".
- **Feedback and motion.** Haptics go through `@/lib/haptics` (intent names — `hapticSelection` / `hapticImpact` / `hapticSuccess`), never raw `expo-haptics`: the wrapper is iOS-gated and fire-and-forget so a failed haptic can't reject into the interaction. `@expo/ui` has **no** `sensoryFeedback` modifier, so feedback fires from JS in the event callback. Only on meaningful state change — not on re-selecting an already-selected value, not on `disabled`/redacted placeholder rows, and never on a failure path. `Switch`, `Picker` and `DateTimePicker` have built-in haptics; adding more double-fires.
- **Motion is native, not Reanimated.** Reanimated cannot reach inside a `Host` to animate SwiftUI content, so it is not the tool for the `List`-based screens. Changing numbers use `contentTransition('numericText')` + `animation(...)`, applied _outermost_ (after `font`/`monospacedDigit`) — `contentTransition` alone never runs without an `animation` transaction to drive it. Animate only values that actually mutate in place; a logged workout's duration is immutable and gains nothing. Keep durations ≤300ms. **SwiftUI does not honour Reduce Motion for you** (`AnimationModifier` in `@expo/ui/ios/Modifiers/ViewModifierRegistry.swift` passes straight through to `.animation(_:value:)`), so gate on `@/hooks/use-reduce-motion` and drop the modifiers rather than animating to zero duration.

### Backend and `database/`

Firebase services: Auth (Apple Sign-In), Firestore, Analytics, Crashlytics, AI. Direct SDK imports — no API service layer. Everything Firestore-shaped is consolidated in `database/` and imported through the barrel `@/database`:

- `refs.ts` — every collection/doc ref helper. Never build a Firestore path inline.
- `types.ts` — document types, the `WithId<T>` = `{ id: string; data: T }` shape all docs take in the app, and the `Timestamp` re-export.
- `use-firestore-subscriptions.ts` — orchestrates every store's `subscribe(uid)` off auth state; called once in `app/_layout.tsx`.
- The schema itself lives in `docs/db-structure.md`.

### State Management

Zustand stores in `features/[feature]/store/`; each exposes `subscribe(uid)` returning an unsubscribe function plus a `reset()`, and the auth store (`useAuthStore`) manages the Firebase `onAuthStateChanged` listener with an async initialization pattern. Every `onSnapshot` call takes an error callback that logs with a `[StoreName]` prefix and clears `isLoading`.

## Code Conventions

- **TypeScript:** Strict mode, no `any`, use interfaces for props
- **Components:** Arrow functions, `React.FC` for typed components
- **Styling:** Native `@expo/ui` components + plain style objects coloured from `@/theme/colors`; no Tailwind/className/CSS. Static styles and modifier arrays are hoisted to module scope above the component (RN styles via `StyleSheet.create`, modifier arrays as plain `const` arrays), shared ones via `@/theme/styles` and `@/theme/modifiers` — see [UI Components](#ui-components)
- **Imports:** Auto-sorted by Prettier (types → react/rn → third-party → @/ aliases → relative)
- **Path alias:** `@/*` maps to project root
- **Naming:** camelCase for variables/functions, PascalCase for components, lowercase hyphenated for directories
- **Shared code:** check before writing a local helper — `lib/format.ts` (formatting/string utils), `lib/constants.ts`, `lib/haptics.ts` (feedback, see [UI Components](#ui-components)), `theme/styles.ts` (`layout.*` RN styles) and `theme/modifiers.ts` (`mods.*` SwiftUI modifier arrays), and `hooks/` for cross-feature hooks (`use-app-color-scheme`, `use-reduce-motion`)
- **Platform:** iOS-only — no `.ios`/`.android` file splits, and no Android branches in new code. `Platform.select()` survives inside `@/theme/colors` only, to give each token a `default` web fallback.

## Multi-environment Setup

Three environments with matching Firebase configs, .env files, and EAS build profiles:

- **development** → `.env.development`, Xcode scheme `Hipefit-dev`
- **staging** → `.env.staging`, Xcode scheme `Hipefit-stage`
- **production** → `.env.production`, default Xcode scheme `Hipefit`

## Key Config Notes

- **Bare workflow:** The native `ios/` project is committed and managed directly (not Continuous Native Generation). Native changes go in `ios/`, not `app.config.js` plugins. Adding or removing a dependency with native code means running `pod install --project-directory=ios` and committing the `Podfile.lock` change alongside it. Per-environment Info.plist files: `Info-dev.plist`, `Info-stage.plist`, `Info-prod.plist`.
- React Compiler and New Architecture are enabled in `app.config.js`
- TypedRoutes enabled for Expo Router type safety
- Native theming via OS semantic colors (`@/theme/colors`) + `Host.colorScheme` (never `seedColor`); light/dark applied through `Appearance.setColorScheme`
- Root layout wraps with `GestureHandlerRootView`; no CSS/styling provider (Metro has no `global.css`/uniwind config)

## Reference docs

AGENTS.md links reference docs, never plan docs — plans expire, and a linked plan reads as current. The split is structural: `docs/` holds durable reference, `docs/plans/` holds completed plans kept as historical record. Never treat anything under `docs/plans/` as a work list, and never link it from here.

`docs/db-structure.md` — the Firestore schema: collections, document shapes, and how they map onto `database/types.ts`.

Figma file **HipeFit** — file key `bXRKY3ueO3Bg31zmuSvxX2`
<https://www.figma.com/design/bXRKY3ueO3Bg31zmuSvxX2/HipeFit>

The single page `🔍 Analysis` (`33:320`) holds **two different kinds of content**. Know which you are looking at before you call a tool on it.

**1. Competitor research** — three sections of iPhone screenshots (393×892, captured Feb 2026):

| Section    | Node     | Flows captured                                                                                     |
| ---------- | -------- | -------------------------------------------------------------------------------------------------- |
| Hevy       | `47:122` | Welcome, Onboarding, Workout (empty), New Routine, Workout, Log Workout, Workout Settings, Profile |
| Strong     | `48:172` | Welcome, Workout, New Workout Template, History, Exercises, Profile                                |
| GYM Keeper | `48:211` | Welcome, Drawer, Workout, Exercises, New Program, Settings                                         |

Every one of these is a raster image fill, so `get_design_context` returns no layer tree and design-to-code does not apply. Use `get_screenshot` and treat them as visual/UX reference only.

**2. HipeFit's own mockups** — e.g. `377:4443` "Home - User's View". These **do** have a real layer tree, so `get_metadata` and `get_design_context` work on them. They are still not a design system: there are no Figma components, variables, or styles to sync, and `@/theme/colors` remains the only token source. Build the equivalent with `@expo/ui` per the [UI Components](#ui-components) rules rather than transcribing the frame.

Where a mockup and the shipped app disagree, the app has usually won on purpose. Recorded so far, from `377:4443`:

- It draws a **custom floating pill tab bar with a circular `+` detached beside it**. The app keeps the real UIKit tab bar, where a 4-item `UITabBar` fills the full width — measured on an iPhone 17 Pro, the items end at x=377 of 402pt, so a 60pt circle beside them would cover the Settings item. The button therefore floats _above_ the bar rather than next to it. See the create-button bullet under [UI Components](#ui-components).
- Its fourth tab is **Profile**; the app ships **Settings**.
- Its action labels are Hevy's vocabulary and name the wrong entities. The app's labels follow the data model: **Start Workout / New Routine / Custom Exercise**, since a _Workout_ is the logged entity and a _Routine_ is the template.

Access requires the Figma MCP server (`figma` plugin) to be authenticated; the OAuth token is stored per-user outside the repo, so each agent/machine authenticates once via `/mcp`.

## Cross-agent setup

This repo is configured so a single set of files serves every coding agent — no per-vendor copies to keep in sync.

### Instructions (this file)

`AGENTS.md` is the canonical instructions file. The others are **symlinks** to it, so editing `AGENTS.md` updates all of them:

```
AGENTS.md                          (canonical — edit this)
├── CLAUDE.md                       → AGENTS.md          (Claude Code)
└── .github/copilot-instructions.md → ../AGENTS.md       (GitHub Copilot)
```

Codex and OpenCode read `AGENTS.md` natively, so they need no pointer.

### Skills

Skills live once under `.agents/skills/<name>/SKILL.md` — the vendor-neutral location that **Codex, GitHub Copilot, and OpenCode all read natively**. Claude Code only reads `.claude/skills/`, so each skill is exposed to it via a symlink:

```
.agents/skills/<name>/              (canonical — SKILL.md + references/)
└── .claude/skills/<name>           → ../../.agents/skills/<name>   (Claude Code)
```

Provenance for upstream-installed skills is tracked in `skills-lock.json`. The optional `agents/openai.yaml` inside a skill is a Codex-only display adapter; it is not required (Codex falls back to the `SKILL.md` description) — don't hand-author it locally, as it ships from upstream.

**Adding a new skill:** create `.agents/skills/<name>/SKILL.md` (with `name` + `description` frontmatter), then `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.

### Caveat

These symlinks require `git config core.symlinks true` (default on macOS/Linux; needs Developer Mode or that flag on Windows). On a Windows checkout without it, the pointer files appear as plain text containing the target path.
