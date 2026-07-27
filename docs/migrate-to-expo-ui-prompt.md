# Migration prompt: replace heroui-native + uniwind with @expo/ui (SwiftUI / Compose)

Migrate the Hipefit app's UI layer off **heroui-native** and **uniwind (Tailwind CSS v4 for RN)** and onto **`@expo/ui`** — real SwiftUI on iOS and Jetpack Compose on Android — plus native styling. Do not keep a Tailwind/className styling path.

## Required skills — read before writing code

- **`expo-ui`** — for the `@expo/ui` package: universal cross-platform components (`Host`, `Column`, `Row`, `Button`, `Text`, `List`, `Section`, `Picker`, `Switch`, `Slider`, `BottomSheet`, `DateTimePicker`, `Menu`, etc.), plus the platform-specific trees `@expo/ui/swift-ui` (iOS) and `@expo/ui/jetpack-compose` (Android) and their modifiers. Use it to decide universal vs. platform-specific components and to translate each existing screen into a native `Host`/component tree.
- **`expo-native-ui`** — for native-feeling styling: Apple HIG layout, semantic colors, native controls, SF Symbols, media, visual effects, gradients, and responsive layout. Use it for the visual design decisions that Tailwind classes previously encoded (spacing, color roles, dark/light).

Invoke both skills first and follow them. For routing/navigation stay on the existing `expo-router` setup — do **not** rework navigation here.

## Current state (SDK 57, RN 0.86, React 19.2 — `@expo/ui` ~57.0.7 already installed)

Files that import `heroui-native` (9):

- `app/_layout.tsx` (wraps app in `HeroUINativeProvider`)
- `app/(private)/index.tsx`, `app/(private)/workouts.tsx`, `app/(private)/exercises.tsx`, `app/(private)/settings.tsx`
- `features/auth/index.tsx`
- `features/exercises/exercise-card.tsx`
- `ui/popover.tsx`, `ui/tab-bar.tsx`

Files that use Tailwind `className=` (11) — same set above plus `ui/progress.tsx`, `ui/icon.tsx`, `ui/text.tsx`.

Custom `ui/` components to reconcile: `text.tsx`, `icon.tsx`, `progress.tsx`, `popover.tsx`, `tab-bar.tsx`, `Image.tsx`.

Styling infra to remove:

- `metro.config.js` — `withUniwindConfig` wrapper + `cssEntryFile`
- `global.css` — imports `tailwindcss`, `uniwind`, `heroui-native/styles`, plus the brand oklch theme overrides (purple/lavender accent). **Preserve these brand colors** by porting them to semantic colors per the `expo-native-ui` skill.
- `app/_layout.tsx` — the `import '../global.css'`, `<HeroUINativeProvider>`, and `<Uniwind>` wrappers
- `uniwind-types.d.ts`
- deps to drop from `package.json`: `heroui-native`, `uniwind`, `tailwindcss`, `tailwind-merge`, `tailwind-variants`, `prettier-plugin-tailwindcss`, and `clsx` / the `cn()` helper in `lib/utils` if nothing else uses them (grep first)

## Scope & order of work

1. Read both skills. Inventory every heroui-native component in use and map each to a `@expo/ui` equivalent (universal where possible; `swift-ui`/`jetpack-compose` where the design needs it). Note the mapping before editing.
2. Port the brand theme (accent + dark surfaces from `global.css`) to semantic colors following `expo-native-ui`.
3. Migrate the shared `ui/` primitives first (`text`, `icon`, `progress`, `popover`, `tab-bar`), since screens depend on them. `tab-bar.tsx` is a custom bottom tab bar — keep its behavior; reconsider whether a native tab approach fits.
4. Migrate screens: `app/(private)/*` and `features/auth/index.tsx`, `features/exercises/exercise-card.tsx`. Settings is a good fit for a native grouped `List`/`Section` form.
5. Strip styling infra (metro, global.css, `_layout.tsx` providers, `uniwind-types.d.ts`, deps). Run `bun install`.
6. Verify: `bun run type-check`, `bun run lint`, then build/run iOS (`bun run ios:development`) — Android too if feasible. Fix regressions.

## Constraints

- Keep TypeScript strict, no `any`; match existing conventions (arrow components, `React.FC`, import ordering).
- Do not change routing, Zustand stores, Firebase/data layer, or business logic — this is a UI-layer swap only.
- `@expo/ui` renders real native views; some flex/absolute layouts won't translate 1:1. Where a screen can't be expressed cleanly in `@expo/ui`, note the tradeoff and prefer the native idiom over recreating the old pixel layout.
- Preserve the light/dark theming behavior and the purple/lavender brand accent.
- Work incrementally and keep `type-check` green between steps. Update `AGENTS.md` (and its `CLAUDE.md` symlink) + the memory notes about heroui-native/uniwind when done.

## Deliverable

A branch where the app builds and runs with no remaining imports of `heroui-native`, `uniwind`, or Tailwind `className`, all UI rendered via `@expo/ui`, and the brand look preserved.
