---
type: template
status: current
area: documentation
updated: 2026-08-04
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
relative to `docs/plans/<initiative-name>/` — `../../flows/start-workout.md` for a durable
document, `../../../features/workouts/workouts-content.tsx` for source, and wrap any path
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

Only what the reader cannot get from the durable docs. Link rather than restate —
`docs/app/architecture.md`, `docs/flows/start-workout.md`. Verify any claim you carry over from an
older plan against the code first: several plans in `docs/plans/` describe work that was never
built.

## Approach

The shape of the change: what gets added, what gets modified, what the boundaries are. Reference
real paths — `features/workouts/store/use-workout-store.ts`, `database/refs.ts` — rather than
describing files abstractly.

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

Phases only when the work does not fit in one sitting; a short plan can use a flat checklist.

### Phase 1: <name>

- [ ] <step>
- [ ] <step>

### Phase 2: <name>

- [ ] <step>

## Verification

The commands that prove the work landed, and any manual check that a command cannot cover.

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
