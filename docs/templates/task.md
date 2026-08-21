---
type: template
status: current
area: documentation
updated: 2026-08-21
---

# Template: task note

Copy the body below into `docs/plans/<initiative-name>/tasks/<task-name>.md`. Task notes are
optional — add them only when a plan needs work items that can be picked up and executed
independently. A plan whose steps are a checklist does not need them.

The frontmatter is the **canonical status** for the task. If a board is ever added, it links to
these notes or derives its view from them; it does not become a second place where status lives.

`context:` is the primary discovery mechanism in this system. The `AGENTS.md` rule telling agents
to read relevant flow documents is soft and competes with everything else in that file; an explicit
list of paths in the work item is not. Name the exact files to read first, durable documents before
source, and keep the list short enough that it is actually read.

A task that ships a behavior change ships the documentation for it. **Definition of done** names
the durable documents this task edits and what each one has to say afterwards — a generic "docs
updated" line gets ticked without opening a file, which is why it is not the shape here. The plan
records impact for the whole initiative; the task is where one document actually changes. When the
task genuinely touches no user-visible behavior and no shared system, write that with the reason
instead of a document list. The surrounding lifecycle lives in [`docs/README.md`](../README.md).

Paths below are bare repository-relative code spans because the template and its destination sit at
different depths. In the real file, `context:` entries are written relative to the task note itself
(`../../../flows/start-workout.md` from `docs/plans/<initiative-name>/tasks/`), and prose links
follow the same convention as every other document here: standard Markdown, repository-relative,
angle brackets around any path containing parentheses.

---

```yaml
---
type: task
status: ready # ready | doing | blocked | review | done
area: workouts
context: # REQUIRED, non-empty. Nothing enforces this — check each path
  # resolves on disk yourself before handing the note to an agent.
  # Exact paths the agent must read before writing code, durable docs first.
  - ../../../flows/start-workout.md
  - ../../../../apps/mobile/src/stores/use-user-store.ts
  - ../../../../apps/mobile/src/services/user-service.ts
verify: # commands that prove the work landed
  - bun run type-check
  - bun run lint
created: 2026-08-04
---
```

# Task: <imperative phrase — e.g. "add start/complete actions to the workout store">

## Goal

One or two sentences. What changes, and how the next person can tell it worked. If this task is one
slice of a larger change, name the slice and link the plan (`../plan.md`).

## Why this is a separate task

Optional, but worth a line when the split is not obvious — a blocking dependency, a different area
of the codebase, or work that can land independently without shipping a half-feature.

## Scope

- **In:** the files and behavior this task owns.
- **Out:** the adjacent thing a reader will assume is included. Naming it prevents the task from
  quietly growing.

## Notes

Anything already known that would otherwise be rediscovered: a constraint recorded in a comment, a
measured value, a convention in the surrounding files that the change must match. Prefer linking
the durable document that explains it over re-explaining it here.

## Definition of done

- [ ] <observable outcome>
- [ ] Everything in `verify:` passes.
- [ ] `docs/flows/start-workout.md` — <what this task changes in it>.
- [ ] `docs/app/database.md` — <what this task changes in it>. Replace these two lines with the
      documents this task actually owns, or with the reason none is affected.
