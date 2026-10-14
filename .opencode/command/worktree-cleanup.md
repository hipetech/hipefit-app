---
description: Tear down a worktree's simulator and caches using the project's worktree-cleanup skill.
agent: build
---

Load the `worktree-cleanup` skill and follow it in full.

Treat `$ARGUMENTS` as additional user instructions about which cache groups to delete or keep. Do
not skip the skill's single-worktree check, the `worktree-ios` ownership verification before any
stop or detach, the simulator deletion confirmation, the per-path checks, the cache selection
prompt, or the primary-worktree refusal for environment files. Never force an action, discard
tracked changes, or remove the Git worktree.
