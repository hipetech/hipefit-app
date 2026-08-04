---
type: plan
status: proposed
area: documentation
created: 2026-08-04
---

# Plan: project documentation structure

## Outcome

Create a predictable documentation system that separates:

- current application architecture and shared systems;
- current end-to-end user flows;
- temporary implementation planning and historical context.

Markdown files in the repository remain canonical. Obsidian is an optional interface for reading,
linking, and navigating them.

This plan supersedes the exploratory notes in
[`../obsidian-docs-task-tracking-research.md`](../obsidian-docs-task-tracking-research.md), which
remain readable as historical input but are not authoritative.

## Target structure

```text
docs/
├── README.md
├── app/
│   ├── architecture.md
│   ├── navigation.md
│   └── database.md
├── flows/
│   ├── authentication.md
│   ├── create-routine.md
│   ├── start-workout.md
│   └── log-workout.md
├── plans/
│   └── <initiative-name>/
│       ├── plan.md
│       ├── tasks/
│       │   └── <task-name>.md
│       ├── research.md
│       └── thoughts.md
└── templates/
    ├── flow.md
    ├── plan.md
    └── task.md
```

Not every directory needs every optional file. Create a file only when it contains useful
information that is not clearer in code.

A per-feature documentation tier (`docs/features/<name>/`) is deliberately **not** part of this
plan. See [Deferred: per-feature documentation](#deferred-per-feature-documentation).

## Responsibilities

### `docs/app/`

Describe durable, cross-feature application concepts such as architecture, routing, state,
database boundaries, authentication, environments, and native integration.

These documents explain system shape and rationale. They should link to source paths rather than
duplicate implementation details that can be read directly from code.

### `docs/flows/`

Describe current end-to-end user journeys that cross screens or features. Each flow should cover:

- user goal;
- prerequisites;
- entry points;
- main path in numbered steps;
- alternative, empty, and error paths;
- screens and routes involved;
- state and data changes;
- completion state;
- links to the source files that implement each step.

A flow document is the primary unit of durable product documentation here. It carries the
cross-screen narrative that cannot be recovered by reading any single directory under
`features/`, which is precisely the information an agent lacks.

### `docs/plans/`

Store implementation intent, research, task breakdowns, rejected alternatives, and historical
context under one initiative directory.

The initiative `plan.md` is the canonical plan overview. A `tasks/` directory is optional and should be
used only when the plan needs independently executable work items. `research.md` and
`thoughts.md` are non-authoritative inputs until their conclusions are promoted into the plan or
durable documentation.

Plans do not describe the current app after implementation. They remain historical records, as
required by `AGENTS.md`.

## Deferred: per-feature documentation

An earlier draft of this plan included `docs/features/<name>/` with `README.md`, `decisions.md`,
and `testing.md`. It is deferred because:

- for an application this size, a feature document and its corresponding flow document would
  restate each other, and only one of the two would stay updated;
- a feature README is at constant risk of becoming the prose restatement of `features/<name>/`
  that the [Non-goals](#non-goals) already forbid;
- three optional files per feature is a maintenance surface with nothing enforcing it.

Revisit only when a specific flow document has grown too crowded to read, and extract the feature
document from that concrete pressure rather than creating the tier speculatively.

## Source-of-truth rules

1. `AGENTS.md` owns rules every coding agent must know automatically.
2. `docs/app/` and `docs/flows/` own durable current-state documentation.
3. `docs/plans/` owns proposed work and historical implementation context.
4. Source code owns low-level implementation details.
5. If a plan and durable documentation disagree after shipping, the durable documentation is
   authoritative and the code must be checked to confirm actual behavior.
6. Use standard Markdown links and repository-relative code paths rather than Obsidian-only
   wikilinks.

## Staleness is the primary failure mode

Durable documents claim to describe current behavior. When they fall behind, they do not merely
become unhelpful — they become actively misleading. A stale flow document does not produce a
confused human who goes and reads the code; it produces an agent that confidently implements the
wrong thing.

An `updated:` field is not a defense, because nothing updates it. The defense is a check that
fails:

`bun run docs:check` must verify that:

- every Markdown file under `docs/` has parseable YAML frontmatter with the required keys for its
  `type`;
- every repository-relative source path cited in a durable document exists on disk;
- every `context:` entry in a task note resolves to an existing file;
- every `supersededBy:` value resolves to an existing document.

The check is intentionally shallow. It cannot know whether prose is accurate; it can know that a
document points at files that no longer exist, which is the specific failure that misleads an
agent. Rename a directory and the check goes red in the same commit that caused the rot.

Add it as a `package.json` script. Wire it into the Husky pre-commit hook only once it is stable
enough not to be annoying; running it manually and in review is sufficient at first.

## Agent discovery

Agents automatically receive `AGENTS.md`, but they do not automatically receive every document
under `docs/`. Use `AGENTS.md` as the discovery mechanism without copying flow descriptions into
it or requiring agents to load the entire documentation tree.

Implementation must update the `AGENTS.md` reference-docs section with rules equivalent to:

```markdown
## Documentation

- `docs/app/` describes current shared architecture.
- `docs/flows/` describes current end-to-end user journeys.
- `docs/plans/` contains proposed work and historical context; plans do not describe current
  behavior.
- Before changing user-visible behavior, read the relevant flow documents linked from
  `docs/README.md` or the task plan.
- Update affected durable documentation when shipped behavior changes.
```

That instruction is soft — it competes with everything else in `AGENTS.md` and will be honored
inconsistently. The reliable mechanism is the explicit reading list in the work item itself: a
task note's `context:` array names the exact paths to read, and `docs:check` guarantees they
resolve. Treat `context:` as the primary discovery path and the `AGENTS.md` rule as the fallback
for work that arrives without a task note.

`docs/README.md` must provide the human- and agent-readable index of available app and flow
documents. A plan or task should link directly to the specific documents needed for that work.
Agents should load only relevant documents rather than every flow note.

The current statement that `docs/plans/` contains only completed plans must be revised. The new
rule is that plans may be proposed, active, or historical, but they are never authoritative for
current shipped behavior. Agents must not infer runnable work from a plan unless the user or a
task note explicitly directs them to execute it.

## Document lifecycle

1. Create `docs/plans/<initiative-name>/plan.md` when an initiative needs written planning.
2. Add research, thoughts, and task notes only when they improve execution or preserve rationale.
3. During implementation, keep proposed behavior in the plan rather than documenting it as
   current behavior.
4. Before considering the initiative complete, update the affected `docs/app/` and `docs/flows/`
   documents.
5. Mark the plan `status: completed` and preserve it in place as historical context.
6. When behavior changes later, update durable documentation and link to the newer plan where the
   rationale matters.

## Metadata

Use minimal frontmatter so documents remain queryable without making metadata burdensome.

Durable documents:

```yaml
---
type: app | flow
status: current | superseded
area: <area-name>
updated: YYYY-MM-DD
supersededBy: <path-if-applicable>
---
```

`status` and `supersededBy` exist only to support a `type`/`area`/`status` browsing view. A stale
flow document is normally rewritten in place rather than superseded; if the browsing view is
dropped, drop these two fields with it rather than maintaining them for their own sake.

Plans:

```yaml
---
type: plan
status: proposed | active | blocked | completed | abandoned
area: <area-name>
created: YYYY-MM-DD
---
```

Task notes:

```yaml
---
type: task
status: ready | doing | blocked | review | done
area: <area-name>
context: # REQUIRED — exact paths the agent must read first
  - ../../flows/start-workout.md
  - features/workouts/workout-content.tsx
verify: # commands that prove the work landed
  - bun run type-check
created: YYYY-MM-DD
---
```

`context:` is required and must be non-empty; `docs:check` validates that each entry exists. The
note frontmatter is the canonical task state. A Kanban board, if added later, should only provide
links or derive its view from that state; it must not create a second status source.

## Implementation phases

### Phase 1: pilot one flow

- Write `docs/flows/start-workout.md` as freeform prose, without a template.
- Validate every statement against the shipped code rather than copying old plan assumptions.
- Link each step to the source files that implement it.

Workout execution is the recommended pilot because it exercises navigation, state, and persisted
data across a complete user journey.

Writing the pilot first is deliberate. Templates authored ahead of evidence get filled in
ceremonially — every heading attracts a paragraph because the heading is there, not because there
was something to say. The template is an extraction from a document that proved useful, not a
prediction of one.

### Phase 2: extract conventions from the pilot

- Derive `docs/templates/flow.md` from the sections of the pilot that carried real information;
  drop the ones that did not.
- Add `docs/templates/plan.md` and `docs/templates/task.md`.
- Add `docs/README.md` as the documentation index, explaining each top-level directory and where
  each kind of information belongs.
- Document the standard Markdown linking and repository-relative source path conventions.
- Create `docs/app/` and `docs/flows/`; keep existing plan files in place, as migration into
  initiative directories is not required.

### Phase 3: make the vault machine-checkable

- Add the `docs:check` script described above and a `package.json` entry for it.
- Run it against the pilot and the templates; fix whatever it finds.
- Decide on Husky integration once it has proven stable.

### Phase 4: document shared application systems

- Add architecture and navigation documents based on the current repository.
- Incorporate or link the existing `docs/db-structure.md` without breaking its current references.
- Move a document only when all references to its old path are updated in the same change.
- Keep `AGENTS.md` focused on mandatory rules and link to durable documents for deeper context.

### Phase 5: cover the remaining primary user journeys

- Add authentication.
- Add routine creation.
- Add workout completion and logging.
- Add alternative and failure paths only when they represent supported or intentionally handled
  behavior.

### Phase 6: integrate discovery and maintenance

- Update the `AGENTS.md` reference-docs section with the agent-discovery contract above.
- Replace the current completed-plans-only wording with the new proposed, active, and historical
  plan lifecycle.
- Add links from `docs/README.md` to each current app and flow document so agents can discover
  relevant context without scanning the entire vault.
- Add a documentation checklist to the plan template: identify affected app and flow documents
  before marking work complete.
- Optionally add an Obsidian Base for browsing documents by `type`, `area`, and `status`.
- Do not require Obsidian, community plugins, or a Kanban board for agents to consume the docs.

## Repository hygiene

`docs/.obsidian/` is currently untracked and unmentioned in `.gitignore`. Resolve it explicitly
during Phase 2:

- commit the shared vault configuration (`app.json`, `core-plugins.json`) so every contributor
  gets the same reading experience, with Markdown links preferred over wikilinks;
- ignore the per-machine files (`workspace*.json` and similar) which churn on every pane move.

## Migration approach

- Do not reorganize all historical plans as part of the first implementation.
- Use the initiative-directory format for new plans, starting with this plan.
- Keep `docs/db-structure.md` at its current path during the pilot because it is already referenced
  by `AGENTS.md`.
- Promote only verified, current conclusions from older plans into durable documentation.
- Never link an old plan as if it describes current behavior; label links to plans as historical
  context.

## Acceptance criteria

- [ ] At least one current end-to-end flow document exists and is validated against code.
- [ ] Reusable templates for flows, plans, and tasks are extracted from the pilot, not written
      ahead of it.
- [ ] `docs/README.md` clearly explains where each kind of information belongs.
- [ ] `docs/README.md` indexes durable documents without requiring agents to scan all of `docs/`.
- [ ] `bun run docs:check` exists and passes, and fails when a cited source path is removed.
- [ ] The task template requires a non-empty `context:` array, and `docs:check` enforces it.
- [ ] Existing documentation links remain valid.
- [ ] `AGENTS.md` distinguishes durable app and flow docs from historical plans.
- [ ] `AGENTS.md` tells agents when to read and update relevant flow documentation.
- [ ] Active plans are discoverable but cannot be mistaken for current shipped behavior or an
      automatically runnable work queue.
- [ ] `docs/.obsidian/` is explicitly split between committed shared config and ignored
      per-machine state.
- [ ] A contributor can determine where to write architecture, flow, planning, and task
      information without relying on Obsidian.
- [ ] `bun run format:check` passes for the new Markdown files.

## Non-goals

- Rewriting all existing documentation in one change.
- Restating source code APIs or component trees in prose.
- Creating a per-feature documentation tier before a flow document demonstrably needs one.
- Making Obsidian mandatory for contributors or agents.
- Introducing a second task-status source through Kanban lanes.
- Treating historical plans as current application documentation.

## Follow-up decisions

After the pilot, decide whether:

- `docs/db-structure.md` should remain at the root or move under `docs/app/`;
- a per-feature documentation tier is warranted, and if so whether decisions belong in one
  `decisions.md` or in individual decision records;
- task notes are useful enough to standardize beyond complex initiatives;
- `docs:check` should run in the Husky pre-commit hook or only in review;
- an Obsidian Base adds enough value to commit a shared view — and if not, whether `status` and
  `supersededBy` should be dropped from durable frontmatter.
