---
name: implement
description: Execute an existing initiative plan in docs/plans/<initiative-name>/ in hipefit-app, dispatching one agent per task note and running the execution graph wave by wave to the end. Use when the user says "implement the plan", "execute the plan", "run the tasks", "start implementing X", "continue the plan", or names an initiative directory to build. Requires a plan that already exists (writing one is the `write-plan` skill), and it stops at the working tree, so it never commits and never opens a pull request.
---

# Implement

Run an existing `docs/plans/<initiative-name>/` plan to the end: every wave of its **Execution
graph**, one agent per task note, verified at each wave boundary.

This skill executes plans and never writes one. That is the `write-plan` skill. It leaves every
change in the working tree: committing belongs to the `commit` skill and a pull request to
`pull-request`, both run by the user afterwards.

## 1. Refuse the cases that must not run

- **No plan, no run.** Run `ls docs/plans/` and match the request against it. With no matching
  initiative, name what is missing (the directory, `plan.md`, or `tasks/`), point at the
  `write-plan` skill, and stop. Never write a plan here, and never implement from the argument text.
- **An empty `docs/plans/` is usually the wrong checkout.** The directory is gitignored, so a plan
  written in another checkout or worktree is not present here. Name that as the likely cause, ask
  where the plan lives, and never rewrite it from memory.
- **No execution graph, no fan-out.** A plan whose work items are phases or a flat checklist has
  nothing to dispatch. Say so, point at `write-plan` to split it into task notes, and stop.
- **More than one candidate.** If the argument does not identify exactly one initiative, ask with
  **`AskUserQuestion`**: one option per unfinished plan, with its `status:` and how many waves are
  left. Never guess which plan was meant.
- **A task left `blocked` by an earlier run.** Re-dispatching it unchanged reproduces the block, so
  ask with **`AskUserQuestion`** before starting: **Retry it**, when the blocker is resolved,
  **Skip it**, naming every task that depends on it and will also be skipped, or **Stop**.
- **Never launch the app.** No `bun run ios:*`, no simulator, no device build, no `bun run db:wipe`.
  A check that needs a running app is reported for the user, never attempted.

## 2. Rebuild the graph from disk

Read `plan.md` in full, then the frontmatter of every note in `tasks/`. The notes are the canonical
status, not this conversation, not an earlier run's report.

Group the tasks by `wave:` and check the graph before running anything: every note appears in the
plan's **Execution graph**, every `deps:` entry resolves to a note in a strictly earlier wave, and
no two tasks in one wave share a path in `owns:`. A conflict is a plan bug: report it with the two
task names and the shared path, and stop rather than running two agents into the same file.

**Resume from status.** The run starts at the lowest wave holding a task that is not `done`:

- `ready`: dispatch it.
- `doing`: an earlier run died inside it. Read its `owns:` paths in the working tree, describe what
  is already there in the brief, and re-dispatch it.
- `review`: the edits landed but no gate confirmed them. Do not re-dispatch; the task joins this
  wave's boundary verification.
- `done`: skip. Never re-run a finished task.

If every task is already `done`, go straight to the documentation audit in step 7.

## 3. Start the run

Set the plan's frontmatter to `status: active`. State the initiative, the waves, the tasks in each,
and the resume point, then run to the end. There is no approval step between waves: only a blocked
task (step 6) or a gate that stays red (step 5) stops the run.

## 4. Dispatch a wave: one agent per task, in parallel

Set each task to `status: doing`, then dispatch every task in the wave **in a single message** so
they run at the same time: the `Agent` tool in Claude Code, the `task` tool in OpenCode. Send the
brief below in full for every task, with that task's note path substituted. Where no subagent tool
exists, run the tasks yourself, one at a time, obeying each note's `owns:` exactly as an agent
would.

**Choose the subagent type per task, not per wave.** Two tasks dispatched in the same message can
go to different agents.

- **A specialist whose stated specialty covers the task gets that task.** Check what this host
  offers, the repository's own agents in `.claude/agents/` and `.opencode/agents/` included, and
  match on the subject rather than a loose association. An Expo SDK upgrade, a dependency
  migration, or a change to the committed native configuration is `expo-migration` work.
- **Everything else goes to the general agent**, `subagent_type: general-purpose` in Claude Code or
  the `general` subagent in OpenCode. An uncertain match takes this branch: a general agent
  following the brief beats a specialist working outside its subject.
- **An agent that cannot edit files is never an executor.** `skill-forge` and `plan-creator` return
  proposals, and a review or research agent returns findings. Dispatched as a task agent, one of
  them reports the task done with nothing written to disk, and the wave gate fails with nobody left
  in context to explain why. A task that edits `.agents/skills/` still goes to the general agent.
- **The brief outranks the agent's own prompt.** A specialist carries instructions of its own and
  may reach for `bun install`, `pod install`, git, or the workspace checks unprompted. Send the
  brief in full to every agent, specialist included: it is the whole contract, and nothing in a
  specialist's prompt licenses editing outside `owns:` or fanning out further.

```
You execute one task note from a plan in the Hipefit repository, and nothing else. Other agents are
working in the same tree right now, each on its own task note. Every rule below exists because of
that.

Task note: docs/plans/<initiative-name>/tasks/<stem>.md

Read first. Read the note in full, then every path in its `context:`, durable documents before
source, then the code you are about to change including the comments around it. Measured values and
documented divergences stay unless this task explicitly changes them. Read `AGENTS.md` and the
documents its Required Reading section triggers for your subject: `docs/app/code-style.md` for any
code change, `docs/app/ui.md` for UI, `docs/app/navigation.md` for routing, `docs/app/database.md`
and `docs/db-structure.md` for data or schema, and the affected `docs/flows/` for user-visible
behavior. `docs/plans/` is intent, never evidence: verify anything the plan claims is already true
against the source before building on it.

Stay inside `owns:`. It is the complete set of paths you may create or modify, not a starting point.
If the work needs a file outside it, stop and report it. Do not edit it, do not work around it, do
not create a parallel copy: a sibling agent may be inside that file right now, and your report is
what lets the coordinator resequence the plan. Never edit anything under `docs/plans/`, including
your own task note. Status is the coordinator's bookkeeping.

Build it the way this repo builds things. iOS only: no Android branch, no `.android.tsx` file, no
platform fallback. Bun only, never npm or yarn. Strict TypeScript, no `any`, props are interfaces,
components are `React.FC` arrow functions, one named component per file, lowercase-hyphenated
filenames. Follow the existing boundaries instead of adding a parallel pattern, and check
`apps/mobile/src/lib/format.ts`, `apps/mobile/src/lib/constants.ts`,
`apps/mobile/src/lib/haptics.ts`, `apps/mobile/src/theme/styles.ts`,
`apps/mobile/src/theme/modifiers.ts`, and `apps/mobile/src/hooks/` before writing a local
equivalent. Update the durable documents named in the Definition of done; they are inside your
`owns:`. Apply the writing-style rules in `AGENTS.md`, and load the `humanizer` skill before
finalizing prose.

Do not run git, in any form. Do not run `bun run type-check` or `bun run lint`: they cover the whole
workspace and would fail on a sibling's half-finished edit, so the coordinator runs them at the wave
boundary. Do not launch the app, the simulator, or a device build, and never run `bun run db:wipe`.
No `bun install` or `pod install` unless this task note names it. The one command you do run is
`bunx prettier --write` on the files you touched, never on a path under `docs/plans/`.

Do not dispatch agents of your own. This task is yours to finish.

Report: every file you created or modified; each Definition of done item and whether it is met; what
you could not do, naming any path outside `owns:` you needed, a contradiction between the note and
the code, or a check that needs a running app; and anything you left deliberately unfinished, with
the reason. Report accurately. A task reported as done that is not done fails the wave gate later,
with nobody left in context to explain why.
```

A task whose note names `bun install` or `pod install` gets that stated in its brief; `write-plan`
gives such a task a wave to itself, so nothing runs beside it.

Every edit under `docs/plans/` is yours, including status and the Definition of done checkboxes. The
agents never touch their own note. Nothing else in the tree is yours while a wave is running.

## 5. Verify at the wave boundary

When every agent has returned, set each returned task to `status: review` and run the union of their
`verify:` commands from the repository root, deduplicated, in this order:

```bash
bun run type-check
bun run lint
```

Then run `bunx prettier --write` on the files the wave touched, skipping `docs/plans/`: it is
gitignored, Prettier honours that, and the command reports no matching files there.

Green → set every task in the wave to `status: done`, tick its Definition of done from the agent's
report, and start the next wave without pausing.

Red → **fix it yourself**, in this session. No agent is running, so the `owns:` boundaries are not
in force. Read the failure, fix the real cause rather than the symptom, and re-run the gate.
**Three attempts.** Still red after the third: stop the run, leave the tasks at `review`, set the
plan to `status: blocked`, and report the failing command with its output.

A `verify:` entry that is a manual check in a running app is not run. Record it in the report as
outstanding for the user.

## 6. A blocked task aborts the whole run

An agent that fails, hits a contradiction between the note and the code, or needs a file outside its
`owns:` blocks its task. When that happens:

- set that task to `status: blocked` and write the blocker into its **Notes** section;
- let the other agents in the wave finish and run the boundary gate once, setting them to `done` if
  it is green. Never revert their work. Do not spend the three fix attempts on a gate that is red
  because the blocked task never landed;
- set the plan to `status: blocked`;
- start no further wave, including one that would still be fine, and report.

## 7. Audit the documentation after the last wave

Read the plan's **Documentation impact** section and check each document it names against the tree:
did the task that owned it actually update it? Fill every gap yourself: a `docs/flows/` document no
task covered, a new document not indexed in `docs/README.md`, a citation left pointing at a renamed
path. Apply the writing-style rules in `AGENTS.md`, load the `humanizer` skill before finalizing
prose, and run `bunx prettier --write` on each document you touch.

Set the plan to `status: completed` only when every task is `done`, the gate is green, and every
document named under **Documentation impact** exists and describes what the code now does. Anything
short of that leaves the plan `active` and goes into the report.

## 8. Report

Report whether the run finished or aborted:

- **What landed**: the completed waves and tasks, with the files changed.
- **What is half-done**: a blocked task's partial edits, or work left at `review` behind a red
  gate.
- **What was never started**: the waves an abort skipped.
- **The gate result**, verbatim on failure.
- **Every manual check** the plan asks for and this skill did not run.
- **The `status:` values** left behind, on the plan and on each task.

Close with the state of the tree: the changes are uncommitted, and committing is the user's move
through the `commit` skill.

## Rules

- **No git that writes.** No `add`, `commit`, `stash`, `checkout`, `restore`, `reset`, or `push`,
  and no `gh pr`. `git status`, `git diff`, and `git log` are for reading. Never invoke the `commit`
  or `pull-request` skill from here.
- **Never launch the app, the simulator, or a device build**, and never run `bun run db:wipe`. Run
  `bun run db:seed` only when a task note names it, with both flags.
- `bun install` and `pod install` only when a task note names them.
- Status bookkeeping is the only thing you write under `docs/plans/`: task `status:`, the Definition
  of done checkboxes, a blocker under **Notes**, and the plan `status:`. Never rewrite a plan's
  Approach or a task's Scope to match what actually happened. A plan is a record of intent, and one
  that turned out wrong is reported, not edited.
- `docs/plans/` is gitignored and Prettier skips it, so those edits are local. Hand-wrap them at 100
  columns.
- iOS only, Bun only, strict TypeScript. A task that would add an Android branch, an `.android.tsx`
  file, or an npm command is a plan bug: block it and report rather than implementing it.
- Never dispatch an agent without a task note, and never let a task agent fan out further.
