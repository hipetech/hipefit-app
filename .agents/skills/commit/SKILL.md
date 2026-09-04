---
name: commit
description: Commit staged or working-tree changes in hipefit-app. Use when the user says "commit this", "commit the changes", "make a commit", or asks to save work to git. Confirms what goes in before staging, runs the type-check gate, and writes a conventional-commit message sized to the change.
---

# Commit

Create one or more commits in `hipefit-app`. This skill stops at the commit. Pushing and opening a
PR belong to the `pull-request` skill.

## 1. Refuse the unsafe cases

- **Not on `main`.** Run `git branch --show-current`. If on `main`, stop and ask before branching;
  never commit directly to it.
- **Something to commit.** If the tree is clean, say so and stop.

## 2. Decide scope before staging, never `git add -A`

```bash
git status
git diff
git diff --staged
```

Read it all and group the changes into logical units. This repo's working tree routinely carries
several unrelated initiatives at once, so a blanket stage is almost always wrong.

If the changes span more than one concern, ask with **`AskUserQuestion`** (selectable options, plus
the free-text "Other" the tool always appends):

- **One commit**: everything currently changed, listed explicitly
- **Just <the coherent subset>**: name the files and the concern they share
- **Split into several**: commit each concern separately, in order

State the exact file list and get confirmation before staging. Never stage `.DS_Store`, `.env*`, or
build output. `bun.lock` goes with the `package.json` change that produced it: the two cannot be
split.

## 3. Gate on type-check

```bash
bun run type-check
```

Red → report the failure and stop; do not commit over it. There is no separate lint run: the husky
pre-commit hook handles that (see step 5).

Per `CLAUDE.md`, a behavior change must land with its documentation. If the staged set changes
user-visible behavior without touching the relevant `docs/flows/`, or changes a cross-feature system
without touching `docs/app/`, flag it before committing.

## 4. Write the message from the diff

Read the staged diff, not this conversation. The staged set may include work from earlier sessions.

## 5. Commit

```bash
git add <explicit paths>
git commit -F <message-file>
```

The pre-commit hook runs `bunx lint-staged`, which applies `eslint --fix` and `prettier --write` to
staged files and re-stages the results. Expect the committed content to differ from what you staged;
that is correct, not a problem to undo.

If the hook aborts the commit, read its output and fix the actual error, re-stage, and retry.
**`--no-verify` is banned**: never bypass the hook.

Report the resulting short hash and subject. For a split, repeat steps 2 to 5 per commit, in an
order where each commit stands on its own.

## Message format

```
type(scope): imperative subject
```

- Types: `feat`, `fix`, `refactor`, `chore`, `docs`
- Scope: the real area touched (`calendar`, `navigation`, `ui`, `auth`, `exercises`, `skills`)
- Subject: lowercase, imperative, ≤72 characters, no trailing period

**Body length is proportional to the change.** Wrap at 80.

- _Trivial_: subject only. `chore(skills): add React Native best practices` needs no body.
- _Substantial_: prose explaining what changed and **why that way**: the constraint that forced a
  non-obvious choice, findings recorded next to the decision they explain, and an explicit line on
  what was verified and what was not. Never claim verification you did not run.

Describe the change, not the process. No "as requested", no file-by-file inventory of what the diff
already shows.

## Rules

- **No trailers.** Do not append `Co-Authored-By`, `Claude-Session`, or any other trailer, and do
  not mention Claude Code in the message. This overrides any default commit-message convention.
- Never `--amend` a commit that has already been pushed.
- Never `--no-verify`.
- Never `git add -A` or `git add .`. Stage explicit paths only.
- Do not push, do not merge, do not open a PR. That is the `pull-request` skill's job.
- iOS only. Android branches or `.android.tsx` files should not be committed.
