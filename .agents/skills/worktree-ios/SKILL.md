---
name: worktree-ios
description: Manages Hipefit's per-worktree iOS workflow. Use when the user says "run iOS in this worktree", "set up the worktree simulator", "stop worktree Metro", or "detach the worktree simulator", or invokes "/worktree-ios"; not for app interaction or code implementation.
---

# Worktree iOS

Operate the existing `@hipefit/worktree-devices` commands without changing their implementation.

App interaction belongs to `agent-device`, planned code changes to `implement`, and commits to
`commit`. Do not edit source, native configuration, READMEs, or agent rules here.

## 1. Refuse unsafe actions

- Read `AGENTS.md`. Use iOS only and Bun only. Never substitute `ios:development` or standalone
  Metro for the per-worktree commands.
- Execute only the requested workflow. Inspection or setup is not permission to launch the app.
- Allow only one active runner per worktree. Check assignments and known terminal/background
  sessions before starting; do not launch a second runner to attach or bypass an occupied port.
  An idle port or absent runner record does not prove that no build or Expo process remains.
- Require a nonempty exact target for `show`, `hide`, `stop`, and `remove`. Prefer the full UDID
  from a fresh list. Reject blank, whitespace-only, ambiguous, and unmatched targets before calling
  the CLI. Never rely on its implicit target or terminal picker.
- Set the shell tool's working directory to the exact intended worktree root. `run` and `detach`
  target that worktree through the working directory, not a positional argument.
- Ask with **`AskUserQuestion`** (OpenCode: **`functions.question`**) when the action or target is
  unclear, and before acting on another worktree's resources. Offer selectable actions or targets.
- Never use `--force`, bulk deletion, ad hoc `kill`/`pkill`, or manual registry/lock/guard cleanup
  in this workflow. Do not treat recovery advice in command output as authorization.
- Do not read or print environment-file contents or process environments. Check filenames,
  existence, and accessibility only; redact secrets from logs before reporting them.

## 2. Inspect the worktree

Read the relevant paragraphs in [README.md#concurrent-worktrees](../../../README.md#concurrent-worktrees).
Keep that README and the [package README](../../../packages/worktree-devices/README.md) canonical;
read the package's relevant sections only when command details or failures need clarification.

Inspect root `package.json` and `worktree-devices.json`, then run from the intended worktree root:

```bash
bun run ios:worktree:list
bun run ios:worktree --dry-run
```

Record the worktree, simulator name and UDID, assigned port, runner state, and prerequisite warnings.
Treat a dry-run allocation as a preview, not a reservation. For inspection-only requests, stop here.

## 3. Set up missing prerequisites

Before environment synchronization, preview the copy without opening the files:

```bash
bun run env:sync --dry-run
```

If prerequisites are missing, ask with **`AskUserQuestion`** before any setup mutation. Offer
**Run the named setup steps**, **I'll set them up**, and **Cancel**. Name the commands, directories,
and environment filenames involved. Run only the approved missing steps:

```bash
bun install
bun run env:sync
```

Run CocoaPods only if approved, with the shell working directory set to `apps/mobile/ios/`:

```bash
pod install
```

Never force-overwrite environment files or install system tooling automatically. If the primary
worktree lacks a required environment file, ask the user to supply it securely.

Inspect `git status` before and after approved setup. Preserve existing changes and report new
lockfile changes without reverting or committing them. Re-run the startup dry-run; stop if required
prerequisites remain missing.

## 4. Start after launch intent

Re-run `list` immediately before launching. If a runner, build, or unexplained Expo/Metro process
already exists for this worktree, inspect it instead of launching again. On uncertainty, ask the
user to stop the existing session in its terminal first.

Explain that startup copies the configured environment file into the app, boots a simulator, and
builds/launches the app. After user launch intent, run the foreground command through a background
execution tool, not shell `&`:

```bash
bun run ios:worktree
```

Use **`Bash`** with `run_in_background: true` in Claude Code or **`functions.shell`** with
`background: true` in OpenCode. Record the returned session/job ID and the actual runner PID when
available; never treat a tool job ID as a PID. If background execution is unavailable, give the
command to the user rather than blocking the session.

Inspect launch output and a fresh `list`. Report the actual assignment and whether it is building,
serving, or failed. A listening port alone does not establish that the app launched successfully.

## 5. Show or hide windows

List first and substitute the selected full UDID for `<UDID>`; never execute placeholders:

```bash
bun run ios:worktree:show "<UDID>"
bun run ios:worktree:hide "<UDID>"
```

Run only the requested command. Explain that named `hide` shuts that simulator down but retains its
assignment and does not stop Metro. `show` may boot it.

If the user wants only to close windows while keeping devices running, explain that the available
command affects every Simulator window. Get explicit confirmation before:

```bash
bun run ios:worktree:hide --all
```

Do not interpret closing a window as permission to stop Metro, detach, or delete a simulator.

## 6. Stop only an owned process

List first. Read the package README's **Stopping Metro** section before attempting a stop.

Inspect every listener on the exact assigned port, substituting observed values:

```bash
lsof -nP -iTCP:<PORT> -sTCP:LISTEN
ps -ww -o pid=,ppid=,lstart=,command= -p <PID>
lsof -a -p <PID> -d cwd -Fn
```

Verify the actual executable and arguments, resolved project working directory, and process
identity against the owning worktree and recorded launch. Check parent processes when needed.
Do not accept a reserved port, reused PID, or command substring as ownership evidence.

If any listener is foreign, inspection is ambiguous, or a build has not started Metro, stop this
workflow and ask the user to interrupt the original runner in its terminal. Do not invent process
killing or promise that CLI matching establishes ownership.

Only after ownership is established and stop intent is clear, explain that the CLI may escalate
an interrupt to a forced kill if the process does not exit, then run:

```bash
bun run ios:worktree:stop "<UDID>"
```

Reinspect `list` and the known session/processes. Confirm runner exit as well as port release.
Report anything still active; do not assume stopping Metro stopped every build or child process.

## 7. Detach or permanently remove

For detach, confirm the exact owning worktree and assignment. Verify that its runner/build and
Expo processes have exited and its port is idle. Run from that worktree root:

```bash
bun run ios:worktree:detach --dry-run
```

If the preview refuses or ownership remains uncertain, stop. Otherwise, after detach intent:

```bash
bun run ios:worktree:detach
```

Explain that detach shuts down the simulator and returns it to the pool without erasing its app.

For permanent removal, list again and require the exact UDID to be in the free pool. Ask with
**`AskUserQuestion`**: **Delete this simulator**, naming its name and UDID and the loss of all
installed apps/data, or **Keep it**. Only after confirmation:

```bash
bun run ios:worktree:remove "<UDID>" --yes
```

`--yes` carries the user's confirmed deletion into a noninteractive call; it never replaces that
confirmation. `remove` has no dry-run. Do not remove assigned simulators or Git worktrees here.

## 8. Troubleshoot without repair mutations

Capture the failing command, exit status, and redacted error. Read the corresponding README
section, then inspect relevant package source read-only if behavior is unclear:

```bash
bun run ios:worktree --help
bun run ios:worktree:list
bun run ios:worktree --dry-run
```

Use `bun run env:sync --dry-run` for missing environment files. For occupied ports or process
uncertainty, follow step 6. For lock/guard timeouts, read the canonical recovery sections and
account for commands in other worktrees/hosts; do not clear shared coordination state.

Do not patch the CLI, change native files, reset assignments, or run assertion scripts as an
operational repair. Report the blocker and propose a separate code task when needed.

Finish with the action taken, exact worktree/UDID/port, background session and runner PID when
known, observed remaining processes, and any blocked or unverified outcome.
