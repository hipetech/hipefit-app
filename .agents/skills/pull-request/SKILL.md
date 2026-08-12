---
name: pull-request
description: Open a pull request for work in hipefit-app. Use when the user says "create a PR", "open a pull request", "raise a PR", or asks to put a branch up for review — including "commit and open a PR", which runs the commit skill first. Always confirms the source branch and merge target first via a selectable prompt, then opens the PR with a brief title and a short summary of what was done.
---

# Pull request

Open a pull request on `github.com/hipetech/hipefit-app` using the `gh` CLI.

## 1. Confirm the branches — always, never assume

First gather the real candidates, most recently used first:

```bash
git branch --show-current
git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/heads | head -8
```

Then ask with **`AskUserQuestion`** — two questions in a single call, each with selectable options
built from that output. The tool always appends an **"Other"** choice with a free-text field, so the
user can type any branch name that is not listed; never skip the prompt just because the answer
looks obvious.

**Question 1 — "Which branch should be merged?"** (header: `Source`)

- The current branch, first, labelled `(current)`
- The next two or three most recent local branches
- Description on each: its last commit subject and date, so the user can tell them apart

**Question 2 — "Where should it merge into?"** (header: `Target`)

- `main` first, marked `(Recommended)` — the default base
- `development`, which also exists on origin
- Any other plausible long-lived branch from the list

This repo carries several long-lived `feature/*` branches plus `development`, so the target is a
real choice, not a formality. If the chosen source has no upstream, say so — pushing it is part of
this skill.

## 2. Check the branch is ready

- **Nothing uncommitted that belongs in the PR.** Run `git status`. If relevant changes are
  uncommitted, what happens next depends on what was asked:
  - **The request covered committing** — "commit and open a PR", "ship this", "commit this then
    raise it" — invoke the **`commit` skill** with the `Skill` tool and follow it in full, then
    return here and finish this step against the resulting tree. Do not commit by hand; that skill
    owns scope confirmation, the type-check gate, and the message format.
  - **The request was only for a PR** — ask whether to commit the outstanding work first. On yes,
    invoke the `commit` skill as above. On no, stop: a PR that omits the work under discussion is
    almost never what was wanted.

  Either way the `commit` skill runs to completion before the PR is opened, and it never calls back
  into this one.
- **The gates pass.** Per `CLAUDE.md` there is no test runner, so these are the gate:
  ```bash
  bun run type-check
  bun run lint
  ```
  Do not open a PR on a red gate. Report the failure and stop.
- **Docs agree with the code.** A user-visible behavior change updates the affected `docs/flows/`;
  a cross-feature system updates `docs/app/`. `docs/plans/` is intent, never evidence of behavior.

## 3. Read the actual diff

```bash
git diff <target>...<source> --stat
git diff <target>...<source>
```

Write the PR from the diff, not from the conversation — the branch may carry work from earlier
sessions.

## 4. Open it

```bash
gh pr create --base <target> --head <source> --title "<title>" --body-file <path>
```

Report the PR URL back to the user.

## Title

A brief summary of the changes — one line, plain language, under ~70 characters, describing the
branch as a whole rather than its largest single change.

Good: `Expandable weekly calendar on Home`
Good: `Replace the floating create button with a native dock`
Bad: `Various fixes and improvements` (says nothing)
Bad: `Add calendar-week-row.tsx, calendar-pager.tsx and use-calendar-expansion.ts` (file list)

## Description

Short. A few sentences on what was done and, where a choice is non-obvious, why. Then the checks you
ran. Skip any section with nothing in it.

```markdown
## What

Two or three sentences: what this branch changes, from the user's point of view where possible.
Add a line of _why_ only where a decision would otherwise look arbitrary.

## Notes

Optional, only when real: a known gap, something left unverified, or a constraint a reviewer would
otherwise read as an accident.

## Checks

`bun run type-check` and `bun run lint` pass.
```

Never claim verification you did not run. If something is untested on device, write "unverified".

## Rules

- Confirm source and target every time, with selectable options; never infer the base.
- PRs open ready for review. Pass `--draft` only when the user asks for a draft.
- Never `--force` push.
- No `--admin`, no auto-merge, no merging — opening the PR is where this skill stops.
- iOS only. A branch adding Android branches or `.android.tsx` files is wrong before it is reviewed.
