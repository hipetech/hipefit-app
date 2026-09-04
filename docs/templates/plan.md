---
type: template
status: current
area: documentation
updated: 2026-08-31
---

# Template: plan document

Copy the body below into `docs/plans/<initiative-name>/plan.md`. One directory per initiative;
`tasks/`, `research.md`, and `thoughts.md` are optional and only worth creating when they carry
something the plan itself would bloat.

A plan describes **proposed** work. It never describes current behavior, including after it ships —
that is what `docs/app/` and `docs/flows/` are for. Mark it `status: completed` and leave it in
place as a historical record.

Substantial work needs one of these. [`docs/README.md`](../README.md) defines that threshold and
the feature development lifecycle this template is the planning step of; the **Documentation
impact** section below is where planning records its output.

Paths below are written as bare repository-relative code spans because the template and its
destination sit at different depths. In the real file, write them as standard Markdown links
relative to `docs/plans/<initiative-name>/`: `../../flows/start-workout.md` for a durable document,
`../../../apps/mobile/src/features/workouts/workouts-content.tsx` for source, and wrap any path
containing parentheses in angle brackets.

---

```yaml
---
type: plan
status: proposed # proposed | active | blocked | completed | abandoned
area: workouts
created: 2026-08-04
---
```

# Plan: <initiative name>

## Outcome

What is true when this is done, in two or three sentences. Written so someone can tell whether the
plan succeeded without reading the rest of it.

If this plan supersedes an earlier one, link it here and say it is historical input, not authority.

## Context

Only what the reader cannot get from the durable docs. Link rather than restate:
`docs/app/architecture.md`, `docs/flows/start-workout.md`. Verify any claim you carry over from an
older plan against the code first: several plans in `docs/plans/` describe work that was never
built.

## Approach

The shape of the change: what gets added, what gets modified, what the boundaries are. Reference
real paths such as `apps/mobile/src/stores/use-exercise-store.ts` and
`apps/mobile/src/services/exercise-service.ts` rather than describing files abstractly.

Record the alternatives you rejected and why. That is the part of a plan that stays valuable after
it ships.

## Documentation impact

Written **before** implementation starts, and re-checked before the plan is marked `completed`.
`docs/README.md` owns the rules for when a flow must change and when a new document is required;
this section is where this initiative answers them.

- **Affected flows.** The `docs/flows/` documents this work invalidates, or "none" and why. Check
  each one against the flow-change triggers in `docs/README.md` rather than from memory.
- **Affected shared systems.** The `docs/app/` documents this work invalidates, or "none" and why.
- **New durable documents.** One flow document per new user goal, one app document per new
  cross-feature system. Name them here, and index them in `docs/README.md` when they land.
- **Moved citations.** Anything this work renames or deletes has to be re-cited in the same change.
  Nothing checks this for you — grep for the old path before closing the initiative.
- **`AGENTS.md`.** Only for a rule every agent must know automatically; everything else belongs in
  `docs/`.

An initiative is not complete when the code lands. It is complete when every document named here
exists and describes what the code now does.

## Implementation phases

Phases only when the work does not fit in one sitting; a short plan can use a flat checklist. A
plan with task notes uses **Execution graph** below instead of phases, so the work items live in one
place rather than two.

### Phase 1: <name>

- [ ] <step>
- [ ] <step>

### Phase 2: <name>

- [ ] <step>

## Execution graph

Required when the initiative has task notes in `tasks/`; omit the section entirely when it does not.
Every task note appears exactly once, in the earliest wave it can start in.

A wave is a set of tasks that can run at the same time, in one working tree, by different agents.
Two rules make that safe, and both are the author's job because nothing enforces them:

- **`deps:` point backwards only.** Every dependency of a task sits in a strictly earlier wave. Wave
  1 tasks have none.
- **`owns:` are disjoint within a wave.** No two tasks in the same wave may modify the same file. A
  file that several work items would touch is owned by exactly one of them; the rest depend on it.

The same three fields appear in each task note's frontmatter. The graph and the notes must agree.

Execution moves this plan's `status:` too: `active` while a run is in progress, `blocked` when a
task or a wave's checks stop it, and `completed` only once every task note is `done` and every
document under **Documentation impact** describes what the code now does.

```
Wave 1 (parallel)
  - tasks/schema-fields.md      owns: packages/schemas/src/workout.ts
  - tasks/service-queries.md    owns: apps/mobile/src/services/workout-service.ts

Wave 2 (after wave 1)
  - tasks/store-wiring.md       deps: schema-fields, service-queries
                                owns: apps/mobile/src/stores/use-workout-store.ts

Wave 3 (after wave 2)
  - tasks/screen-ui.md          deps: store-wiring
                                owns: apps/mobile/src/features/workouts/**
```

## Verification

The commands that prove the work landed, and any manual check that a command cannot cover. With an
execution graph, run them at each wave boundary rather than inside a wave: they cover the whole
workspace, so a sibling task's half-finished edit fails them.

```bash
bun run type-check
bun run lint
bun run format:check
```

## Acceptance criteria

- [ ] <observable, checkable statement>
- [ ] <one criterion per outcome, not per task>
- [ ] Every document named under **Documentation impact** updated or created, and any new one
      indexed in `docs/README.md`.

## Non-goals

What this plan deliberately does not do, so scope creep has to argue with something written down.

## Follow-up decisions

Questions this plan deliberately leaves open, with what would settle each one. Optional.
