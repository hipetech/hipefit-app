---
name: worktree-cleanup
description: Tears down one Hipefit Git worktree's local iOS footprint by releasing its simulator and Metro port and deleting its rebuildable caches (Xcode DerivedData, Pods, build output, node_modules, copied env files, agent-device session state). Use when the user says "clean up this worktree", "remove the worktree simulator and caches", "tear down the worktree", or "free the worktree's disk space", or invokes "/worktree-cleanup"; a lone stop, detach, or simulator removal with no cache deletion is `worktree-ios`, and it never removes the Git worktree or its branch.
---

# Worktree cleanup

Release one worktree's simulator and Metro port, then delete the rebuildable files it left on disk.

Stopping Metro, detaching, and deleting a simulator belong to the `worktree-ios` skill. This skill
runs those steps through it and never restates or relaxes its checks. App interaction belongs to
`agent-device` and commits to `commit`. Removing the Git worktree or its branch is out of scope.

## 1. Refuse the unsafe cases

- **One worktree: the one the shell is in.** Set the shell tool's working directory to the worktree
  root and confirm it with `git rev-parse --show-toplevel`. Every other worktree's simulator, Metro
  process, runner, and DerivedData is off limits, whatever state it is in. If the request names a
  worktree other than the working directory, ask with **`AskUserQuestion`** (OpenCode:
  **`functions.question`**) before going on.
- **A failed ownership check is a stop.** When `worktree-ios` cannot establish that a listener,
  runner, or simulator belongs to this worktree, stop and report it. Never get past it with
  `--force`, `kill`/`pkill`, `xcrun simctl shutdown` or `delete`, or an edit to the registry, lock,
  or guard.
- **No deletion under a live runner.** While `list` shows this worktree's runner active or its port
  serving, delete nothing.
- **Exact paths only.** Every deletion names one literal absolute path verified in step 2. No
  wildcards, no `find -delete`, no `git clean`, no `git stash`, no `git checkout` or `git reset`.
- **Never discard work.** Report uncommitted tracked changes and leave them. The only tracked file
  this skill may restore is `apps/mobile/ios/Podfile.lock`, under step 7's conditions.
- **Environment files stay closed.** Never read, print, or diff their contents. Never delete them in
  the primary worktree: they are the source `env:sync` copies from and cannot be recovered.
- **Nothing is deleted unselected.** A group the user did not pick in step 5 stays.

## 2. Inspect and measure

```bash
git rev-parse --show-toplevel
git rev-parse --path-format=absolute --git-dir --git-common-dir
git status --short
bun run ios:worktree:list
```

The last two `rev-parse` lines are equal only in the primary worktree. Keep the `git status` output
as the baseline. From `list`, record this worktree's simulator name, UDID, Metro port, and runner
state, or that it holds no assignment.

Build the candidate list, with `<ROOT>` the worktree root:

| Group        | Paths                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| DerivedData  | the one directory matched below                                                        |
| Native build | `<ROOT>/apps/mobile/ios/Pods`, `<ROOT>/apps/mobile/ios/build`                          |
| JavaScript   | every `node_modules` the `find` below prints, `<ROOT>/apps/mobile/.expo`               |
| Env copies   | `<ROOT>/.env.development`, `.env.staging`, `.env.production`, `apps/mobile/.env.local` |
| agent-device | this worktree's session directories under `~/.agent-device/sessions/`, matched below   |

**DerivedData.** Xcode hashes the directory name per workspace path, so match on the recorded path.
The glob here only reads:

```bash
for d in "$HOME"/Library/Developer/Xcode/DerivedData/Hipefit-*; do
  printf '%s\t%s\n' "$d" \
    "$(/usr/libexec/PlistBuddy -c 'Print :WorkspacePath' "$d/info.plist" 2>/dev/null)"
done
```

The candidate is the directory whose `WorkspacePath` equals
`<ROOT>/apps/mobile/ios/Hipefit.xcworkspace` exactly. A different path, a prefix match, or an
unreadable `info.plist` means it belongs to another checkout: leave it.

**`node_modules`.** `-type d` skips symlinks:

```bash
find "<ROOT>" -maxdepth 3 -name node_modules -type d -prune
```

**Env copies.** In a linked worktree, preview what the primary can give back:

```bash
bun run env:sync --dry-run
```

Drop any file it reports as `Not in the primary worktree`. This worktree's copy may be the only one.

**agent-device.** The implicit session directory is `cwd_<HASH>_default`:

```bash
printf '%s' "<ROOT>" | shasum -a 256 | cut -c1-16
```

A named session counts only when a device claim records `<ROOT>` as its workspace. The claim files
hold an owner token, so read these two fields and nothing else:

```bash
for f in "$HOME"/.agent-device/device-claims/*.json; do
  plutil -extract workspace raw -o - "$f"
  plutil -extract stateDir raw -o - "$f"
done
```

Check every candidate, and drop any that fails. The two `git` checks apply to paths inside `<ROOT>`:
the first must succeed and the second must print nothing.

```bash
test -e "<PATH>" && ! test -L "<PATH>"
git check-ignore -q -- "<PATH>"
git ls-files -- "<PATH>"
du -sh "<PATH>"
```

## 3. Release the simulator through `worktree-ios`

Skip this step when the worktree holds no assignment. Otherwise invoke the **`worktree-ios` skill**
with the `Skill` tool (OpenCode: the `skill` tool) and follow it in full for each part, in order:

1. Run `agent-device session list` from `<ROOT>`. If a session is open for this worktree, end it
   with `agent-device close`, adding `--session <name>` for a named one. Never pass `--shutdown` or
   `--force`.
2. When the runner is active or the port is serving, follow its step 6, **Stop only an owned
   process**: every listener check, then `bun run ios:worktree:stop "<UDID>"`. If it says to ask the
   user to interrupt the runner in its terminal, do that and stop here.
3. Follow its step 7 for detach: `bun run ios:worktree:detach --dry-run`, then
   `bun run ios:worktree:detach`. If the request was only about disk space, first ask with
   **`AskUserQuestion`**: **Detach the simulator** or **Keep the assignment**.

Confirm with a fresh `bun run ios:worktree:list`: no runner and an idle port for this worktree, the
recorded UDID in the free pool when detached, and every other worktree's entry unchanged.

## 4. Offer permanent simulator removal

Offer it only for the UDID recorded in step 2, and only once a fresh list shows it in the free pool.
Follow the removal half of `worktree-ios` step 7 exactly. Its **`AskUserQuestion`** must name the
simulator name and UDID and state that the installed app and its data are erased, including any
signed-in session. Only after **Delete this simulator**:

```bash
bun run ios:worktree:remove "<UDID>" --yes
bun run ios:worktree:list
xcrun simctl list devices
```

Any other simulator in the free pool is not this worktree's. Leave it.

## 5. Choose what to delete

Ask once with **`AskUserQuestion`**, two multi-select questions in a single call, because the tool
caps a question at four options. Offer only groups that survived step 2, each labelled with its
measured size and exact paths. A question left with one group gets **Keep it** as its second option.

**Question 1: "Which build caches should be deleted?"** (header: `Caches`)

- **DerivedData (`<size>`)**: the next build is a full native rebuild.
- **Pods and iOS build (`<size>`)**: needs `pod install` from `apps/mobile/ios/`.
- **`node_modules` and `.expo` (`<size>`)**: type-check and lint cannot run until `bun install`.

**Question 2: "Which local state should be deleted?"** (header: `State`)

- **Copied env files**: name the files. `bun run env:sync` restores them from the primary worktree,
  and any local edit to a copy is lost. Never offer this in the primary worktree.
- **agent-device session state (`<size>`)**: logs and request history, for closed sessions only.

## 6. Delete in order

Run `bun run ios:worktree:list` again and stop if this worktree's runner is active or its port is
serving. Repeat step 2's checks on each selected path immediately before deleting it, then run one
command per path, with the literal absolute path:

```bash
rm -rf -- "<ABSOLUTE DIRECTORY>"
rm -- "<ABSOLUTE ENV FILE>"
```

Order: agent-device session state, DerivedData, `Pods` and `build`, env copies,
`apps/mobile/.expo`, then every `node_modules` last. Finish everything that runs through `bun` or
the worktree CLI first, and do not rely on those commands working once `node_modules` is gone.

Confirm each path is gone with `test -e`. A deletion that fails is reported, never retried with
broader flags.

## 7. Restore `Podfile.lock` only when the diff is noise

`pod install` in a fresh worktree can rewrite a checksum with no dependency change.

```bash
git status --short
git diff -- apps/mobile/ios/Podfile.lock
git diff --staged --stat -- apps/mobile/ios/Podfile.lock
```

The diff is noise only when all of these hold: the file is unstaged, every changed line is a
checksum value under `SPEC CHECKSUMS:`, no pod name or version changed, and no `package.json`,
`bun.lock`, or `apps/mobile/ios/Podfile` has an uncommitted change. Then ask with
**`AskUserQuestion`**: **Restore Podfile.lock** or **Keep the change**. On restore:

```bash
git restore -- apps/mobile/ios/Podfile.lock
```

Any other diff is a real dependency change or the user's work. `AGENTS.md` requires it to be
committed, so leave it and report it.

## 8. Report

- **Removed**: each path with the size measured before deletion, and the simulator name and UDID if
  one was deleted.
- **Left, and why**: unselected groups; other worktrees' simulators, Metro processes, and
  DerivedData; `docs/plans/`, which is gitignored local plan documents and not a cache; every other
  ignored path; uncommitted tracked changes, listed; the Git worktree and its branch.
- **Final `git status --short`** against the step 2 baseline. Any difference other than a restored
  `Podfile.lock` is reported as unexpected.
- **To use the worktree again**, naming only what applies:

```bash
bun install
bun run env:sync
pod install               # from apps/mobile/ios/
bun run ios:worktree
```

Never report a deletion or a released simulator that a fresh check did not confirm.

## Rules

- Never touch another worktree's simulator, Metro process, runner, or DerivedData.
- Never `--force` on the worktree CLI, never `kill`/`pkill`, never edit the worktree-devices
  registry, lock, or guard. A failed ownership check ends the run.
- Never `git clean`, `git stash`, `git checkout`, or `git reset`. `git restore` is for
  `apps/mobile/ios/Podfile.lock` under step 7 only.
- Never delete by wildcard or outside the verified candidate list. One literal absolute path per
  `rm`.
- Never read or print environment-file contents, process environments, or device-claim tokens.
- Never delete environment files in the primary worktree.
- Never run `git worktree remove` or `git worktree prune`, and never delete a branch.
- Do not run `bun install`, `env:sync`, or `pod install` afterwards. Setting the worktree up again
  is the `worktree-ios` skill's job.
- iOS only, Bun only.
