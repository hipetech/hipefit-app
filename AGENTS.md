# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, OpenAI Codex, GitHub Copilot, OpenCode) when working with code in this repository. It is the single source of truth — `CLAUDE.md` and `.github/copilot-instructions.md` are symlinks to it (see [Cross-agent setup](#cross-agent-setup)).

## Project Overview

Hipefit is a fitness tracking **iOS** app built with React Native, Expo (SDK 57, bare workflow), and Firebase. It uses file-based routing (Expo Router v6), `@expo/ui` (real SwiftUI) for native UI, and Zustand for state management.

**iOS-only, deliberately.** The `android/` project, all `.android.tsx` fallbacks and the `bun run android` script were removed: the fallbacks had drifted badly (stale typography, none of the haptics or motion work, no route into edit-profile) and were scaffolding that compiled rather than a working Android app. Reviving Android means regenerating a bare native project — a deliberate decision, not a per-component one.

## Commands

```bash
# Package manager: bun (always use bun, not npm/yarn)
bun install

# Run iOS simulator (copies env file and selects Xcode scheme)
bun run ios:development    # .env.development → Hipefit-dev scheme
bun run ios:staging        # .env.staging → Hipefit-stage scheme
bun run ios:production     # .env.production → default scheme

# Linting and formatting
bun run lint               # ESLint check
bun run lint:fix           # ESLint with auto-fix
bun run format             # Prettier format all files
bun run format:check       # Prettier check only
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
    ├── index.tsx                    # Main screen/component
    └── store/use-[feature]-store.ts # Zustand store
```

Screen components live in `features/`, route files in `app/` import from features.

### UI Components

UI is built with **`@expo/ui`** — real SwiftUI, rendered from React. Key rules:

- **`Host` per island, never nested.** Import `Host` only from `@expo/ui` root. Every native subtree lives inside one `Host` (pass `colorScheme={useAppColorScheme()}`). **Never pass `seedColor`** — leaving it unset makes SwiftUI use the system accent, which is the intended look; see `theme/colors.ts:12-16`. No flexbox inside a `Host` — use `@expo/ui/swift-ui` `VStack`/`HStack`/`Spacer` + the `modifiers={[…]}` prop. Remote images inside a `Host` go through `RNHostView` + expo-image, never a second `Host`.
- **One file per component — no platform splits.** The app is iOS-only: the `android/` project and every `.android.tsx` fallback were deleted, and with them the `<name>.d.ts` + `<name>.ios.tsx` + `<name>.android.tsx` triple. That pattern existed solely because Metro needed something to resolve on Android and TypeScript can't type a platform-split import; neither applies now. Write a plain `<name>.tsx` that imports `@expo/ui/swift-ui` directly and declares its own exported `Props` interface. **Do not reintroduce `.ios.tsx` / `.android.tsx` suffixes** — if Android is ever revived, that is a deliberate project-wide decision, not something to reinstate one component at a time.
- **Reusable native primitives** in `ui/` (imported from the bare path e.g. `@/ui/card`): `Card`, `Chip`, `Separator`, `Avatar`. Plain-RN primitives (usable in or out of a `Host`): `Text` (Apple text-style variants — see Typography below), `Progress`, `Image` (expo-image).
- **Theming:** `@/theme/colors` is the only token source — semantic `PlatformColor`s via `Platform.select`, no hardcoded hex outside that file and no brand accent (the purple `brand`/`BRAND_SEED` pair was removed). The user's theme is applied app-wide via `Appearance.setColorScheme` in `app/_layout.tsx` (driven by `useAppColorScheme`, which reads `profile.settings.theme` from Firestore). Inline styles only — no CSS/className.
- **Typography — one vocabulary across both trees.** `ui/text.tsx` exposes Apple's 11 text styles under exactly the names in the `textStyle` union of `@expo/ui`'s `font()` modifier (`largeTitle · title · title2 · title3 · headline · body · callout · subheadline · footnote · caption · caption2`), so an RN `Text` and a SwiftUI `Text` are described identically. Always `font({ textStyle })`, never `font({ size })` — the latter is frozen and ignores Dynamic Type. The one sanctioned exception is `ui/avatar.tsx` (initials sized relative to a fixed-pixel circle); it carries a comment explaining why. Variants are typography only — `textAlign`, margins and borders belong at the call site. Counters that update in place use `monospacedDigit()` (SwiftUI) / `fontVariant: ['tabular-nums']` (RN) so digits stop jittering.
- **Grouped screens are SwiftUI `List` + `Section` + `listStyle('insetGrouped')`** inside one `Host` — this is the default idiom for Home, Workouts and Settings. Note `List` is _not_ virtualized: every row is a live JSX node, so it suits bounded content only. Exercises is the deliberate exception — an unbounded catalogue, so it keeps `@legendapp/list` (`LegendList`) with each row as its own `Host` island and reproduces the grouped look by hand from the **measured** constants in `features/exercises/row-metrics.ts`. Those values track what SwiftUI actually draws (the real corner radius is ~22pt on iOS 26, not the widely-quoted 10pt) — re-measure them, don't re-derive them.
- Beware: `title` on a `Section` silently wins over a custom `header` slot whenever it is non-empty, and `badge()` on a `Section` renders a stray count. Use one or the other, and prefer `header` when you need control.
- **Feedback and motion.** Haptics go through `@/lib/haptics` (intent names — `hapticSelection` / `hapticImpact` / `hapticSuccess`), never raw `expo-haptics`: the wrapper is iOS-gated and fire-and-forget so a failed haptic can't reject into the interaction. `@expo/ui` has **no** `sensoryFeedback` modifier, so feedback fires from JS in the event callback. Only on meaningful state change — not on re-selecting an already-selected value, not on `disabled`/redacted placeholder rows, and never on a failure path. `Switch`, `Picker` and `DateTimePicker` have built-in haptics; adding more double-fires.
- **Motion is native, not Reanimated.** Reanimated cannot reach inside a `Host` to animate SwiftUI content, so it is not the tool for the `List`-based screens. Changing numbers use `contentTransition('numericText')` + `animation(...)`, applied _outermost_ (after `font`/`monospacedDigit`) — `contentTransition` alone never runs without an `animation` transaction to drive it. Animate only values that actually mutate in place; a logged workout's duration is immutable and gains nothing. Keep durations ≤300ms. **SwiftUI does not honour Reduce Motion for you** (`AnimationModifier` in `@expo/ui/ios/Modifiers/ViewModifierRegistry.swift` passes straight through to `.animation(_:value:)`), so gate on `@/hooks/use-reduce-motion` and drop the modifiers rather than animating to zero duration.

### Backend

Firebase services: Auth (Apple Sign-In), Firestore, Analytics, Crashlytics, AI. Direct SDK imports — no API service layer.

### State Management

Zustand stores in `features/[feature]/store/`. Auth store (`useAuthStore`) manages Firebase `onAuthStateChanged` listener with async initialization pattern.

## Code Conventions

- **TypeScript:** Strict mode, no `any`, use interfaces for props
- **Components:** Arrow functions, `React.FC` for typed components
- **Styling:** Native `@expo/ui` components + inline styles from `@/theme/colors`; no Tailwind/className/CSS
- **Imports:** Auto-sorted by Prettier (types → react/rn → third-party → @/ aliases → relative)
- **Path alias:** `@/*` maps to project root
- **Naming:** camelCase for variables/functions, PascalCase for components, lowercase hyphenated for directories
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

## Design references

Figma file **HipeFit** — file key `bXRKY3ueO3Bg31zmuSvxX2`
<https://www.figma.com/design/bXRKY3ueO3Bg31zmuSvxX2/HipeFit>

Single page `🔍 Analysis` (`33:320`) holding **competitor research, not a design system** — three sections of iPhone screenshots (393×892, captured Feb 2026):

| Section    | Node     | Flows captured                                                                                     |
| ---------- | -------- | -------------------------------------------------------------------------------------------------- |
| Hevy       | `47:122` | Welcome, Onboarding, Workout (empty), New Routine, Workout, Log Workout, Workout Settings, Profile |
| Strong     | `48:172` | Welcome, Workout, New Workout Template, History, Exercises, Profile                                |
| GYM Keeper | `48:211` | Welcome, Drawer, Workout, Exercises, New Program, Settings                                         |

Every screen is a raster image fill, so `get_design_context` returns no layer tree and design-to-code does not apply. Use `get_screenshot` to view them as visual/UX reference, then build the equivalent with `@expo/ui` per the [UI Components](#ui-components) rules. There are no Figma components, variables, or styles to sync — `@/theme/colors` remains the only token source.

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
