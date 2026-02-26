# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hipefit is a fitness tracking mobile app built with React Native, Expo (SDK 54), and Firebase. It uses file-based routing (Expo Router v6), Uniwind (Tailwind CSS v4 for RN), HeroUI Native for UI components, and Zustand for state management.

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
    ├── _layout.tsx      # Bottom tab navigation (custom TabBar)
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

HeroUI Native component library (`heroui-native`) provides pre-styled, animated components (Button, Card, Chip, Dialog, Select, Accordion, Avatar, Skeleton, Separator, RadioGroup, Input, Label, TextField). Uses compound component pattern (`Card.Body`, `Button.Label`, etc.). Custom `Text` component with typography variants and `Progress` component remain in `ui/`. Use `cn()` from `@/lib/utils` for conditional class merging.

### Backend

Firebase services: Auth (Apple Sign-In), Firestore, Analytics, Crashlytics, AI. Direct SDK imports — no API service layer.

### State Management

Zustand stores in `features/[feature]/store/`. Auth store (`useAuthStore`) manages Firebase `onAuthStateChanged` listener with async initialization pattern.

## Code Conventions

- **TypeScript:** Strict mode, no `any`, use interfaces for props
- **Components:** Arrow functions, `React.FC` for typed components
- **Styling:** Uniwind/Tailwind CSS v4 classes exclusively, `cn()` for merging
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

- React Compiler and New Architecture are enabled in `app.config.js`
- TypedRoutes enabled for Expo Router type safety
- Uses Uniwind (Tailwind CSS v4 for RN) with HeroUI Native's built-in theming (light/dark)
- `global.css` imports `tailwindcss`, `uniwind`, and `heroui-native/styles`
- App wrapped with `GestureHandlerRootView` and `HeroUINativeProvider` in root layout
