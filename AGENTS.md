# AGENTS.md

Canonical instructions for every coding agent. Keep only unconditional rules and task triggers
here; current-state detail belongs in `docs/`.

## Constraints

Hipefit is an iOS fitness app built with React Native, Expo SDK 57 (bare workflow), Expo Router,
`@expo/ui`, Zustand, Firebase Auth, and Firestore. Stores use Firebase directly; there is no service
layer.

- **iOS only.** Do not add Android branches, fallbacks, or `.android.tsx` files. Reviving Android is
  a project-wide decision.
- **Bare workflow.** `ios/` is authoritative for native configuration; do not synthesize it through
  `app.config.js`.
- **Bun only.** Never use npm or yarn.
- **No test runner.** `bun run type-check` is the primary code gate.

## Workflow

- Inspect files before editing, including adjacent code and comments. Preserve measured values and
  documented divergences unless the task explicitly changes them.
- Follow existing boundaries instead of adding parallel patterns.
- Apply the feature lifecycle in `docs/README.md`. Every behavior change must keep code and durable
  documentation in agreement, whether or not it needs a plan.

## Commands

```bash
bun install
bun run ios:development     # also ios:staging, ios:production
bun run type-check          # required first for code
bun run lint                # required after type-check
bunx prettier --write <files-touched>
bun run db:seed
```

Adding or removing a native dependency also requires `pod install --project-directory=ios` and the
resulting `ios/Podfile.lock` change.

## Boundaries

Read `docs/app/architecture.md` when a change crosses layers.

- `app/` contains route files only: navigation chrome and one island from `features/`.
- `features/` owns screen bodies, feature components, measured native constants, and domain stores
  under `store/use-<name>-store.ts`.
- `database/` alone owns Firestore paths and document shapes. Import refs and types from
  `@/database`; never construct paths inline. Data stores expose `subscribe(uid)` teardowns and are
  started centrally, not by screens. Auth owns its separate listener.
- `theme/`, `ui/`, `lib/`, and `hooks/` are cross-cutting. Keep a shape in its feature until it has
  multiple call sites.

## Required Reading

Read only the documents triggered by the task:

- **Substantial feature:** read `docs/README.md`; create `docs/plans/<initiative>/plan.md` from
  `docs/templates/plan.md`. Substantial means a material change to a journey, shared system,
  persistent model, native integration, or multiple implementation areas.
- **UI:** read `docs/app/ui.md` before editing. It overrides conflicting bundled Expo skills.
- **Navigation:** read `docs/app/navigation.md`.
- **Data or schema:** read `docs/app/database.md` and, when relevant, `docs/db-structure.md`.
- **User-visible behavior:** read and update the affected `docs/flows/` in the same change. A new
  user goal or independent journey requires a flow from `docs/templates/flow.md`, indexed in
  `docs/README.md`.
- **Reusable cross-feature system:** create or extend a current-state document under `docs/app/`;
  do not create a per-feature documentation tier.

`docs/plans/` contains proposed and historical intent, never evidence of current behavior. Verify
plan claims against code and durable docs.

## Conventions

- Strict TypeScript; no `any`; props use interfaces.
- Components are arrow functions using `React.FC`; one named component per file.
- Prettier sorts imports: types, React/React Native, third-party, `@/`, then relative. `@/*` maps to
  the repository root.
- Use camelCase for variables/functions, PascalCase for components, and lowercase-hyphenated names
  for files/directories.
- Check `lib/format.ts`, `lib/constants.ts`, `lib/haptics.ts`, `theme/styles.ts`,
  `theme/modifiers.ts`, and `hooks/` before adding local equivalents.
