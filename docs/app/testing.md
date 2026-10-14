---
type: app
status: current
area: testing
updated: 2026-10-13
---

# Testing

Hipefit has one automated suite: five [Maestro](https://docs.maestro.dev) end-to-end flows under
[`e2e/`](../../e2e) that drive the development build on an iOS Simulator. A person runs them with
`bun run e2e`. Agents do not run them, and CI does not either. There is no unit test runner, so
`bun run type-check` stays the primary code gate, with `bun run lint` and `bun run format:check`
beside it.

Maestro is a system binary, not a workspace dependency. Install it separately and check that
`maestro --version` works in the shell that runs the suite.

## Commands

| Command              | What it does                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `bun run e2e`        | Loads `e2e/.env` when it exists, runs the preflight checks, then runs every flow in the workspace on one simulator |
| `bun run e2e:studio` | Runs `maestro studio`, Maestro's tool for inspecting the running app and trying selectors against it               |

Both scripts are declared in the root [`package.json`](../../package.json). `e2e` starts
[`scripts/e2e/run.ts`](../../scripts/e2e/run.ts) through Bun's `--env-file=e2e/.env`. `e2e:studio`
calls Maestro directly: it runs no preflight check and does not load `e2e/.env`.

After the preflight checks the runner prints the simulator it chose and runs
`maestro --device <UDID> test e2e --test-output-dir e2e/output` from the repository root. It exits
with Maestro's exit status. Maestro's artifacts land in `e2e/output/`, which is gitignored.

Arguments after the script name pass through to `maestro test`. An argument that names an existing
file or folder replaces the default `e2e` target, so this runs one flow:

```bash
bun run e2e e2e/flows/sign-out.yaml
```

Any other argument is appended after the target. Every flow carries the `smoke` tag, so
`--include-tags smoke` currently selects all of them.

`maestro check-syntax <flow file>` checks one flow file without the runner.

## Prerequisites

1. **A booted simulator with the development build.** `bun run ios:development` builds and installs
   `com.kyrylokorota.hipefitapp.development` and starts Metro. In a Git worktree,
   `bun run ios:worktree` does the same on that worktree's own simulator and Metro port. The flows
   declare that bundle identifier, so they run against the development build only.
2. **Metro, for a Debug build.** A Debug build cannot load its bundle without Metro. A Release
   build runs without it.
3. **The Anonymous provider on `hipefit-app-dev`.** The flows sign in with Quick Login, which needs
   that provider. [`../flows/authentication.md`](../flows/authentication.md) lists it among the
   sign-in prerequisites.

The suite needs no credentials. [`e2e/.env.example`](../../e2e/.env.example) documents two optional
keys; copy it to the gitignored `e2e/.env` to set them, or set them in the shell:

- `E2E_DEVICE` is the UDID of the simulator to test. It is required when more than one simulator is
  booted.
- `RCT_METRO_PORT` is the port the Metro preflight check probes. It defaults to `8081`. Nothing in
  the repository sets it. A worktree run serves Metro on its own reserved port, which the run
  prints and `bun run ios:worktree:list` shows.

The suite runs against the live development Firebase project. Each sign-in creates a new
anonymous account and its `users/{uid}` document there, and every flow except
`launch-shows-login.yaml` signs in once.

## Preflight checks

[`scripts/e2e/run.ts`](../../scripts/e2e/run.ts) runs four checks in order before it starts
Maestro. The first three stop the run with exit status 1 and one message. The fourth only warns.

| Check | Condition                                                                                  | Message                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `maestro --version` runs                                                                   | `Preflight 1 of 4 failed: the Maestro CLI did not run.` It links the install guide.                                                                   |
| 2     | `xcrun simctl list devices booted -j` runs and its output parses                           | `Preflight 2 of 4 failed`, naming the command that did not run or the parse error.                                                                    |
| 2     | At least one simulator is booted                                                           | `Preflight 2 of 4 failed: no iOS Simulator is booted.`                                                                                                |
| 2     | `E2E_DEVICE`, when set, is the UDID of a booted simulator                                  | `Preflight 2 of 4 failed: E2E_DEVICE names <UDID>, which is not a booted simulator.` It lists the booted simulators.                                  |
| 2     | Exactly one simulator is booted, when `E2E_DEVICE` is unset                                | `Preflight 2 of 4 failed: <n> simulators are booted. Set E2E_DEVICE to the UDID of the one to test`. It lists the booted simulators with their UDIDs. |
| 3     | `xcrun simctl get_app_container` finds the development bundle identifier on that simulator | `Preflight 3 of 4 failed: the development build (com.kyrylokorota.hipefitapp.development) is not installed on <name> (<UDID>).`                       |
| 4     | `http://localhost:<port>/status` answers `packager-status:running` within two seconds      | `Preflight 4 of 4 warning: Metro did not answer on port <port>.` The run continues.                                                                   |

Check 2 never picks among several booted simulators. Every flow clears the app's state and the
simulator keychain, so a run must not land on a simulator it was not aimed at, and several
simulators are booted whenever worktrees run side by side. The runner checks the development build
on the chosen simulator and passes the same UDID to Maestro with `--device`.

## Sign-in

Maestro cannot drive Apple's system sheet, which is outside the app, so the flows sign in with
Quick Login. The login screen shows that button only when the configured Firebase project is the
development or staging project, and the auth service refuses the call for any other project. The
gate and the journey are described in [`../flows/authentication.md`](../flows/authentication.md).

Quick Login takes no input, so the suite holds no credentials. The account it creates is new on
every sign-in: its profile is named `Quick User`, and it has no workouts, which is why
`tabs.yaml` can assert the empty-history text.

## Selectors

Identifiers are kebab-case. A SwiftUI control gets one through the `accessibilityIdentifier`
modifier. A React Native view, a `NativeTabs.Trigger` tab item, and a universal `@expo/ui` `Button` get one
through `testID`. Flows
select both kinds with Maestro's `id:`. The modifier, and the other accessibility rules for SwiftUI
trees, are covered in [Hit testing and accessibility](ui.md#hit-testing-and-accessibility).

| Identifier                                                  | Element                                 | Set in                                                                                      |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `sign-in-apple`                                             | `AppleAuthenticationButton` (`testID`)  | [`features/auth/index.tsx`](../../apps/mobile/src/features/auth/index.tsx)                  |
| `quick-login`                                               | Quick Login `Button` (`testID`)         | [`quick-login-button.tsx`](../../apps/mobile/src/features/auth/quick-login-button.tsx)      |
| `tab-home`, `tab-workouts`, `tab-exercises`, `tab-settings` | `NativeTabs.Trigger` items (`testID`)   | [`app/(private)/_layout.tsx`](<../../apps/mobile/app/(private)/_layout.tsx>)                |
| `settings-log-out`                                          | Log Out trigger `Button`                | [`settings-content.tsx`](../../apps/mobile/src/features/settings/settings-content.tsx)      |
| `weekly-calendar`                                           | Calendar container (`CALENDAR_TEST_ID`) | [`calendar/helpers/metrics.ts`](../../apps/mobile/src/features/calendar/helpers/metrics.ts) |

The flows also match visible text and accessibility labels that are literals in source:
`Not Logged In` on the login screen, the Home section title `Activity`, `No workouts yet` on
Workouts, the screen title `Exercises`, the calendar toggle's labels `Show month` and `Show week`,
the alert title `Log Out?`, and the alert action `Log Out`. Changing one of these strings changes a
flow.

The current flows make three selector choices that a new flow should follow:

- **Tabs are tapped by identifier.** Home renders a row titled `Workouts` inside Activity, so
  `tapOn: Workouts` would be ambiguous.
- **The Log Out alert action is tapped by text, scoped by position.** The action has the same label
  as the trigger behind the alert, so
  [`sign-out.yaml`](../../e2e/flows/sign-out.yaml) uses `tapOn` with `text: Log Out` and
  `below: You will be signed out.*`, which limits the match to the element below the alert message.
  Maestro matches text as a full regular expression, which is why the message selector ends in
  `.*`.
- **Close inside the create panel must be tapped by coordinate.** While the panel is open the tab
  bar is hidden from accessibility, so an accessibility-driven driver cannot find `Close`. See
  [The panel is a native overlay](navigation.md#the-panel-is-a-native-overlay). No current flow
  opens the panel.

## Workspace

[`e2e/config.yaml`](../../e2e/config.yaml) lists `flows/*.yaml`, so only the files under
[`e2e/flows/`](../../e2e/flows) run when the workspace folder is the target.
[`e2e/subflows/`](../../e2e/subflows) is reached through `runFlow` and never runs on its own.

Every flow is self-contained. It starts with `launchApp` using `clearState: true` and
`clearKeychain: true`, because Firebase Auth keeps its session in the keychain and `clearState`
alone would relaunch the app signed in.

[`sign-in-quick-login.yaml`](../../e2e/subflows/sign-in-quick-login.yaml) holds the shared sign-in
steps. It taps `quick-login` and waits up to 20 seconds for `Activity`. The wait is longer than
Maestro's default because sign-in finishes the profile ensure and the first Firestore read before
Home mounts.

| Flow                                                                 | Steps after the clean launch                                                                                        | What it checks                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`launch-shows-login.yaml`](../../e2e/flows/launch-shows-login.yaml) | Asserts `Not Logged In`, `sign-in-apple`, and `quick-login`                                                         | A signed-out launch shows the login screen and both paths |
| [`sign-in.yaml`](../../e2e/flows/sign-in.yaml)                       | Signs in, then asserts `Activity` and `weekly-calendar`                                                             | Quick Login signs in and lands on Home                    |
| [`tabs.yaml`](../../e2e/flows/tabs.yaml)                             | Signs in, then taps each tab and asserts `No workouts yet`, `Exercises`, `settings-log-out`, and `Activity` in turn | Each of the four tabs opens                               |
| [`calendar-toggle.yaml`](../../e2e/flows/calendar-toggle.yaml)       | Signs in, taps `Show month`, asserts `Show week`, taps it, asserts `Show month`                                     | The Home calendar expands to the month and collapses      |
| [`sign-out.yaml`](../../e2e/flows/sign-out.yaml)                     | Signs in, opens Settings, taps `settings-log-out`, asserts `Log Out?`, confirms, asserts `Not Logged In`            | Log Out returns to the login screen                       |

## Adding a flow

A journey that starts shipping gets a flow in the same change as its flow document under
[`docs/flows/`](../flows). The flow is written before the code it drives: a plan fixes the
identifiers and text anchors first, and its flows task runs in the first wave, as the feature
lifecycle in [`../README.md`](../README.md) describes. The journeys that do not ship have none: start workout, log workout,
create routine, and the create panel's actions.

A new flow goes in `e2e/flows/`, carries the `smoke` tag, starts with the same clean `launchApp`,
and calls the sign-in subflow when it needs the protected tabs. Give a new control an identifier
from the convention above, in the same change, and add it to the table in this document.

## Limits

- **No CI.** [`ci.yml`](../../.github/workflows/ci.yml) runs type-check, lint, and the format check
  on Ubuntu, where no iOS Simulator exists. The suite runs only when a person starts it.
- **No emulators.** [`firebase.json`](../../firebase/firebase.json) has no `emulators` block. The
  flows sign in to `hipefit-app-dev`, so a run depends on that project and leaves its anonymous
  accounts and their profiles there.
- **No unit runner.** Nothing runs unit or component tests for the app.
  `@hipefit/worktree-devices` has its own assertion scripts, listed in its
  [README](../../packages/worktree-devices/README.md).
- **Smoke coverage only.** Edit Profile, the Settings pickers, and Exercises search and expansion
  have no flow.
