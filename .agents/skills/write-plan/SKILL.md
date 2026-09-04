---
name: write-plan
description: Research the codebase and write an initiative plan into docs/plans/<initiative-name>/ in hipefit-app, split into task notes several agents can execute in parallel. Use when the user says "write a plan", "plan this feature", "create a plan for X", "break this into tasks", or asks how work should be divided before any code is written. Writes only the plan documents; it never edits implementation files and never runs or dispatches the work.
---

# Write plan

Turn a request into `docs/plans/<initiative-name>/plan.md` plus one task note per work item, cut so
several agents can execute them at the same time without editing the same files.

This skill authors documents and stops there. It never edits implementation files, never runs a
task, and never dispatches an agent to run one. Executing a plan is the `implement` skill's job;
committing belongs to the `commit` skill, and `docs/plans/` is gitignored anyway.

## 1. Refuse the cases that should not get a plan

- **Below the threshold.** `docs/README.md` owns the feature lifecycle and defines what substantial
  means. Read it and classify the request against it. A small fix does not get a plan directory:
  say so, name the durable document the change must still update, and stop.
- **Already planned.** Run `ls docs/plans/`. If an initiative already covers this subject, extend or
  supersede that plan. Never open a second directory for the same work.
- **Same checkout as the run.** `docs/plans/` is gitignored, so a plan exists only in the checkout
  that writes it, and a fresh git worktree starts with an empty `docs/plans/`. Write the plan in the
  checkout where `implement` will run.
- **Research stays read-only.** Inspection commands only: `ls`, `cat`, `grep`, `git log`. No
  `bun install`, no `pod install`, no `bun run db:seed` or `db:wipe`, and no edit outside the plan
  directory. If the investigation shows the whole request is a one-line fix, report that and stop
  rather than fixing it here.

## 2. Read the rules before researching

- `AGENTS.md` for the constraints, boundaries, and conventions every task note inherits.
- `docs/README.md` for the feature lifecycle, the flow-change triggers, and the documentation
  conventions. It is the authority on all three; do not restate it in the plan.
- `docs/templates/plan.md` and `docs/templates/task.md`, the shapes you are about to fill in. They
  are the only plan and task shapes in this repo. Do not invent sections they do not have.
- The documents the subject triggers, listed under **Required Reading** in `AGENTS.md`:
  `docs/app/code-style.md` for any code change, plus `ui.md`, `navigation.md`, `database.md`,
  `docs/db-structure.md`, and the affected `docs/flows/` as they apply.

## 3. Research before proposing anything

Read the real implementation: the call sites, the types, the stores and services the change touches,
and the comments around them. `docs/plans/` is intent, never evidence, so verify every claim you
carry over from an existing plan against the source before repeating it.

Fan out with read-only research agents when the host offers them (`Explore` or `architect` in Claude
Code, `explore` in OpenCode). Never delegate to an agent that can edit files.

Ask with **`AskUserQuestion`** only about decisions that materially change behavior or scope and
cannot be settled from the repository. Anything answerable by reading, read.

## 4. Cut the work into tasks that can run in parallel

The split is what this skill produces. Get it right before writing a file.

- **One task is one coherent slice** with its own definition of done, sized for one agent in one
  sitting. A task nobody can finish without touching another task's files is cut wrong.
- **`owns:` lists every file the task may create or modify**, as exact paths or globs. Two tasks in
  the same wave must have disjoint `owns:`. A file that several work items would touch (a barrel, a
  `docs/flows/` document, `docs/README.md`) gets exactly one owner, and the others depend on it.
- **`deps:` point backwards only.** Every dependency sits in a strictly earlier wave. Wave 1 tasks
  have none.
- **Cut along the layers in `docs/app/architecture.md`**, which is where the seams already are:
  `packages/schemas`, then `packages/firebase`, then `apps/mobile/src/services`, then
  `apps/mobile/src/stores`, then `apps/mobile/src/features/<name>`, then `apps/mobile/app`. A
  layer's consumers wait a wave.
- **Dependency changes get a wave to themselves.** `package.json`, `bun.lock`, and
  `apps/mobile/ios/Podfile.lock` are shared state that `bun install` and `pod install` rewrite, so
  nothing runs beside them.
- **Every task leaves the tree type-checkable.** Agents in a wave share one working tree, so
  `bun run type-check` and `bun run lint` see each other's edits. Work that has to leave the build
  red belongs in the same task as the change that fixes it.
- **No git in a task note, and no commit anywhere in the plan.** The `implement` skill runs these
  tasks and never commits; the user commits the finished tree through the `commit` skill.

## 5. Confirm the split before writing anything

Ask with **`AskUserQuestion`**: one question, selectable options plus the free-text "Other" the tool
always appends. State the initiative directory name, the outcome in one sentence, and the waves with
each task's `owns:`, then offer:

- **Write it as shown**, the split above
- **Resplit**, same scope with different task boundaries; name what to merge or divide
- **Change the scope**, what moves in or out of the initiative

## 6. Write `plan.md`

Copy the body of `docs/templates/plan.md` into `docs/plans/<initiative-name>/plan.md` and fill in
every section the template defines except **Implementation phases**, which the **Execution graph**
replaces. The graph lists every task note exactly once.

- Frontmatter: `type: plan`, `status: proposed`, the `area:`, and today's date in `created:`.
- **Documentation impact** is written now, not after implementation. Check each `docs/flows/`
  document against the flow-change triggers in `docs/README.md` rather than from memory.
- Record the alternatives you rejected and why. That is the part of a plan that outlives it.
- Links are standard Markdown and repository-relative from the plan directory
  (`../../../apps/mobile/src/...`), with angle brackets around any path containing parentheses.
  **Every path must resolve**, so check each one with `ls` before writing it.

## 7. Write one task note per work item

Copy the body of `docs/templates/task.md` into `docs/plans/<initiative-name>/tasks/<task-name>.md`,
one file per task in the graph.

- `status: ready` on every note. The `implement` skill resumes a run from these values, so a note
  that starts as anything else is silently skipped or re-run.
- `wave:`, `deps:`, and `owns:` match the execution graph exactly. `deps:` entries are task file
  stems, without the `.md`. Wave 1 notes write `deps: []`, never a bare key, because a bare key
  parses as null.
- `context:` is required and non-empty: the exact files the executing agent reads first, durable
  documents before source. Check that every path resolves on disk; nothing enforces this.
- `verify:` carries commands only, `bun run type-check` then `bun run lint` for code. A check that
  needs a running app goes in **Definition of done** as a manual step instead: the executing skill
  never launches the app or the simulator, and reports such checks for the user.
- **Definition of done** names the durable documents this task edits and what each has to say
  afterwards, or the reason none is affected.

Then cross-check the set: every task in the graph has a note, every note is in the graph, no two
tasks in one wave share a path in `owns:`, and the union of `owns:` covers everything the plan
expects to change.

## 8. Report

Report the directory, the files written, and the number of waves. State plainly that nothing was
implemented and that the plan documents are the whole deliverable. Anything you could not settle
goes into **Follow-up decisions** in the plan and into the report.

## Rules

- Write only inside `docs/plans/<initiative-name>/`. Source, `docs/app/`, `docs/flows/`, and
  `AGENTS.md` are named by the plan and changed by the implementation, never by this skill.
- `docs/plans/` is gitignored, so plans are local working documents. Never `git add -f` one, and
  never treat a plan as the record of what shipped; the durable documents are that record.
- Prettier honours `.gitignore`, so it skips `docs/plans/` as well and `bunx prettier --write` there
  reports no matching files. Hand-wrap at 100 columns to match the rest of `docs/`.
- Apply the writing-style rules in `AGENTS.md`, and load the `humanizer` skill before finalizing the
  prose.
- iOS only, Bun only. A plan that adds an Android branch, an `.android.tsx` file, or an npm command
  is wrong before anyone executes it.
- Never dispatch an agent to execute the plan, and never start implementing "just the first task".
  Execution is the `implement` skill, invoked separately.
