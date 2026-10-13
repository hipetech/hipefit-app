# `@hipefit/worktree-devices`

Private CLI that gives every Git worktree its own iOS simulator and its own Metro port, so several
worktrees can run the app at the same time.

`expo run:ios` always picks the same simulator and port `8081`. A second worktree that runs it takes
over the first worktree's simulator and fails on the port. This package keeps a registry of managed
simulators and reserved ports next to the shared Git directory, hands each worktree a pair of its
own, and returns them to a pool when the worktree is done.

## Requirements

- macOS with Xcode installed; the package drives `xcrun simctl` and Simulator directly
- Bun, run from inside a Git worktree
- `ps`, which `run`, `detach`, `list`, and `stop` use, and `lsof`, which `stop` uses
- An Expo bare workflow iOS project and a `worktree-devices.json` in the repository root

## Package layout

```text
worktree-devices/
├── scripts/      assertion scripts, run directly with Bun
└── src/
    ├── cli.ts        argument dispatch and the single entry point
    ├── options.ts    argument parsing and the help text
    ├── config.ts     worktree-devices.json reading, defaults, and validation
    ├── types.ts      shared contracts and the registry version
    ├── index.ts      public exports, config only
    ├── core/         the shared vocabulary every subcommand builds on
    │   ├── context.ts        worktree paths derived from Git and the config
    │   ├── registry.ts       shared state: decode, reconcile, replace by rename
    │   ├── lock.ts           the registry lock and its transition guard
    │   ├── runner.ts         the runner lease: take, release, and liveness
    │   ├── listeners.ts      who listens on a port, and whether it is a worktree's Expo
    │   ├── inventory.ts      one `simctl list` parsed into devices, types, runtimes
    │   ├── devices.ts        create, boot, shut down, delete, point at Metro
    │   ├── ports.ts          allocation by binding, liveness by connecting
    │   ├── selector.ts       target matching, the picker, and the confirmation prompt
    │   ├── expo.ts           prerequisites, argument building, launching Expo
    │   └── simulator-app.ts  starting and ending Simulator itself
    ├── commands/     one file per subcommand, nothing shared between them
    └── lib/          small helpers with no knowledge of this tool
```

Add a subcommand as its own file under `commands/` rather than growing an existing one. Anything two
subcommands both need belongs in `core/`.

## Commands

The repository wraps each subcommand in a root script, which is how they are meant to be run:
`ios:worktree`, and `ios:worktree:` plus `detach`, `list`, `show`, `hide`, `stop`, or `remove`.

| Subcommand | What it does                                                               |
| ---------- | -------------------------------------------------------------------------- |
| `run`      | Reuses or allocates a simulator and port, then runs Expo on them           |
| `detach`   | Shuts this worktree's simulator down and returns it to the pool            |
| `list`     | Reports every assignment with its runner, the free pool, and stale entries |
| `show`     | Opens a managed simulator in a window, booting it if needed                |
| `hide`     | Shuts one simulator down, or with `--all` closes every window              |
| `stop`     | Stops the Expo dev server on a worktree's reserved port                    |
| `remove`   | Deletes a managed simulator and everything installed on it                 |

The root [README](../../README.md) covers the flags and the day to day workflow; `--help` lists
them too.

## Choosing a target

`show`, `hide`, `stop`, and `remove` resolve one simulator from the candidates the command offers:

| Command          | Candidates                       |
| ---------------- | -------------------------------- |
| `show`, `hide`   | Every managed simulator          |
| `stop`           | Simulators with an assigned port |
| `remove`         | The free pool                    |
| `remove --force` | Every managed simulator          |

An explicit target is a simulator name, a UDID, or the Metro port assigned to a candidate. It is
trimmed, names and UDIDs match in any letter case, and a port matches only the exact assigned
number. An explicit target never prompts. One that matches no candidate fails with
`No managed simulator named "<target>". Known: ...`.

Without a target, the only default is the simulator this worktree holds:

| Candidates                              | In a terminal                                   | Without a terminal                         |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| Only this worktree's simulator          | Takes it, no prompt                             | Takes it                                   |
| Several, including this worktree's      | Lists them with `*` on that row; Enter takes it | Takes it and prints `Defaulting to <name>` |
| One or more, none held by this worktree | Lists them and needs a number; Enter fails      | Fails and asks for a target                |

The picker asks once. A blank answer with no default, or an answer outside the listed numbers, fails
the command. The commands do not fall back to another worktree's simulator or to a free one.

The free pool never holds this worktree's simulator, so `remove` without `--force` has no default: a
scripted call needs a target or `--all`. `--yes` skips the delete confirmation, and without it a
call with no terminal fails before deleting. `--force` changes which simulators are candidates.
Neither picks a target. `hide --all`, `remove --all`, and `remove --all --force` skip target
resolution: the first closes Simulator, the second takes the whole free pool, and the third takes
every managed simulator.

Each command lists simulators and worktrees and reads the registry before it resolves the target,
and `stop` also probes every assigned port. Those steps only read.

## Deletion and write failures

`simctl delete` fails on a spawn error, a nonzero exit, or death by signal, and the failure carries
the UDID as `Could not delete <udid>: ...`.

`remove` attempts every selected simulator even after one fails. Shutting a booted simulator down
first is best effort: a failed shutdown prints a warning and the deletion still runs.
`Deleted <name> (<udid>).` prints only after a successful delete. The registry is written once,
after every attempt, and drops only the deleted simulators and their assignments. A simulator whose
deletion failed stays managed, including one on an unavailable runtime. If any deletion failed, the
command exits unsuccessfully after saving that partial result and lists the failures.

If the registry write fails, `remove` exits unsuccessfully and nothing is saved: the registry file
keeps its previous contents. The message names the registry file and lists the simulators that are
already deleted but still recorded. Reconciliation ignores those records on every read, and the
next command that writes the registry drops them.

`run` writes a new assignment, with its runner lease, before it boots anything. If that write fails,
`run` stops before the environment copy, the boot, and the Expo launch, and reports the write error:

- A simulator reused from the pool is never deleted. It predates the run and the registry that was
  just read still lists it.
- A simulator this run created is deleted, because no registry records it.
- If that cleanup also fails, the message carries the write error, the cleanup error, and the
  surviving simulator's name and UDID with the `xcrun simctl delete <udid>` command that removes it.

A `run` in a worktree that already has an assignment has to save its runner lease, and a port it
moved to. If that write fails, the run fails at the same point, before the environment copy, the
boot, and the Expo launch.

## Configuration

`worktree-devices.json` in the repository root holds everything specific to the app. The package
reads it and never hardcodes a scheme, an identifier, or a path.

| Key                    | Required | Default            | Meaning                                          |
| ---------------------- | -------- | ------------------ | ------------------------------------------------ |
| `appDirectory`         | yes      |                    | The app, relative to the repository root         |
| `scheme`               | yes      |                    | The Xcode scheme Expo builds                     |
| `bundleIdentifier`     | yes      |                    | The installed app, used to point it at Metro     |
| `environmentFile`      | no       | `.env.development` | Environment file in the worktree root            |
| `environmentLocalName` | no       | `.env.local`       | What the app directory expects it copied to      |
| `simulatorNamePrefix`  | no       | `Worktree`         | Managed simulators are `<prefix> <n>`            |
| `registryName`         | no       | `worktree-devices` | Basename of the registry file and its lock       |
| `ports`                | no       | `18081` to `18180` | Range Metro ports are allocated from             |
| `reservedPorts`        | no       | `[8081]`           | Ports left to commands that do not use this tool |

Changing `registryName` orphans the existing assignments, because the registry is found by that name.

## Shared state

`git rev-parse --path-format=absolute --git-common-dir` resolves to one directory that every worktree
of the repository shares, and the registry lives there as `<registryName>.json`. Git does not track
it, and it is not inside any worktree, so no worktree can hide or commit another worktree's state.

`run`, `detach`, and `remove` hold the registry lock for their whole registry action. `run` takes
the lock a second time when it ends, to release its runner lease. `remove` resolves its target and
asks its confirmation inside that action, so the lock stays held while its prompts wait. `list`,
`show`, `hide`, and `stop` read the registry without the lock and do not write it.

The state itself is written to a temporary file in the same directory and renamed over the old one,
so a failed write leaves the previous registry file in place. That replacement is not flushed to
disk and makes no promise about power loss.

### The lock and its transition guard

The registry lock is the directory `<registryName>.lock`, whose `owner.json` holds the owner's pid,
hostname, creation time, and a token. The transition guard is the sibling directory
`<registryName>.lock.guard`, taken with an atomic `mkdir`.

Every change to the lock directory happens under the guard: creating it, publishing its owner,
reclaiming a stale one, releasing it, and cleaning up a failed acquisition. The lock is observed
afresh inside the guard, so a command never acts on a verdict it reached before it held the guard.
The guard is held only for those transitions, never during the registry action, a prompt, or a
retry sleep.

A lock being removed is first renamed to `<registryName>.lock.<pid>.<uuid>.stale`, the renamed
directory is checked against the one that was inspected, and only that path is deleted. The rename
keeps a recursive delete away from the shared pathname. It does not exclude anything by itself: the
guard does.

Release runs once. It removes the lock only when the directory is the one this command created and
its token matches, and otherwise leaves it alone.

### Owner policies

| Lock state                                              | Treatment                                       |
| ------------------------------------------------------- | ----------------------------------------------- |
| Valid owner, this host, process running                 | Held, whatever its age                          |
| Valid owner, this host, process exists under other user | Held                                            |
| Valid owner, another host                               | Held, whatever its age; the pid is never probed |
| Valid owner, this host, process gone                    | Reclaimed                                       |
| Missing or malformed metadata, up to 60 seconds old     | Held                                            |
| Missing or malformed metadata, more than 60 seconds old | Reclaimed                                       |
| Symbolic link or non-directory at the lock path         | The command fails and removes nothing           |
| Process probe fails for any other reason                | The command fails and removes nothing           |

An owner record whose pid is not a positive integer counts as malformed and is never probed.

### Timeouts and recovery

Acquisition has one 15-second deadline that covers guard waits and every retry, with 100 ms between
attempts. Release waits on the guard with a separate 15-second deadline.

A command that dies inside its registry action leaves no guard, and the next command reclaims the
dead owner's lock. A command that dies inside a transition leaves the guard. The guard is never
reclaimed automatically, because reclaiming it would need the same stale check the guard exists to
make safe. Other commands then time out after 15 seconds with a message that names the guard path,
its recorded owner, and any `.stale` directories.

To recover from an abandoned guard:

1. Account for every command that shares the registry, including commands on other hosts, commands
   in older worktrees, and stopped processes that could resume. The guard's age alone does not show
   that it is abandoned.
2. Remove only the guard directory and the `.stale` directories the message lists.
3. Leave the lock directory, the registry JSON file, and the simulators as they are. With the guard
   gone, the next command reclaims the lock by the owner policies above.
4. Run the command again.

A lock timeout is a different message. It names the lock directory and its holder, and the lock is
held by a running command or by another host. Wait for that command, or remove the lock directory
only after confirming that the command that owns it has exited. The registry JSON file and the
simulators stay as they are in that case too.

### Mixed versions

Exclusion holds only among commands that take the guard. Each worktree runs this package from its
own checkout, and a copy that does not take the guard can remove a lock another command has just
taken. Stop any command still running from such a checkout and update every worktree that shares
the registry before running commands concurrently. The registry schema, the configuration, and the
dependencies are the same for every copy.

Every read reconciles the registry against reality before using it. Simulators the user deleted in
Xcode disappear from the pool, and assignments whose worktree was removed with `git worktree remove`
release their simulator and port. Reconciling is why nothing has to be cleaned up by hand after a
worktree is deleted.

### Runner lease

An assignment records the worktree, the simulator UDID, and the Metro port. While a `run` command is
using it, it also carries a runner lease, `runner: { pid, hostname, startedAt }`. The field is
optional, and the registry version is the same with or without it. `pid` is the `run` command's own
process, which is the parent of the Expo process. A lease that does not decode is dropped on read
and does not make the registry unreadable.

`run` records the lease in the locked write that allocates the assignment, so a new assignment is
never on disk without one. The lease covers the native build, when nothing listens on the Metro
port. `run` removes its own lease under the lock when Expo exits, and when the command fails after
that write. If the removal fails, `run` prints a warning. A runner that is killed outright cannot
release its lease, which stops counting once the process is gone.

| Lease                                                                       | Treatment                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------- |
| Recorded on another host                                                    | Live, whatever its age; the pid is never probed |
| This host, process gone                                                     | Dead                                            |
| This host, process exists and started more than 5 seconds after `startedAt` | Dead, as a reused pid                           |
| This host, process exists and started earlier than that                     | Live                                            |
| This host, process exists, `ps` cannot report its start time                | Live                                            |

The start time comes from `ps -o lstart= -p <pid>`, run in the C locale. A probe that fails for any
reason other than a missing process counts as the process existing, because dropping a lease is
what lets another worktree take the simulator.

`run` and `detach` drop dead leases from the state they are about to write. `list` and `stop` judge
a lease without changing the registry. A second `run` in a worktree whose lease is live leaves that
lease in place, takes none of its own, and releases nothing when it exits.

`detach` refuses without `--force` while this worktree's lease is live, whether or not the Metro
port answers. `detach --dry-run` reports that it would refuse. `list` prints a `Runner:` line for
every assignment, either `active` with the pid, host, and start time, or `none`.

## Ports

Availability and liveness are different questions, so they use different probes. Allocation asks
whether a port can be bound, on `::`, `0.0.0.0`, `127.0.0.1`, and `::1` in turn, because Metro binds
to loopback and a loopback listener does not stop a wildcard bind. Liveness asks whether a connection
to `127.0.0.1` or `::1` is accepted within 250ms. `list` reports that as serving, `detach` refuses
to run against it without `--force`, and `stop` uses it to decide whether there is anything to stop
and whether stopping worked.

### Port synchronization

Expo offers another port when the one it was given is taken, and nothing would carry that choice
back to the registry or to `RCT_jsLocation`. `run` therefore settles the port under the registry
lock, in the write that saves its lease, and only then starts Expo. A new assignment gets a port
that can be bound. For an existing assignment whose port cannot be bound:

- If another live runner holds this worktree's lease, the run keeps the port and warns. Expo
  attaches to that runner's dev server.
- Otherwise the listener is foreign. The run allocates a different port, saves it in the registry,
  warns with the occupied port and the new one, and uses the new port for `RCT_jsLocation` and for
  Expo's `--port`.
- If no port is free, the run fails before it boots the simulator or launches Expo, and leaves no
  lease.

A runner that is killed outright can leave its Expo process serving on the port. Its lease is dead
by then, so the next run treats that listener as foreign and moves to a new port.

## Stopping Metro

A reserved port proves nothing about who listens on it, so `stop` signals a listener only after it
recognizes it as the Expo dev server of the worktree that owns the assignment. With a named target
that can be another worktree than the one the command runs in.

`stop` first asks whether the port accepts connections. If it does not, it prints
`Nothing is serving on port <port>.` and signals nothing. When the assignment's runner is live at
that point, the app is still building, and `stop` adds that the runner has not started Metro and
should be interrupted in its terminal.

Otherwise it lists the listeners with `lsof -ti tcp:<port> -sTCP:LISTEN` and reads each one's
command line and parent with `ps` and its working directory with `lsof`. A listener is recognized
when both of these hold:

- Its command line runs `expo run:ios` with the assignment's `--device <udid>` and `--port <port>`,
  the arguments `run` passes to Expo.
- Its working directory resolves to that worktree's app directory, or the process is the recorded
  runner or one of its descendants. Only a lease recorded on this host can stand in for the
  directory.

The lease never replaces the command line check, so a reused runner pid cannot make an unrelated
process recognized. Anything that cannot be read, or reads ambiguously, is not recognized.

| Listeners on the port               | What `stop` does                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| None found, though the port answers | Fails and signals nothing                                                       |
| None recognized                     | Fails, signals nothing, and lists each pid with its command line and the reason |
| At least one recognized             | Interrupts the recognized ones and leaves the others alone                      |

After the interrupt, `stop` waits up to 10 seconds for the port to stop answering. If it still
answers, `stop` inspects the listeners again and kills only the processes it interrupted that are
still recognized, then waits up to 3 more seconds. It reports success only once the port has
stopped answering, and names any unrecognized listener it left alone. If the port still answers, the
command fails with what it signalled and what holds the port.

A listener that is not recognized is never interrupted or killed. Metro started by hand or by
another tool on an assigned port that does not match these checks is refused by design.

## Pointing the app at its port

React Native ships a prebuilt `React.xcframework` with the default Metro port compiled into it, so
`expo run:ios --port` moves the server without moving the app. The app still looks for `8081`, finds
nothing there, and shows a redbox reporting no script URL.

Each run writes `RCT_jsLocation` into the app's defaults on its own simulator, which is the setting
React Native's own Configure Bundler dev menu writes. It is written before Expo installs and
launches the app, so it survives a fresh install and the app loads from the port its worktree
reserved.

## Simulator windows

Simulator draws one window per booted device, decides which windows to draw only when it starts, and
shuts down every device it draws when it quits normally. There is no per window control, so `hide`
with a name shuts that device down and restarts Simulator to clear the window the powered off device
would otherwise keep. `hide --all` instead ends Simulator without that normal quit, which leaves
every device and every running app alive with no windows on screen.

Hiding a simulator keeps its assignment. `run` in the owning worktree starts it again.

## Assertion scripts

The package has no test runner and no package scripts. Five assertion scripts under `scripts/`
run directly with Bun from the repository root:

```bash
bun run packages/worktree-devices/scripts/verify-startup-deletion.ts
bun run packages/worktree-devices/scripts/verify-lock.ts
bun run packages/worktree-devices/scripts/verify-selection.ts
bun run packages/worktree-devices/scripts/verify-runner-lease.ts
bun run packages/worktree-devices/scripts/verify-stop.ts
```

Each prints one line per case and exits nonzero if any case fails. None of them reaches Xcode, a
simulator, the Simulator application, or the shared registry.

[`verify-startup-deletion.ts`](scripts/verify-startup-deletion.ts) covers startup, `deleteSimulator`
failures, `remove` batches, registry write failures, and allocation rollback. Every case runs the
unmodified modules in a child process whose `PATH` holds only fake `xcrun`, `git`, and `pod`
programs written into a temporary fixture. The fakes accept exact argument shapes and exit with an
error on anything else. A registry write is made to fail by making the fixture's registry directory
read only.

[`verify-lock.ts`](scripts/verify-lock.ts) covers the lock and its guard: owner policies, deadlines,
contention between child processes, crashes inside and outside a transition, and failure messages.
Every lock, guard, and registry path lives under one temporary directory, and the only processes it
signals are its own children. Each line says what the case relies on: the unmodified module, the
unmodified module in a child whose `process.kill` is replaced, or an instrumented copy of `lock.ts`
written into the temporary directory. The copy differs only in importing `node:fs/promises` through
a wrapper that can pause at a checkpoint, report a call, or fail one.

[`verify-selection.ts`](scripts/verify-selection.ts) covers target resolution in `show`, `hide`,
`stop`, and `remove`, plus the help text. Every case runs the unmodified modules in a child process
whose `PATH` holds only fake `xcrun`, `git`, `pgrep`, `pkill`, `open`, `lsof`, and `ps` programs.
The fake `lsof` prints only the pid of a listener the script started, so `stop` can signal nothing
else. For that pid the fake `lsof` and `ps` describe the Expo process of the worktree the port is
assigned to, which is what `stop` requires before it signals. Interactive cases mark a piped stdin
as a terminal and write each answer after the prompt appears. That exercises the readline question,
but not key handling in a real terminal, which stays a manual check.

[`verify-runner-lease.ts`](scripts/verify-runner-lease.ts) covers the runner lease and port
synchronization: when `run` takes and releases the lease, `detach` during a build, dead leases,
reused pids, a second run in one worktree, a foreign listener on the assigned port, and how the
registry decodes a lease. Every command runs the unmodified modules in a child process whose `PATH`
holds only fake `xcrun`, `git`, `pod`, and `ps` programs. The fake Expo can stay running until the
script releases it, which stands in for a native build. The script signals only children it
started, and the only listeners on its fixture ports are loopback servers it opened.

[`verify-stop.ts`](scripts/verify-stop.ts) covers what `stop` signals and what it refuses to signal:
recognized and unrecognized listeners, inspection failures, listeners that change during the wait,
the kill after an ignored interrupt, the runner lease standing in for the working directory, and a
named target in another worktree. Every case runs the unmodified `stop` command in a child process
whose `PATH` holds only fake `xcrun`, `git`, `lsof`, and `ps` programs. The fake `lsof` and `ps`
answer only about processes the script started. For those they either run the real tool or return
what the case dictates, and they report any other pid as missing. Fixture listeners are loopback
servers, and each records an interrupt in a marker file, which is how a case shows that a process
`stop` had to leave alone received no signal. The script takes about a minute, because two cases
wait out the 10-second interrupt period.

## What this package does not do

Copying environment files between worktrees is not its concern and lives in
[`scripts/env/sync.ts`](../../scripts/env/sync.ts). `run` copies the environment file into the app
directory because the build needs it, but a missing file is an error naming `env:sync`, not
something it fetches. Installing dependencies and running `pod install` in a new worktree are also
left to the user; `--dry-run` reports whichever of them is still outstanding.
