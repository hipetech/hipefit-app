---
type: index
status: current
area: documentation
updated: 2026-08-05
---

# Documentation

Markdown files in this repository are canonical. Obsidian is an optional reading interface, not a
requirement: nothing here depends on a plugin, a vault setting, or a wikilink.

This file is the index. An agent should be able to arrive here, find the one or two documents
relevant to the change at hand, and read only those.

## Where each kind of information belongs

| Directory / file                          | Holds                                                                                    | Authoritative for                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`AGENTS.md`](../AGENTS.md)               | Rules every coding agent must know automatically, without reading anything else.         | Conventions and constraints                       |
| `docs/app/`                               | Durable, cross-feature system shape — architecture, navigation, the data boundary.       | Current shared architecture                       |
| `docs/flows/`                             | Current end-to-end user journeys that cross screens or features.                         | Current product behavior                          |
| `docs/plans/`                             | Proposed, active, and historical implementation work under one directory per initiative. | Intent and rationale — **never** current behavior |
| `docs/templates/`                         | Copyable starting points for the three document kinds.                                   | Document shape                                    |
| [`docs/db-structure.md`](db-structure.md) | The Firestore schema: collections, document fields, relationships.                       | The schema itself                                 |

Four rules follow from that split:

1. `AGENTS.md` stays short. It carries rules, not descriptions; anything an agent only needs
   sometimes belongs in `docs/` and gets linked.
2. A document under `docs/app/` or `docs/flows/` claims to describe the app **as it is today**. If
   it disagrees with the code, the code is right and the document is a bug.
3. A document under `docs/plans/` never describes current behavior — not even after it ships. It is
   marked `status: completed` and left in place as a record. Do not infer runnable work from a plan
   unless a task note or the user directs you to execute it.
4. Low-level detail lives in source. Explain shape and rationale here, then link; do not restate
   APIs, prop tables, or component trees in prose.

### Which one am I writing?

- Describing how a subsystem is put together and why → `docs/app/`.
- Describing what a user does, across more than one screen → `docs/flows/`. This is the primary
  unit of durable product documentation, because the cross-screen narrative is exactly what cannot
  be recovered by reading any single directory under `features/`.
- Describing work that has not happened yet → `docs/plans/<initiative-name>/plan.md`.
- Splitting that work into independently executable items → `docs/plans/<initiative-name>/tasks/`.

There is deliberately **no per-feature tier** (`docs/features/<name>/`). For an app this size a
feature document and its flow document would restate each other and only one would stay updated;
see [Deferred: per-feature documentation](plans/documentation-system/plan.md#deferred-per-feature-documentation)
in the plan that set this system up. Revisit only when a specific flow document has grown too
crowded to read.

## Feature development lifecycle

This is the one authoritative statement of how a feature moves from intent to shipped, documented
behavior. The templates point here rather than restating it.

**Substantial work needs a plan.** Create `docs/plans/<initiative-name>/plan.md` from
[`templates/plan.md`](templates/plan.md) when the work introduces or materially changes a user
journey, a shared system, a persistent data model, a native integration, or coordinated behavior
across more than one implementation area.

**Small fixes do not need a ceremonial plan — but every behavior change, plan or no plan, must
still assess and update its durable documentation impact.** The plan is what scales with size; the
reconciliation in step 5 does not. A one-line change to what the user sees is a flow edit that also
happens to touch code, and shipping it without the flow edit leaves a document that rule 2 above
calls a bug.

1. **Classify the work.** Does it change a user journey, a shared application system, both, or
   neither.
2. **Plan substantial work.** Create `docs/plans/<initiative-name>/plan.md`, list the app and flow
   documents it affects, and identify whether new durable documents are needed.
3. **Prepare execution context.** When task notes are useful, put the exact durable documents and
   source files in their `context:` arrays.
4. **Implement against proposed intent.** Behavior that has not shipped stays in the plan; it does
   not get described as current in `docs/app/` or `docs/flows/`.
5. **Reconcile durable documentation.** Before completion, update the existing app and flow
   documents, or create and index the new documents the shipped behavior requires.
6. **Verify and complete.** Run the required checks, mark task notes done, and mark the initiative
   plan `completed` only once the code and the durable documentation agree.

### When a flow must change

Review and update the affected flow whenever a feature changes any of:

- entry points or availability;
- routes, screens, or step order;
- decisions, branches, and alternate paths;
- state reads, writes, or persistence;
- loading, empty, disabled, and error behavior;
- completion state or the user-visible result.

### When a new document is required

A **new flow document** when the feature introduces a distinct user goal, or a journey that can be
understood on its own rather than as a branch of an existing one.

A **new or extended `docs/app/` document** when the feature introduces a reusable cross-feature
system — even when a single feature introduced it. That system's home is `docs/app/`, not a
per-feature tier; see the argument above.

## Conventions

**Links are standard Markdown. Never wikilinks.** `[label](path)`, so the links work on GitHub, in
an editor preview, and in Obsidian alike.

**Paths are repository-relative and written as links, not bare text.** From a document in
`docs/flows/`, source is `../../features/workouts/workouts-content.tsx`; from
`docs/plans/<initiative-name>/`, it is `../../../features/…`. Link inline, in the sentence that
makes the claim — durable documents do not collect links into a "sources" section at the bottom.

**Wrap any path containing parentheses in angle brackets**, or the link breaks:

```markdown
[`app/(private)/workouts/index.tsx`](<../../app/(private)/workouts/index.tsx>)
```

**Every path must exist on disk.** This is the one thing tooling can check, and the one failure
that actively misleads an agent — a document pointing at a file that was renamed. Rename a
directory and update the citations in the same commit.

**Frontmatter is required on every Markdown file under `docs/`:**

| `type`              | Required keys                                  |
| ------------------- | ---------------------------------------------- |
| `app`, `flow`       | `type`, `status`, `area`, `updated`            |
| `plan`              | `type`, `status`, `area`, `created`            |
| `task`              | `type`, `status`, `area`, `context`, `created` |
| `template`, `index` | `type`, `status`, `area`, `updated`            |

`status` is `current | superseded` for durable documents, the lifecycle values in
[`templates/plan.md`](templates/plan.md) for plans, and the workflow values in
[`templates/task.md`](templates/task.md) for tasks. A stale flow document is normally rewritten in
place rather than superseded.

`context:` on a task note is **required and must be non-empty** — it is the reliable discovery
path, naming the exact documents and files to read before writing code.

**Enforcement.** There is none. Nothing validates frontmatter keys, checks that a cited path still
resolves, or confirms that a `context:` entry exists — these conventions hold exactly as far as the
author applies them. When a change renames or deletes a file, re-cite it by hand in the same change,
and verify the links in [`AGENTS.md`](../AGENTS.md) — a first-class row of the table above, and full
of them — yourself when you edit that file. A citation left pointing at a file that no longer exists
is how a document turns into an agent implementing the wrong thing.

`bun run format:check` covers `**/*.md`, so run `bunx prettier --write` on any document you touch.

## Current documents

### App

- [`app/architecture.md`](app/architecture.md) — layers, boundaries, and where new work belongs.
- [`app/navigation.md`](app/navigation.md) — Expo Router structure, tabs, and screen chrome.
- [`app/ui.md`](app/ui.md) — SwiftUI through `@expo/ui`: hosts, primitives, color, styling, and
  motion.
- [`app/database.md`](app/database.md) — the boundary the app draws around Firestore.
- [`db-structure.md`](db-structure.md) — the schema itself. Still at the repository root of `docs/`
  because `AGENTS.md` already references it there.

### Flows

Each flow opens with a callout stating how much of it ships. Read that callout before assuming any
step is reachable — three of the four below document journeys that stop partway or do not start.

- [`flows/authentication.md`](flows/authentication.md) — Apple Sign-In, first-run profile creation,
  the auth guard, and logging out. The one flow here that ships end to end.
- [`flows/start-workout.md`](flows/start-workout.md) — starting a workout from a routine or ad hoc.
  The entry points ship **disabled**.
- [`flows/log-workout.md`](flows/log-workout.md) — finishing a session and the writes that would
  record it. The **write** half does not ship; the read half renders correctly.
- [`flows/create-routine.md`](flows/create-routine.md) — building a reusable template. **Does not
  ship**; the only affordance is a disabled action in the native create panel.

### Templates

- [`templates/flow.md`](templates/flow.md)
- [`templates/plan.md`](templates/plan.md)
- [`templates/task.md`](templates/task.md)

### Plans

Historical and proposed work, never current behavior. New plans use an initiative directory:

- [`plans/documentation-system/plan.md`](plans/documentation-system/plan.md) — the plan this
  structure implements.
- [`plans/agent-documentation-structure/plan.md`](plans/agent-documentation-structure/plan.md) — the
  plan that split `AGENTS.md` from the durable documents and defined the lifecycle above.
- [`plans/native-navigation-dock/plan.md`](plans/native-navigation-dock/plan.md) — the iOS-native
  create panel that ships today, its parallel ownership model, manual approval gate, and
  post-approval mobile QA.

Older plans remain as loose files directly under [`plans/`](plans/). They were not migrated, and
several describe work that was never built — verify anything you take from them against the code.
