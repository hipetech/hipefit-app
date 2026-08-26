# AGENTS.md

Canonical instructions for every coding agent. Keep only unconditional rules and task triggers
here; current-state detail belongs in `docs/`.

## Constraints

Hipefit is an iOS fitness app under `apps/mobile/`, built with React Native, Expo SDK 57 (bare
workflow), Expo Router, `@expo/ui`, Zustand, Firebase Auth, and Firestore. Stores delegate Firebase
operations to app services.

- **iOS only.** Do not add Android branches, fallbacks, or `.android.tsx` files. Reviving Android is
  a project-wide decision.
- **Bare workflow.** `apps/mobile/ios/` is authoritative for native configuration; do not synthesize
  it through `apps/mobile/app.config.ts`.
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
bun run db:seed --seed exercises --env development   # both flags required; --env has no default
bun run db:wipe --env development                    # destructive; prompts for the env name
```

Adding or removing a native dependency also requires
running `pod install` from `apps/mobile/ios/` and committing the resulting
`apps/mobile/ios/Podfile.lock` change.

## Boundaries

Read `docs/app/architecture.md` when a change crosses layers.

- `apps/mobile/app/` contains route files only: navigation chrome and one island from
  `apps/mobile/src/features/`.
- `apps/mobile/src/features/` owns screen bodies, feature components, and measured native constants.
  `apps/mobile/src/stores/` owns domain Zustand stores, and `apps/mobile/src/services/` owns the
  app's Firebase queries and writes.
- `@hipefit/schemas` owns persisted document shapes, decoders, write assertions, and Firestore path
  strings. `@hipefit/firebase/react-native` owns React Native Firebase instances and typed ref
  builders. App services import both packages; never construct Firestore paths inline.
- Data stores expose `subscribe(uid)` teardowns and are started centrally from
  `apps/mobile/src/hooks/use-firestore-subscriptions.ts`, not by screens. Auth owns its separate
  listener.
- `@hipefit/ui` owns shared SwiftUI primitives and semantic colors. App-specific cross-cutting code
  lives under `apps/mobile/src/components/`, `theme/`, `lib/`, and `hooks/`. Keep a shape in its
  feature until it has multiple call sites.

## Required Reading

Read only the documents triggered by the task:

- **Substantial feature:** read `docs/README.md`; create `docs/plans/<initiative>/plan.md` from
  `docs/templates/plan.md`. Substantial means a material change to a journey, shared system,
  persistent model, native integration, or multiple implementation areas.
- **Any code change:** `docs/app/code-style.md` is the authority on module shapes, naming, the
  comment policy, and the one-component-per-file standard the codebase is being moved to.
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
  `apps/mobile/src/*` in both root and mobile TypeScript configuration. Workspace packages are
  imported by package name, not through `@/`.
- Use camelCase for variables/functions, PascalCase for components, and lowercase-hyphenated names
  for files/directories.
- Check `apps/mobile/src/lib/format.ts`, `apps/mobile/src/lib/constants.ts`,
  `apps/mobile/src/lib/haptics.ts`, `apps/mobile/src/theme/styles.ts`,
  `apps/mobile/src/theme/modifiers.ts`, and `apps/mobile/src/hooks/` before adding local equivalents.

## Writing style

For all user-facing prose, apply these rules. When writing or editing documentation, load the
`humanizer` skill before finalizing it.

- Lead with the main point. Use direct, concrete language and natural sentence lengths.
- Keep every factual claim. Do not invent names, dates, numbers, quotes, citations, reasons, or
  outcomes. Preserve code, identifiers, API names, paths, and technical terminology exactly.
- Match the existing document's voice. Keep technical, reference, and legal writing neutral; do not
  add opinions, personality, or first-person language where they do not belong.
- Prefer active voice and simple verbs such as `is`, `has`, and `uses` when they make the actor and
  action clearer.
- Use headings, lists, tables, and bold text only when they improve navigation or comprehension. Do
  not add decorative emojis.
- Remove filler, throat-clearing, stacked qualifiers, forced groups of three, repeated conclusions,
  dramatic fragments, fake-candid openings, and generic positive endings.
- Remove inflated importance, sales language, vague attribution, shallow `-ing` analysis, stock
  challenges-and-outlook sections, unsupported objections, and alternatives no reader would
  consider.
- Avoid synonym cycling and repetitive sentence openings. Use one clear name for the same concept
  and vary sentence structure only when it improves the prose.
- Do not use em dashes or en dashes. Use commas, periods, colons, or parentheses instead.
- Describe current behavior in documentation and comments. Mention previous behavior only in change
  logs, release notes, migration guides, or documents whose purpose is to explain a change.
