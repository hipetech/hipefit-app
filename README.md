# Hipefit

Hipefit is an iOS-only fitness app in a Bun workspace. The mobile app uses React Native, Expo SDK
57 in the bare workflow, Expo Router, `@expo/ui`, Zustand, Firebase Auth, and Firestore.

## Workspace layout

| Path           | Purpose                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `apps/mobile/` | Expo app, application source, assets, and native iOS project                 |
| `packages/`    | Shared schemas, Firebase bindings, UI, native modules, and developer tooling |
| `firebase/`    | Firebase configuration, rules, seed data, and migrations                     |
| `scripts/`     | Repository CLI wrappers and CI helpers                                       |
| `docs/`        | Current architecture, product flows, plans, and templates                    |
| `e2e/`         | Reserved empty scaffold for future end-to-end tests                          |

The root `package.json` owns workspace scripts. Run commands from the repository root unless a
document says otherwise.

## Setup

```bash
bun install
```

## Run iOS

Each command copies the matching root environment file into the mobile app and launches the
corresponding Xcode scheme:

```bash
bun run ios:development
bun run ios:staging
bun run ios:production
```

Start Metro without launching a simulator, or open the native project directly:

```bash
bun run start
bun run open:xcode
```

The committed project under `apps/mobile/ios/` is authoritative for native configuration. After
adding or removing a native dependency, update CocoaPods from that directory:

```bash
cd apps/mobile/ios
pod install
```

### Concurrent worktrees

`ios:development` always uses the default simulator and Metro port `8081`, so two Git worktrees
cannot run it at the same time. `ios:worktree` gives each worktree its own simulator and its own
Metro port:

```bash
bun run ios:worktree
bun run ios:worktree:detach
bun run ios:worktree:list
bun run ios:worktree:show
bun run ios:worktree:hide
bun run ios:worktree:stop
bun run ios:worktree:remove
```

These commands come from [`@hipefit/worktree-devices`](packages/worktree-devices/), which reads
`worktree-devices.json` in the repository root. That file names the app directory, the Xcode scheme,
and the bundle identifier, which the package cannot infer. Everything else has a default: the
development environment file, the local environment filename, the managed simulator name prefix, the
registry filename, the port range, and the ports left alone for other commands.

A fresh worktree first needs `bun install` and `pod install` from `apps/mobile/ios/`. Git does not
track the environment files, so [`env:sync`](scripts/env/sync.ts) copies them from the primary
worktree. It is a plain script rather than part of the package, because copying environment files
has nothing to do with simulators:

```bash
bun run env:sync
bun run env:sync --dry-run
bun run env:sync --force
```

It copies `.env.development`, `.env.staging`, and `.env.production`, keeps the files the worktree
already has unless `--force` replaces them, and reports any the primary worktree does not have. Run
in the primary worktree it changes nothing, because those files are the source. `ios:worktree` does
not copy anything between worktrees: it stops with an error naming the missing file, so run
`env:sync` first.

The first run in a worktree claims a released simulator from the managed pool, or creates one named
`Hipefit Worktree <n>` from an available iPhone device type and iOS runtime. It reserves a Metro
port between `18081` and `18180`, copies `.env.development` to `apps/mobile/.env.local`, boots the
simulator, points the app at the reserved port, and runs the `Hipefit-dev` scheme on it. Later runs
in the same worktree reuse the same simulator and port.

While it runs, `ios:worktree` records itself in the registry as the worktree's runner: its process
ID, the host, and the time it started. It removes that record when Expo exits or the command fails.
The record covers the native build, when nothing listens on the Metro port yet. `ios:worktree:list`
shows it, and `ios:worktree:detach` refuses to run while it is active. A runner that is killed
outright cannot remove its record. The record stops counting once that process is gone, and the next
`ios:worktree` or `ios:worktree:detach` that writes the registry drops it.

A later run can find its assigned port occupied. If another runner for the same worktree is still
active, the run keeps the port and warns, and Expo attaches to that dev server. Stop that runner if
the new run does not attach to it. Otherwise the run treats the listener as foreign: it reserves a
different port, saves it in the registry, warns with the old and the new port, and uses the new port
for both the app and Expo. When no port is free, the run fails before it boots the simulator or
starts Expo. A runner that was killed outright can leave its Expo process serving on the port. The
next run treats that process as foreign too and moves to a new port.

A run that becomes the worktree's runner writes the registry before anything boots. The write holds
its runner record, together with the assignment when that is new. If that write fails, the run stops
before it copies the environment file, boots the simulator, or starts Expo, and it reports the write
error. This applies to a worktree that already has an assignment as well. A simulator the run had
just created is deleted again, because the registry never recorded it. A simulator taken from the
pool is left alone and stays in the registry as free. If deleting the created simulator also fails,
the message carries both errors, the simulator's name and UDID, and the `xcrun simctl delete <UDID>`
command that removes it.

React Native compiles the default Metro port into its prebuilt core, so passing a port to Expo moves
the server without moving the app: the app would still look for `8081`, find nothing, and show a
redbox reporting no script URL. Each run writes `RCT_jsLocation` into the app's defaults on its
assigned simulator, which is the setting React Native's own Configure Bundler dev menu writes. The
app then loads from the port its worktree reserved.

`ios:worktree:stop` stops the Metro server a worktree reserved and leaves its simulator running.
It offers the simulators that have a reserved port and picks one the way `show` and `hide` do, by
name, UDID, or port number, or from a list. The list reports which ports are serving, so it is clear
what stopping will end.

`stop` inspects every process that listens on the port before it signals anything. It signals a
process only when it recognizes it as the Expo dev server of the worktree that owns the port. The
command line has to be `expo run:ios` with that worktree's simulator and port, and the process has
to run from that worktree's app directory or descend from its recorded runner. A process that
cannot be inspected is not recognized. A recognized process gets an interrupt first, so the runner
exits the way it would from the keyboard. `stop` waits up to 10 seconds, inspects the port again,
and kills only a process it interrupted that is still recognized. It reports success once the port
has stopped answering and fails otherwise.

`stop` never signals a listener it does not recognize. If it recognizes none, it fails and lists
each listener's process ID and command line with the reason. A Metro server that was started by
hand or by another tool and does not match is refused in the same way, so stop that one yourself.

When nothing serves on the port but the worktree's runner is still active, the app is still
building. `stop` says so and signals nothing. Interrupt the runner in its terminal.

```bash
bun run ios:worktree:stop
bun run ios:worktree:stop "Hipefit Worktree 2"
bun run ios:worktree:stop 18082
```

`ios:worktree:detach` shuts the simulator down and returns it to the pool for another worktree. It
refuses to run while this worktree's runner is active, whether or not the Metro port answers, which
covers a native build that has not started Metro. It also refuses while the assigned Metro port
accepts connections. Stop the runner first: interrupt it in its terminal, or run
`ios:worktree:stop` once Metro is serving. `--force` releases the assignment anyway, which is for a
port that an unrelated process holds. `--dry-run` reports that detach would refuse. Detach keeps the
device and its installed app, so nothing is erased until you delete the simulator yourself.

`--help` lists the commands and flags. `--dry-run` prints the worktree, simulator, port,
environment file, and Expo command without booting, building, or reserving anything; it works
before `bun install` and `pod install`, and reports whatever is still missing as a warning.
`--template` names the simulator whose device type and runtime a new managed simulator copies,
which helps when automatic selection picks the wrong iPhone.

```bash
bun run ios:worktree --help
bun run ios:worktree --dry-run
bun run ios:worktree --template <UDID>
bun run ios:worktree:detach --force
```

`ios:worktree:list` reports what every worktree currently holds: the simulator, its simulator state,
the reserved port, whether Metro is serving on it, and whether a runner is active. It also lists the
free pool and any
assignment whose worktree is gone. It only reads, so it is safe to run while another worktree is
starting.

`ios:worktree:show` opens a managed simulator in a window, booting it first if it is shut down.
Name the simulator, or run it bare to pick from a list of every managed simulator with its state and
owning worktree. `ios:worktree:hide` takes the same name or list and shuts that simulator down,
which closes its window. `--all` hides every window instead by closing Simulator, and there nothing
stops: the devices and their apps keep running.

```bash
bun run ios:worktree:show
bun run ios:worktree:show "Hipefit Worktree 2"
bun run ios:worktree:hide "Hipefit Worktree 2"
bun run ios:worktree:hide --all
```

The difference between the two forms of `hide` comes from Simulator itself. It draws a window for
every booted device, decides which windows to draw only when it starts, and shuts down every device
it draws when it quits normally. Closing one window therefore means stopping that device and
restarting Simulator, which the devices that are still booted survive. Closing every window instead
means ending Simulator without that shutdown, which is why nothing stops. Hiding one simulator keeps
its assignment, so running `ios:worktree` in the owning worktree starts it again.

`show`, `hide`, `stop`, and `remove` choose their simulator the same way. An argument names it: the
simulator's name, its UDID, or the Metro port assigned to it. Names and UDIDs match in any letter
case. A named target never prompts, and one that matches nothing the command offers fails with the
names it does offer.

Without an argument, the only default is the simulator this worktree holds, and only when the
command offers it. If it is the single simulator on offer, the command takes it. With several on
offer, a terminal shows the list, marks this worktree's simulator with `*`, and Enter takes it. A
piped or scripted call cannot read an answer, so it takes this worktree's simulator and prints which
one it took.

When this worktree holds none of the simulators on offer, there is no default. In a terminal the
command lists them and needs a number, even when the list has one entry. Enter selects nothing
there, and the command fails. A piped or scripted call fails and asks for a target. The commands do
not fall back to another worktree's simulator or to a free one.

Each command reads the simulator list, the worktree list, and the registry before it resolves the
target, and `stop` also probes every reserved port. Those steps only read.

`ios:worktree:remove` deletes a managed simulator for good, along with everything installed on it.
It offers the free pool by default, takes the same name or list as the other commands, and asks
before deleting. It refuses a simulator a worktree still holds, so detach that worktree first or
pass `--force`, which offers every managed simulator instead.

The free pool never contains this worktree's simulator, so `remove` without `--force` has no
default. In a terminal it lists the pool and needs a number. A script has to name the target or pass
`--all`. With `--force`, this worktree's simulator is the default when the worktree holds one.
`--yes` skips the question where no terminal can answer it, and without it a call that has no
terminal fails before deleting anything. `--force` changes which simulators are eligible. Neither
flag chooses a target. `--all` clears the whole free pool, and `--all --force` deletes every managed
simulator, assigned ones included.

The first form below needs a terminal:

```bash
bun run ios:worktree:remove
bun run ios:worktree:remove "Hipefit Worktree 2"
bun run ios:worktree:remove "Hipefit Worktree 2" --yes
bun run ios:worktree:remove --all --yes
```

`remove` attempts every selected simulator even after one fails. It prints
`Deleted <name> (<UDID>).` only for a simulator that is gone, then writes the registry once. Deleted
simulators and their assignments leave the registry, and a simulator whose deletion failed stays
managed. Any failed deletion makes the command exit unsuccessfully after it saves that partial
result, with a message listing the failures. Check those simulators in Simulator, then run the
command again.

If the registry write fails, nothing is saved and the registry keeps its previous contents. The
message names the registry file and lists the simulators that are already deleted but still
recorded. Those records are ignored when a command reads the registry, and the next command that
writes the registry drops them.

Assignments live in `hipefit-ios-worktrees.json` inside the repository's shared Git directory,
outside every worktree and outside version control. Every command reconciles that file against
`git worktree list` and `xcrun simctl list`, so entries for removed worktrees and deleted
simulators clear themselves. Deleting the file resets every assignment, but it also forgets the
pool: the simulators survive and keep whatever they had installed, yet nothing reuses them and the
next created one takes a higher number. `ios:worktree:remove` cannot reach those simulators either,
because the registry no longer knows them, so clearing up after such a reset stays manual:

```bash
xcrun simctl list devices | grep 'Hipefit Worktree'
xcrun simctl delete <UDID>
```

#### Registry lock recovery

`ios:worktree`, `ios:worktree:detach`, and `ios:worktree:remove` change the registry, and each holds
the registry lock while it does. The lock is a directory next to the registry file,
`hipefit-ios-worktrees.lock`, whose `owner.json` names the process and host that hold it. A second
directory, `hipefit-ios-worktrees.lock.guard`, is the transition guard. A command holds the guard
only while it takes, reclaims, or releases the lock. A lock being removed is first renamed to
`hipefit-ios-worktrees.lock.<pid>.<uuid>.stale`, and only that renamed directory is deleted.

A command waits up to 15 seconds for the lock, and a release waits up to 15 seconds of its own for
the guard. `remove` holds the lock while it waits at its list and at its confirmation question, so
`ios:worktree`, `detach`, and `remove` in other worktrees time out if those prompts stay unanswered.

A command that dies while it holds the lock needs no cleanup. The next command finds that the owning
process is gone on this host and reclaims the lock. A lock with missing or malformed owner metadata
is reclaimed once it is more than 60 seconds old. A lock owned by a running process on this host, or
by a valid owner on another host, is never reclaimed, however old it is.

Two timeouts need a person. A lock timeout names the lock directory and its holder. Wait for that
command to finish. Remove the lock directory only after confirming that the command that owns it has
exited, which is the only way to clear a lock left by another host.

A guard timeout means a command was killed partway through taking, reclaiming, or releasing the
lock. It leaves the guard behind, and nothing clears a guard automatically. The message names the
guard and any `.stale` directories. Before removing them, account for every command that shares
this registry: commands on other hosts, commands in older worktrees, and stopped processes that
could resume. The guard's age alone does not show that it is abandoned. Then remove only the guard
and the listed `.stale` directories and run the command again. The lock directory needs no manual
removal here, because the next command reclaims it by the rules above.

Do not delete the registry JSON file or a simulator to get past either timeout.

The lock excludes only commands that take the guard. Each worktree runs the package from its own
checkout, and a checkout whose copy does not take the guard can remove a lock another command has
just taken. Before running these commands in several worktrees at once, stop any command still
running from such a checkout and update every worktree that shares the registry.

## Checks

```bash
bun run type-check
bun run lint
bun run format:check
```

The repository has no automated test runner. Pull requests run these three checks in CI.

`@hipefit/worktree-devices` has five assertion scripts that run directly with Bun against temporary
fixtures. Its [README](packages/worktree-devices/README.md#assertion-scripts) lists them.

## Firebase tooling

Firebase assets live under `firebase/`. Root scripts keep environment selection explicit:

```bash
bun run db:seed --seed exercises --env development
bun run db:migrate --env development --dry-run
bun run db:wipe --env development
bun run firebase -- deploy --only firestore:rules --dry-run --project development
```

The Firebase deployment wrapper accepts only `development` and `staging`. It resolves that
environment to a fixed project ID, refuses production, and does not expose other Firebase CLI
commands.

Read [`docs/README.md`](docs/README.md) for the documentation index and feature workflow.
