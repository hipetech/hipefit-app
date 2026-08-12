---
type: plan
status: proposed
area: quality
created: 2026-08-06
---

# Plan: local Maestro E2E integration

## Outcome

Hipefit has a repeatable local iOS end-to-end test system built on Maestro. A dedicated development
Simulator build reaches the protected app without an Apple account, runs deterministic regression
flows from Bun commands, and retains useful local failure artifacts.

AI coding agents can inspect the local Simulator, explore interactions, author flows, and diagnose
failures through Maestro's local MCP server. Separately invoked experimental flows may use Maestro AI
assertions against the local Simulator, with the explicit boundary that screenshots and prompts are
processed remotely by Maestro; deterministic assertions remain the pass/fail authority.

This initiative does not add CI, EAS Workflows, Maestro Cloud device execution, or a required merge
check. Hosted execution is a future initiative after the local harness proves useful and stable.

## Context

The repository has no automated test runner. [`package.json`](../../../package.json) exposes static
checks and environment-specific iOS launch commands, while
[`architecture.md`](../../app/architecture.md#what-is-deliberately-absent) and
[`AGENTS.md`](../../../AGENTS.md) describe those checks as the current verification gate.

Authentication is the main E2E blocker. The only shipped path is Apple Sign-In, and
[`authentication.md`](../../flows/authentication.md) requires a Simulator or device signed into an
Apple ID. A clean dedicated test Simulator cannot deterministically reach the protected route tree
through that path. The development Firebase project and bundle identifier are already isolated from
staging and production, and [`firestore.rules`](../../../firestore.rules) limits an authenticated
user to global catalogue reads and reads or writes under their own uid.

Maestro stays outside the application dependency graph. It does not require an in-app SDK or an
app-owned XCTest target, but it does require an installed iOS Simulator app. React Native `testID`
and SwiftUI `accessibilityIdentifier` values are exposed to Maestro's `id` selector.

Official references governing the plan:

- [React Native support](https://docs.maestro.dev/get-started/supported-platform/react-native)
- [SwiftUI support](https://docs.maestro.dev/get-started/supported-platform/ios/swiftui)
- [Workspace configuration](https://docs.maestro.dev/maestro-flows/workspace-management/project-configuration)
- [Test discovery and tags](https://docs.maestro.dev/maestro-flows/workspace-management/test-discovery-and-tags)
- [Reports and artifacts](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts)
- [AI test analysis](https://docs.maestro.dev/maestro-flows/workspace-management/ai-test-analysis)
- [`assertWithAI`](https://docs.maestro.dev/reference/commands-available/assertwithai)
- [`assertNoDefectsWithAI`](https://docs.maestro.dev/reference/commands-available/assertnodefectswithai)
- [Maestro MCP server](https://docs.maestro.dev/get-started/maestro-mcp)

## Approach

### Local build boundary

Add a self-contained `bun run ios:e2e` command that builds and installs `Hipefit-dev` in Release
configuration on a named, dedicated E2E Simulator. Release embeds the JavaScript bundle, so the
subsequent Maestro run does not require Metro to remain open. The command verifies the installed app
identifier is `com.kyrylokorota.hipefitapp.development` before tests start.

The command sets the non-secret build-time value `EXPO_PUBLIC_E2E=1`. Application code reads the
literal through `process.env.EXPO_PUBLIC_E2E`, which Expo replaces while bundling. Ordinary
`ios:development`, `ios:staging`, and `ios:production` commands omit it. No runtime input, deep link,
or remote setting can enable the branch in another build.

Do not add an `e2e-test` EAS profile in this initiative. The local command and native
`Hipefit-dev` scheme are the only supported build path for these flows.

### Development-only authentication

When and only when the E2E flag is compiled into the app, the signed-out auth screen exposes a
clearly labelled test action. It calls a separately named auth-store action backed by Firebase
anonymous authentication, then provisions the same default profile and user exercise groups used by
Apple Sign-In. Anonymous authentication must be enabled only in the development Firebase project.

This avoids putting a password, custom token, Firebase Admin key, or bearer credential in flow YAML,
command logs, screenshots, or agent context. It preserves the product authorization boundary: the
anonymous user is a normal Firebase user, global collections remain read-only, and Firestore permits
writes only inside that user's subtree.

The test path is build infrastructure, not a shipped alternative journey:

- Apple Sign-In remains the only control in ordinary development, staging, and production builds.
- The E2E build always uses the development bundle identifier and Firebase project.
- The E2E branch reuses normal profile creation rather than adding E2E document fields or
  collections.
- The anonymous provider stays disabled in staging and production Firebase.
- Local build-matrix verification confirms the E2E control is absent when the flag is omitted.

Automating Apple's account sheet, preserving one manually authenticated Simulator, and injecting a
custom token through a deep link are rejected. They respectively require personal account state,
make flows stateful, or expose a bearer credential through the automation boundary.

### Firebase baseline and isolation

Each authenticated flow clears the dedicated Simulator's keychain, creates a fresh anonymous user
through the app, and relies only on the default profile and exercise-group provisioning permitted by
existing rules. No top-level flow depends on a uid, document id, or state left by another flow.

Keychain clearing affects the whole Simulator, so scripts must resolve and validate the dedicated
E2E Simulator before any destructive operation. Application data clearing alone is insufficient
because Firebase Auth can persist credentials in the native keychain.

Exercise coverage requires a known global development catalogue. Harden the current seeding path in
[`scripts/db/index.ts`](../../../scripts/db/index.ts) and
[`seed-exercises.ts`](../../../scripts/db/seed-exercises.ts) as a prerequisite:

- require an explicit environment instead of defaulting to production;
- validate the Firebase project id before any write or delete;
- require explicit confirmation for destructive cleanup;
- provide an idempotent development bootstrap or clean-reseed command; and
- verify a checked-in set of expected names and difficulties before running exercise flows instead
  of selecting generated document ids.

Anonymous test accounts and their Firestore subtrees can accumulate locally. Configure Firebase's
supported cleanup for old anonymous Auth accounts and document a trusted maintenance command for
their Firestore data. Auth cleanup does not remove Firestore documents. Firestore cleanup must cover
the profile plus every user subcollection declared by [`refs.ts`](../../../database/refs.ts),
including exercise history; deleting the parent document alone does not delete subcollections.

### Maestro workspace

Add a checked-in workspace:

```text
.maestro/
  config.yaml
  tests/
    smoke/
    exercises/
    settings/
    ai-experimental/
  subflows/
    launch-clean.yaml
    login-anonymous.yaml
```

`config.yaml` discovers only `tests/**` and globally excludes `wip` and `ai-experimental`. It cannot
define `appId`, so each top-level flow declares `appId: ${MAESTRO_APP_ID}` and Bun scripts provide
the development identifier. Files under `subflows/` are reusable setup and never independently
discovered tests.

Use a small tag vocabulary:

| Tag               | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `smoke`           | Fast deterministic launch, auth, navigation, and critical read paths |
| `writes-data`     | Mutates the anonymous user's development data                        |
| `destructive`     | Clears the dedicated Simulator keychain or signs out                 |
| `wip`             | Intentionally incomplete and excluded from shared suite commands     |
| `ai-experimental` | Uses remote AI inference and never participates in required results  |

Maestro tag lists use OR semantics. Normal smoke and full-suite scripts explicitly exclude `wip`
and `ai-experimental`. Direct-flow and AI scripts name an exact file or explicitly include the
intended tag rather than weakening global discovery policy.

### Deterministic selectors and assertions

Use visible text when that text is the behavior. Add a stable identifier when text is localized,
dynamic, duplicated, absent, or attached to an icon-only control. React Native controls use
`testID`; SwiftUI controls rendered through `@expo/ui` use the existing
`accessibilityIdentifier` pattern described in [`ui.md`](../../app/ui.md#hit-testing-and-accessibility).

Identifiers describe user intent, not component layout or Firestore implementation. Do not use
generated document ids, array indexes, row positions, or coordinates as primary selectors. Inspect
the accessibility hierarchy for NativeTabs, every `Host` boundary, menus, pickers, alerts, and list
rows before finalizing selectors; native controls can merge labels or expose a different hierarchy
than their React tree suggests.

Each regression flow asserts a user-observable completion state with deterministic commands such as
`assertVisible`, `assertNotVisible`, and stable selector checks. Use visibility waits around
Firebase-backed loading rather than fixed sleeps. Coordinates require a comment recording the
native accessibility gap, device, and OS conditions and are not accepted in the initial smoke suite.

### AI assertions

Add a separate, opt-in `ai-experimental` suite for assertions that are expensive or brittle to
express structurally, initially limited to:

- `assertNoDefectsWithAI` for obvious clipping, overlap, truncation, or alignment defects on one
  stable screen; and
- `assertWithAI` for one narrowly worded visual statement whose expected evidence is entirely on
  screen.

These commands run while the app remains on the local Simulator, but they are not local inference.
Maestro uploads screenshots and prompts to its managed model and requires network access plus
`maestro login` or `MAESTRO_CLOUD_API_KEY`. No external model key belongs in the repository.

AI assertions are experimental and can vary between runs. Keep their default optional behavior or
set `optional: true` explicitly, run them only through `bun run e2e:ios:ai`, and never use them as the
sole evidence for a regression result. Every important AI observation must either duplicate a
deterministic assertion or produce exploratory evidence for a human to review. Do not use
`--analyze` in normal suite scripts.

If remote screenshot processing is not acceptable for the current screen or data, skip the AI flow.
AI flows must use only seeded development data and must not display real user data, credentials,
tokens, or personal Apple account information.

### AI agent workflow

Use Maestro's bundled local MCP server, started with `maestro mcp`, as the device interface for AI
coding agents. Document the generic project integration rather than binding the test architecture to
one agent product:

```json
{
  "mcpServers": {
    "maestro": {
      "command": "maestro",
      "args": ["mcp"]
    }
  }
}
```

The agent workflow is:

1. Use `list_devices` and select only the dedicated E2E Simulator.
2. Build and install with the checked-in `bun run ios:e2e` command.
3. Use `inspect_screen` before choosing selectors and after native transitions.
4. Prototype a minimal interaction with MCP `run`; do not treat an inline exploratory flow as
   durable coverage.
5. Write the proven interaction into `.maestro/tests/` or `.maestro/subflows/` using the selector and
   isolation rules above.
6. Run the checked-in Bun suite command and inspect local JUnit, hierarchy, logs, and screenshots.
7. Change product code or the flow only after classifying the failure as product, selector, fixture,
   or environment related.

Local MCP tools allowed by this plan are `list_devices`, `inspect_screen`, `take_screenshot`, `run`,
`cheat_sheet`, and `open_maestro_viewer`. Do not use `list_cloud_devices`, `run_on_cloud`, or
`get_cloud_run_status`. The reproducible CLI suite, not an agent's exploratory MCP session, is the
verification authority.

Set `MAESTRO_CLI_NO_ANALYTICS=true`, `MAESTRO_DISABLE_UPDATE_CHECK=true`, and
`MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true` in the local wrapper to reduce unrelated CLI
network behavior. Those settings do not make AI assertions offline; `e2e:ios:ai` deliberately
requires remote inference.

### Local commands and artifacts

Pin one Maestro CLI version compatible with Java 17 or 21 and the repository's Xcode/Simulator
runtime. Maestro remains an external CLI rather than a Bun dependency. Add intent-named scripts:

- `bun run ios:e2e` builds and installs the local E2E app;
- `bun run e2e:ios:smoke` runs deterministic smoke flows;
- `bun run e2e:ios` runs all deterministic regression flows;
- `bun run e2e:ios:flow -- <path>` runs one named flow; and
- `bun run e2e:ios:ai` runs only opt-in AI assertions after confirming Maestro authentication.

Deterministic suite scripts invoke the workspace and pass both outputs explicitly:

- `--format junit --output qa-artifacts/maestro/report.xml` for the report; and
- `--test-output-dir qa-artifacts/maestro/results` for command logs, hierarchy, Simulator logs, and
  screenshots.

JUnit and Maestro diagnostics are separate outputs. The generated `qa-artifacts/` directory is
already ignored by [`.gitignore`](../../../.gitignore). Keep AI output in a separate
`qa-artifacts/maestro/ai/` subtree so optional findings cannot be confused with deterministic suite
results.

Extend Prettier and lint-staged globs to include YAML. Formatting is not Maestro schema validation;
successful local execution remains the authority for command compatibility.

### Initial regression suite

Automate only behavior represented by current source and durable flows:

1. **Signed-out launch.** Clear the dedicated Simulator keychain, launch the E2E build, and assert
   the signed-out status, Apple Sign-In control, and clearly separate E2E action.
2. **Authenticated shell smoke.** Use anonymous E2E auth, wait for Firebase-backed state, assert
   Home, switch through all four private tabs, and confirm the protected shell remains active.
3. **Exercise browse and filter.** Assert a named global baseline exercise, search for it, change
   difficulty, and verify matching and empty results without selecting by document id.
4. **Settings and logout.** Assert the default anonymous profile, update theme through the native
   picker, confirm the visible result, then confirm the destructive logout alert and public redirect.
5. **Experimental visual quality.** On an isolated seeded screen, run one AI defect check and one
   narrow AI assertion, retain their evidence separately, and confirm their result cannot fail the
   deterministic suite.

Do not add flows implying routine creation, workout execution, workout completion, or custom
exercise creation ships. [`start-workout.md`](../../flows/start-workout.md),
[`log-workout.md`](../../flows/log-workout.md), and
[`create-routine.md`](../../flows/create-routine.md) record those journeys as disabled or partial.

## Documentation impact

- **Affected flows.** Production behavior does not change. Re-check
  [`authentication.md`](../../flows/authentication.md) and add a boundary note for the compile-time
  development-only test branch so its Apple-only statement stays precise. Disabled workout and
  routine flows do not change.
- **Affected shared systems.** Update [`architecture.md`](../../app/architecture.md) because local
  E2E is no longer absent; update [`database.md`](../../app/database.md) with development catalogue
  and anonymous-test-data boundaries.
- **New durable documents.** Create `docs/app/testing.md` as the authority for workspace structure,
  tags, selectors, commands, local build/auth isolation, AI assertion privacy, agent MCP workflow,
  Firebase cleanup, and artifacts. Index it in [`docs/README.md`](../../README.md).
- **Moved citations.** None planned. Search for `no automated test suite`, `no test runner`, and
  `primary code gate` before completion and reconcile each current-state claim.
- **`AGENTS.md`.** Preserve the fact that there is no unit-test runner. Add the local Maestro command
  and AI-agent workflow only if they become unconditional requirements for coding agents.

## Implementation phases

### Phase 1: prove local compatibility

- [ ] Select and pin Maestro, Java, Xcode, iOS runtime, and a dedicated Simulator.
- [ ] Add the workspace, YAML formatting, ignored artifact outputs, and local commands.
- [ ] Add the local Release Simulator build and verify the development app identifier.
- [ ] Inspect accessibility for auth, NativeTabs, `@expo/ui` lists, toolbar controls, picker, alert,
      and exercise rows before choosing selectors.
- [ ] Add signed-out launch and prove repeated runs emit JUnit and diagnostics.
- [ ] **Exit gate:** local launch passes from a cleared dedicated Simulator without fixed sleeps or
      coordinates, and a broken assertion retains useful artifacts.

### Phase 2: add safe authentication and data isolation

- [ ] Add the local build-time flag and separately decomposed anonymous E2E login control.
- [ ] Reuse normal profile provisioning from the auth store.
- [ ] Enable anonymous auth only in development Firebase and verify other projects reject it.
- [ ] Make catalogue setup explicit, verifiable, development-safe, and idempotent.
- [ ] Configure anonymous Auth cleanup and document trusted Firestore cleanup.
- [ ] Verify ordinary development, staging, and production builds omit the E2E control.
- [ ] **Exit gate:** a clean dedicated Simulator reaches the protected shell with no Apple account
      or secret, while non-E2E builds retain the Apple-only surface.

### Phase 3: establish deterministic regression coverage

- [ ] Add authenticated shell, exercise/filter, and settings/logout flows.
- [ ] Add only the minimum semantic accessibility identifiers needed by inspected controls.
- [ ] Make every flow independently runnable from cleared keychain and anonymous-user state.
- [ ] Exercise loading, matching, empty, changed, confirmation, and completion states.
- [ ] Run repeatedly with retries disabled and resolve observed flakes at their source.
- [ ] **Exit gate:** all initial deterministic flows pass locally from clean state and fail clearly
      when the development catalogue baseline is missing.

### Phase 4: add AI-assisted local workflows

- [ ] Configure and document `maestro mcp` for local agent device inspection and flow authoring.
- [ ] Verify the allowed MCP tools against the dedicated Simulator and exclude cloud-device tools.
- [ ] Add one optional `assertNoDefectsWithAI` flow and one narrowly scoped `assertWithAI` flow.
- [ ] Document Maestro authentication, remote screenshot processing, privacy, and result separation.
- [ ] Add `e2e:ios:ai` without changing deterministic suite exit status.
- [ ] **Exit gate:** an AI agent can inspect, prototype, write, run, and diagnose a durable local flow;
      AI assertions run only when explicitly requested and cannot make regression smoke red.

### Phase 5: reconcile and operationalize

- [ ] Create `docs/app/testing.md` and update every durable document named above.
- [ ] Record how to classify product, selector, fixture, environment, and AI-variance failures.
- [ ] Confirm all scripts reject a non-dedicated Simulator before clearing keychain state.
- [ ] Measure local run time before adding retries, parallelism, or more runtime coverage.
- [ ] Mark this plan completed only when code, Firebase configuration, local flows, and docs agree.

## Verification

Final names may be refined during implementation, but the completed system must expose equivalent
commands in this order:

```bash
bun run type-check
bun run lint
bun run format:check
bun run ios:e2e
bun run e2e:ios:smoke
bun run e2e:ios
bun run e2e:ios:ai # opt-in, remote inference, non-blocking
```

Additional evidence:

- the installed E2E app reports the development bundle identifier and Release configuration;
- a clean dedicated Simulator authenticates without Apple ID, password, token, or Admin key;
- ordinary development, staging, and production builds do not render the E2E control;
- catalogue setup refuses an omitted, staging, or production target;
- destructive scripts reject any Simulator other than the dedicated E2E device;
- a controlled deterministic failure retains JUnit, hierarchy, logs, and a screenshot;
- an agent authors and verifies one durable flow through local Maestro MCP tools; and
- AI evidence is stored separately and clearly identifies remote processing and optional status.

## Acceptance criteria

- [ ] Pinned Maestro flows run only locally against a self-contained `Hipefit-dev` Release Simulator
      app through documented Bun commands.
- [ ] A fresh dedicated Simulator reaches the protected app through development-only anonymous auth
      without exposing reusable credentials.
- [ ] The E2E auth branch cannot be enabled at runtime and is absent from ordinary development,
      staging, and production builds.
- [ ] Initial launch, authenticated-shell, exercise, and settings/logout flows pass independently
      without fixed sleeps, coordinates, generated ids, or inherited user state.
- [ ] Catalogue setup and test-account cleanup are explicit, fail-closed, and cannot target staging
      or production through omission.
- [ ] Deterministic failures retain enough local report, hierarchy, log, and screenshot evidence for
      diagnosis.
- [ ] AI agents use local Maestro MCP tools to inspect and author flows, while checked-in CLI scripts
      remain the verification authority.
- [ ] AI assertions are opt-in, remotely processed, privacy-bounded, artifact-separated, and unable
      to fail the deterministic suite.
- [ ] Every document under **Documentation impact** is reconciled and the testing document is indexed
      in `docs/README.md`.

## Non-goals

- Running Maestro in CI, EAS Workflows, Maestro Cloud devices, or GitHub-hosted macOS.
- Adding a required pull-request or merge check.
- Adding a JavaScript unit, component, snapshot, or integration test runner.
- Adding Android build branches or Android Maestro flows.
- Automating the real Sign in with Apple account sheet.
- Testing staging or production Firebase.
- Treating probabilistic AI output as a required regression assertion.
- Sending credentials, real user data, or personal account screens to Maestro AI.
- Building pixel-based visual regression from screenshots.
- Enabling disabled workout, routine, or custom-exercise journeys as test setup.

## Follow-up decisions

- **Hosted execution.** Consider CI or hosted devices in a separate plan only after local suite
  stability, run time, cost, secrets, and artifact requirements are understood.
- **Authentication.** Replace anonymous auth with short-lived custom credentials only if a trusted
  backend exists and improves cleanup or audit requirements without exposing tokens.
- **Parallelism.** Add local sharding only after isolated flows are proven safe concurrently.
- **Runtime coverage.** Add another iOS runtime only for a documented compatibility risk.
- **AI policy.** Promote an AI check beyond exploratory status only if repeated evidence establishes
  useful stability and a deterministic assertion still guards the important behavior.
- **Feature policy.** Decide after the baseline is stable which behavior changes justify a Maestro
  acceptance flow and whether it is authored before implementation.
