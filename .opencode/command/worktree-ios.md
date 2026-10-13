---
description: Operate per-worktree iOS using the project's worktree-ios skill.
agent: build
---

Load the `worktree-ios` skill and follow it in full.

Treat `$ARGUMENTS` as additional user instructions about the worktree, requested action, or exact
simulator target. Do not skip the skill's single-runner check, nonempty exact targets, setup
confirmation, launch intent, process ownership verification, or deletion confirmation. Never force
an action or clear shared coordination state.
