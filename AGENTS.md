# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, OpenAI Codex, GitHub Copilot, OpenCode) when working with code in this repository. It is the single source of truth — `CLAUDE.md` and `.github/copilot-instructions.md` are symlinks to it (see [Cross-agent setup](#cross-agent-setup)).

## Project Overview

Hipefit is a fitness tracking mobile app built with React Native, Expo (SDK 57, bare workflow), and Firebase. It uses file-based routing (Expo Router v6), `@expo/ui` (real SwiftUI on iOS / Jetpack Compose on Android) for native UI, and Zustand for state management. iOS-first: the UI is optimized for SwiftUI; Android renders universal/RN fallbacks.

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

```
app/
├── _layout.tsx          # Root layout: auth guard via Stack.Protected
├── index.tsx            # Entry redirect based on auth state
├── (public)/login.tsx   # Apple Sign-In (unauthenticated)
└── (private)/           # Protected routes (requires auth)
    ├── _layout.tsx      # Bottom tab navigation (Expo Router NativeTabs)
    ├── index.tsx        # Home tab
    ├── workouts.tsx     # Workouts tab
    ├── exercises.tsx    # Exercises tab
    └── settings.tsx     # Settings tab
```

### Feature-based organization

```
features/
└── [feature-name]/
    ├── index.tsx                    # Main screen/component
    └── store/use-[feature]-store.ts # Zustand store
```

Screen components live in `features/`, route files in `app/` import from features.

### UI Components

UI is built with **`@expo/ui`** — real SwiftUI on iOS (and Jetpack Compose on Android) rendered from React. Key rules:

- **`Host` per island, never nested.** Import `Host` only from `@expo/ui` root. Every native subtree lives inside one `Host` (pass `seedColor={BRAND_SEED}` + `colorScheme={useAppColorScheme()}`). No flexbox inside a `Host` — use `@expo/ui/swift-ui` `VStack`/`HStack`/`Spacer` + the `modifiers={[…]}` prop.
- **Platform isolation.** Any file importing `@expo/ui/swift-ui` must be split `<name>.ios.tsx` + `<name>.android.tsx` (the Android variant must NOT use a `Host` — bare RN primitives can't nest inside a Compose `Host`). Never place `.ios/.android` splits under `app/` — keep them in `ui/` and `features/`.
- **Reusable native primitives** in `ui/` (each `.d.ts` + `.ios.tsx` + `.android.tsx`, imported from the bare path e.g. `@/ui/card`): `Card`, `Chip`, `Separator`, `Avatar`, `Skeleton`. Plain-RN primitives (usable in or out of a `Host`): `Text` (typography variants), `Progress`, `Image` (expo-image).
- **Theming:** `@/theme/colors` (semantic `PlatformColor`s + `brand`/`BRAND_SEED`); the user's theme is applied app-wide via `Appearance.setColorScheme` in `app/_layout.tsx` (driven by `useAppColorScheme`). Inline styles only — no CSS/className.
- Long lists stay on `@legendapp/list` (`LegendList`); each row is its own `Host` island.

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
- **Platform:** Use `Platform.select()` for iOS/Android differences (SF Symbols on iOS, MaterialIcons on Android)

## Multi-environment Setup

Three environments with matching Firebase configs, .env files, and EAS build profiles:

- **development** → `.env.development`, Xcode scheme `Hipefit-dev`
- **staging** → `.env.staging`, Xcode scheme `Hipefit-stage`
- **production** → `.env.production`, default Xcode scheme `Hipefit`

## Key Config Notes

- **Bare workflow:** Native iOS/Android projects are committed and managed directly (not Continuous Native Generation). Native changes go in `ios/` and `android/` directories, not `app.config.js` plugins. Per-environment Info.plist files: `Info-dev.plist`, `Info-stage.plist`, `Info-prod.plist`.
- React Compiler and New Architecture are enabled in `app.config.js`
- TypedRoutes enabled for Expo Router type safety
- Native theming via OS semantic colors (`@/theme/colors`) + `Host.seedColor`/`colorScheme`; light/dark applied through `Appearance.setColorScheme`
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
