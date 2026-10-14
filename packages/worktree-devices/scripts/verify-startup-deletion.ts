import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorktreeDevicesConfig } from '../src/config';
import type {
  Assignment,
  CliOptions,
  GitContext,
  ManagedSimulator,
  RegistryState,
} from '../src/types';

import { detach } from '../src/commands/detach';
import { remove } from '../src/commands/remove';
import { run } from '../src/commands/run';
import { bootSimulator, deleteSimulator } from '../src/core/devices';
import { decodeState, serializeState } from '../src/core/registry';
import { errorMessage } from '../src/lib/command';
import { isRecord } from '../src/lib/guards';
import { STATE_VERSION } from '../src/types';

// Assertion script for startup, deletion, removal, and allocation rollback.
// Run it with: bun run packages/worktree-devices/scripts/verify-startup-deletion.ts
//
// Every case runs the exported functions in a child process whose PATH holds
// only the fake xcrun, git, and pod written into a temporary fixture. The fakes
// allowlist exact argument shapes and exit 97 on anything else, so nothing here
// can reach Xcode, a real simulator, the real registry, or a real env file.

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const CHILD_FLAG = '--child';
const REJECTED = 'rejected';

// Evidence labels printed beside each case. No case uses an instrumented copy
// or in-process fault injection: the registry write is made to fail by giving
// the fixture a read-only registry directory, which the synthetic context can
// do because its lock lives in a different directory.
const UNMODIFIED = 'unmodified modules';
const READ_ONLY = 'unmodified modules, read-only fixture registry directory';

const CONFIG: WorktreeDevicesConfig = {
  appDirectory: 'apps/mobile',
  scheme: 'Fixture-dev',
  bundleIdentifier: 'com.example.fixture.development',
  environmentFile: '.env.development',
  environmentLocalName: '.env.local',
  simulatorNamePrefix: 'Fixture Worktree',
  registryName: 'fixture-registry',
  ports: { start: 39_400, end: 39_419 },
  reservedPorts: [],
};

const ENVIRONMENT_CONTENT = 'FIXTURE_ONLY=synthetic\n';
const RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-99-0';
const UNAVAILABLE_RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-90-0';
const DEVICE_TYPE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-Fixture';
const TEMPLATE_UDID = 'FIXTURE-TEMPLATE-0000';
const CREATED_UDID = 'FIXTURE-CREATED-0001';
const CREATED_NAME = `${CONFIG.simulatorNamePrefix} worktree`;

const contextFor = (root: string): GitContext => {
  const worktree = join(root, 'worktree');
  const mobileDirectory = join(worktree, CONFIG.appDirectory);
  return {
    config: CONFIG,
    worktree,
    commonGitDirectory: join(root, 'registry'),
    statePath: join(root, 'registry', `${CONFIG.registryName}.json`),
    lockPath: join(root, 'locks', `${CONFIG.registryName}.lock`),
    mobileDirectory,
    environmentSource: join(worktree, CONFIG.environmentFile),
    environmentDestination: join(mobileDirectory, CONFIG.environmentLocalName),
    iosDirectory: join(mobileDirectory, 'ios'),
  };
};

// The fake tools share one program. It is plain JavaScript because it runs
// outside this script's module graph, started by the shell wrappers in bin/.
const FAKE_TOOL_SOURCE = `import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [root, tool, ...args] = process.argv.slice(2);
const scenario = JSON.parse(readFileSync(join(root, 'scenario.json'), 'utf8'));
const inventoryPath = join(root, 'inventory.json');
const readText = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);
const readInventory = () => JSON.parse(readFileSync(inventoryPath, 'utf8'));
const writeInventory = (inventory) =>
  writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
const record = (outcome) =>
  appendFileSync(
    join(root, 'calls.jsonl'),
    JSON.stringify({
      tool,
      args,
      outcome,
      registry: readText(scenario.statePath),
      environment: readText(scenario.environmentDestination),
    }) + '\\n'
  );
const succeed = (stdout = '') => {
  record('ok');
  process.stdout.write(stdout);
  process.exit(0);
};
const fail = (status, stderr = '', stdout = '') => {
  record('failed');
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exit(status);
};
const reject = () => {
  record('${REJECTED}');
  process.stderr.write('fixture rejected: ' + [tool, ...args].join(' ') + '\\n');
  process.exit(97);
};
const equals = (expected) =>
  args.length === expected.length && args.every((arg, index) => arg === expected[index]);
const findDevice = (inventory, udid) =>
  Object.values(inventory.devices)
    .flat()
    .find((device) => device.udid === udid);
const setState = (udid, state) => {
  const inventory = readInventory();
  const device = findDevice(inventory, udid);
  if (!device) reject();
  device.state = state;
  writeInventory(inventory);
};

const simctl = () => {
  const [, action, udid] = args;
  const inventory = readInventory();
  if (equals(['simctl', 'list', '--json'])) succeed(JSON.stringify(inventory));
  if (action === 'create' && args.length === 5) {
    const [, , name, deviceType, runtime] = args;
    const knownType = inventory.devicetypes.some((entry) => entry.identifier === deviceType);
    const knownRuntime = inventory.runtimes.some((entry) => entry.identifier === runtime);
    if (!knownType || !knownRuntime) reject();
    inventory.devices[runtime] = [
      ...(inventory.devices[runtime] ?? []),
      {
        udid: scenario.createdUdid,
        name,
        state: 'Shutdown',
        isAvailable: true,
        deviceTypeIdentifier: deviceType,
      },
    ];
    writeInventory(inventory);
    succeed(scenario.createdUdid + '\\n');
  }
  if (!findDevice(inventory, udid)) reject();
  if (action === 'rename' && args.length === 4) {
    findDevice(inventory, udid).name = args[3];
    writeInventory(inventory);
    succeed();
  }
  if (action === 'boot' && args.length === 3) {
    setState(udid, 'Booted');
    succeed();
  }
  if (action === 'bootstatus' && equals(['simctl', 'bootstatus', udid, '-b'])) succeed();
  if (action === 'shutdown' && args.length === 3) {
    if (scenario.shutdownFailures.includes(udid)) fail(1, 'fixture: unable to shut down\\n');
    setState(udid, 'Shutdown');
    succeed();
  }
  if (action === 'delete' && args.length === 3) {
    const failure = scenario.deleteFailures[udid];
    if (failure?.kind === 'signal') {
      record('killed');
      process.kill(process.pid, 'SIGKILL');
    }
    if (failure) fail(failure.status, failure.stderr, failure.stdout);
    for (const runtime of Object.keys(inventory.devices)) {
      inventory.devices[runtime] = inventory.devices[runtime].filter(
        (device) => device.udid !== udid
      );
    }
    writeInventory(inventory);
    succeed();
  }
  if (
    action === 'spawn' &&
    args.length === 8 &&
    equals(['simctl', 'spawn', udid, 'defaults', 'write', scenario.bundleIdentifier, 'RCT_jsLocation', args[7]]) &&
    /^localhost:\\d+$/.test(args[7])
  ) {
    succeed();
  }
  reject();
};

if (tool === 'xcrun') {
  if (equals(['--find', 'simctl'])) succeed('/fixture/simctl\\n');
  if (args[0] === 'simctl') simctl();
  reject();
}
if (tool === 'git') {
  if (!equals(['worktree', 'list', '--porcelain', '-z'])) reject();
  const branchField = (path) =>
    scenario.branches[path] ? 'branch refs/heads/' + scenario.branches[path] + '\\0' : '';
  succeed(
    scenario.worktrees
      .map((path) => 'worktree ' + path + '\\0HEAD 0000\\0' + branchField(path) + '\\0')
      .join('')
  );
}
if (tool === 'pod') {
  if (!equals(['--version'])) reject();
  succeed('1.0.0\\n');
}
if (tool === 'expo') {
  const device = findDevice(readInventory(), args[4]);
  if (
    args.length !== 7 ||
    !equals(['run:ios', '--scheme', scenario.scheme, '--device', args[4], '--port', args[6]]) ||
    !device ||
    !/^\\d+$/.test(args[6])
  ) {
    reject();
  }
  record('ok cwd=' + process.cwd());
  process.exit(0);
}
reject();
`;

type DeleteFailure =
  | { kind: 'exit'; status: number; stderr: string; stdout: string }
  | { kind: 'signal' };

interface FixtureDevice {
  udid: string;
  name: string;
  state: 'Booted' | 'Shutdown';
  unavailable?: boolean;
}

interface FixtureSetup {
  devices?: FixtureDevice[];
  registry?: RegistryState;
  deleteFailures?: Record<string, DeleteFailure>;
  shutdownFailures?: string[];
  readOnlyRegistry?: boolean;
  // The branch of this worktree. Without one the fake git reports a detached
  // HEAD, as it does for every other worktree.
  branch?: string;
}

interface Fixture {
  root: string;
  context: GitContext;
  worktreeB: string;
  worktreeC: string;
  worktreeGone: string;
}

interface FakeCall {
  tool: string;
  args: string[];
  outcome: string;
  registry: string | null;
  environment: string | null;
}

interface ChildResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

const writeExecutable = (path: string, content: string): void => {
  writeFileSync(path, content, { mode: 0o755 });
};

const toolWrapper = (root: string, tool: string): string =>
  `#!/bin/sh\nexec '${process.execPath}' '${join(root, 'fake-tool.mjs')}' '${root}' ${tool} "$@"\n`;

const createFixture = (setup: FixtureSetup): Fixture => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'worktree-devices-verify-'))
  );
  const context = contextFor(root);
  const fixture: Fixture = {
    root,
    context,
    worktreeB: join(root, 'worktree-b'),
    worktreeC: join(root, 'worktree-c'),
    // Never created and never listed, so reconciliation treats it as removed.
    worktreeGone: join(root, 'worktree-gone'),
  };
  const expoDirectory = join(context.mobileDirectory, 'node_modules', '.bin');
  for (const directory of [
    join(root, 'bin'),
    join(root, 'empty-bin'),
    join(root, 'tmp'),
    join(root, 'locks'),
    context.commonGitDirectory,
    fixture.worktreeB,
    fixture.worktreeC,
    expoDirectory,
    join(context.iosDirectory, 'Pods'),
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(join(root, 'fake-tool.mjs'), FAKE_TOOL_SOURCE);
  for (const tool of ['xcrun', 'git', 'pod']) {
    writeExecutable(join(root, 'bin', tool), toolWrapper(root, tool));
  }
  writeExecutable(join(expoDirectory, 'expo'), toolWrapper(root, 'expo'));
  writeFileSync(context.environmentSource, ENVIRONMENT_CONTENT);
  writeFileSync(join(context.iosDirectory, 'Podfile.lock'), 'PODFILE: {}\n');

  const devices: FixtureDevice[] = [
    { udid: TEMPLATE_UDID, name: 'iPhone Fixture', state: 'Shutdown' },
    ...(setup.devices ?? []),
  ];
  const entry = (device: FixtureDevice): Record<string, unknown> => ({
    udid: device.udid,
    name: device.name,
    state: device.state,
    isAvailable: device.unavailable !== true,
    deviceTypeIdentifier: DEVICE_TYPE,
  });
  writeFileSync(
    join(root, 'inventory.json'),
    JSON.stringify({
      devicetypes: [
        {
          identifier: DEVICE_TYPE,
          name: 'iPhone Fixture',
          productFamily: 'iPhone',
        },
      ],
      runtimes: [
        {
          identifier: RUNTIME,
          name: 'iOS 99.0',
          version: '99.0',
          isAvailable: true,
          platform: 'iOS',
        },
        {
          identifier: UNAVAILABLE_RUNTIME,
          name: 'iOS 90.0',
          version: '90.0',
          isAvailable: false,
          platform: 'iOS',
        },
      ],
      devices: {
        [RUNTIME]: devices.filter((device) => !device.unavailable).map(entry),
        [UNAVAILABLE_RUNTIME]: devices
          .filter((device) => device.unavailable)
          .map(entry),
      },
    })
  );
  writeFileSync(
    join(root, 'scenario.json'),
    JSON.stringify({
      statePath: context.statePath,
      environmentDestination: context.environmentDestination,
      bundleIdentifier: CONFIG.bundleIdentifier,
      scheme: CONFIG.scheme,
      createdUdid: CREATED_UDID,
      worktrees: [context.worktree, fixture.worktreeB, fixture.worktreeC],
      deleteFailures: setup.deleteFailures ?? {},
      shutdownFailures: setup.shutdownFailures ?? [],
      branches: setup.branch ? { [context.worktree]: setup.branch } : {},
    })
  );
  if (setup.registry) {
    writeFileSync(context.statePath, serializeState(setup.registry));
  }
  if (setup.readOnlyRegistry) chmodSync(context.commonGitDirectory, 0o555);
  return fixture;
};

const destroyFixture = (fixture: Fixture): void => {
  chmodSync(fixture.context.commonGitDirectory, 0o755);
  rmSync(fixture.root, { recursive: true, force: true });
};

const withFixture = (
  setup: FixtureSetup,
  check: (fixture: Fixture) => void
): void => {
  const fixture = createFixture(setup);
  try {
    check(fixture);
  } finally {
    destroyFixture(fixture);
  }
};

const runChild = (
  fixture: Fixture,
  args: string[],
  toolDirectory = 'bin'
): ChildResult => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT_PATH, CHILD_FLAG, fixture.root, ...args],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: join(fixture.root, toolDirectory),
        HOME: fixture.root,
        TMPDIR: join(fixture.root, 'tmp'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    }
  );
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const decodeCall = (line: string): FakeCall => {
  const value: unknown = JSON.parse(line);
  if (
    !isRecord(value) ||
    typeof value.tool !== 'string' ||
    !Array.isArray(value.args) ||
    typeof value.outcome !== 'string' ||
    (value.registry !== null && typeof value.registry !== 'string') ||
    (value.environment !== null && typeof value.environment !== 'string')
  ) {
    throw new Error(`Malformed fixture call record: ${line}`);
  }
  return {
    tool: value.tool,
    args: value.args.map(String),
    outcome: value.outcome,
    registry: value.registry,
    environment: value.environment,
  };
};

// Reading the log also proves the allowlist held: one rejected call fails the
// case, whatever the command under test made of the fake's exit status.
const readCalls = (fixture: Fixture): FakeCall[] => {
  const path = join(fixture.root, 'calls.jsonl');
  if (!existsSync(path)) return [];
  const calls = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map(decodeCall);
  const rejected = calls.filter(({ outcome }) => outcome === REJECTED);
  assert.deepEqual(
    rejected.map(({ tool, args }) => [tool, ...args].join(' ')),
    [],
    'the fake tools rejected a call outside the allowlist'
  );
  return calls;
};

const label = ({ tool, args }: FakeCall): string =>
  tool === 'xcrun' && args[0] === 'simctl'
    ? `simctl ${args[1] ?? ''}`
    : `${tool} ${args[0] ?? ''}`;

const simctlCalls = (fixture: Fixture, action: string): FakeCall[] =>
  readCalls(fixture).filter((call) => label(call) === `simctl ${action}`);

const callFor = (calls: FakeCall[], wanted: string): FakeCall => {
  const call = calls.find((candidate) => label(candidate) === wanted);
  assert.ok(call, `expected a "${wanted}" call`);
  return call;
};

const decodeRegistry = (source: string): RegistryState => {
  const value: unknown = JSON.parse(source);
  return decodeState(value, CONFIG.ports);
};

const readRegistry = (fixture: Fixture): RegistryState =>
  decodeRegistry(readFileSync(fixture.context.statePath, 'utf8'));

const inventoryUdids = (fixture: Fixture): string[] => {
  const value: unknown = JSON.parse(
    readFileSync(join(fixture.root, 'inventory.json'), 'utf8')
  );
  if (!isRecord(value) || !isRecord(value.devices)) {
    throw new Error('Malformed fixture inventory.');
  }
  return Object.values(value.devices).flatMap((entries: unknown) =>
    Array.isArray(entries)
      ? entries.flatMap((device: unknown) =>
          isRecord(device) && typeof device.udid === 'string'
            ? [device.udid]
            : []
        )
      : []
  );
};

const state = (
  simulators: ManagedSimulator[],
  assignments: Assignment[]
): RegistryState => ({ version: STATE_VERSION, assignments, simulators });

const port = (offset: number): number => CONFIG.ports.start + offset;

const exitFailure = (stderr: string, stdout = ''): DeleteFailure => ({
  kind: 'exit',
  status: 1,
  stderr,
  stdout,
});

const deleteDiagnostic = (udid: string, detail: string): string =>
  `Could not delete ${udid}: xcrun simctl delete ${udid} failed: ${detail}`;

const STILL_MANAGED =
  'They are still managed. Check them in Simulator, then run this command again.';
const REMOVE_ALL_FORCED = ['remove', 'all', 'force'];

const bootCase = (initial: 'Booted' | 'Shutdown', expected: string[]): void => {
  const udid = 'FIXTURE-BOOT-0001';
  withFixture(
    { devices: [{ udid, name: 'Fixture Boot', state: initial }] },
    (fixture) => {
      const result = runChild(fixture, ['boot', udid, String(port(0))]);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(readCalls(fixture).map(label), expected);
      const status = callFor(readCalls(fixture), 'simctl bootstatus');
      assert.deepEqual(status.args, ['simctl', 'bootstatus', udid, '-b']);
    }
  );
};

const fullRunCase = (): void => {
  withFixture({}, (fixture) => {
    const { context } = fixture;
    const first = runChild(fixture, ['run']);
    assert.equal(first.status, 0, first.stderr);
    const calls = readCalls(fixture);
    assert.deepEqual(calls.map(label), [
      'xcrun --find',
      'pod --version',
      'simctl list',
      'git worktree',
      'simctl create',
      'simctl list',
      'simctl boot',
      'simctl bootstatus',
      'simctl spawn',
      'expo run:ios',
    ]);

    const persisted = readRegistry(fixture);
    assert.deepEqual(persisted.simulators, [
      { udid: CREATED_UDID, name: CREATED_NAME },
    ]);
    const assignment = persisted.assignments[0];
    assert.ok(assignment);
    assert.equal(persisted.assignments.length, 1);
    assert.equal(assignment.worktree, context.worktree);
    assert.equal(assignment.simulatorUdid, CREATED_UDID);

    // Each fake call snapshots the registry and the copied environment file, so
    // these read what was on disk at the moment the tool ran.
    const create = callFor(calls, 'simctl create');
    assert.equal(create.registry, null, 'nothing is persisted before create');
    assert.equal(create.environment, null);
    const boot = callFor(calls, 'simctl boot');
    assert.ok(boot.registry, 'the registry is persisted before boot');
    // The run holds its runner lease from the allocation write until Expo
    // exits, so the registry at boot differs from the final one by that lease.
    const atBoot = decodeRegistry(boot.registry);
    const leased = atBoot.assignments[0];
    assert.ok(leased?.runner, 'the runner lease is persisted before boot');
    delete leased.runner;
    assert.deepEqual(atBoot, persisted);
    assert.equal(
      boot.environment,
      ENVIRONMENT_CONTENT,
      'the environment file is copied before boot'
    );
    assert.deepEqual(boot.args, ['simctl', 'boot', CREATED_UDID]);
    assert.deepEqual(callFor(calls, 'simctl spawn').args, [
      'simctl',
      'spawn',
      CREATED_UDID,
      'defaults',
      'write',
      CONFIG.bundleIdentifier,
      'RCT_jsLocation',
      `localhost:${assignment.port}`,
    ]);
    const expo = callFor(calls, 'expo run:ios');
    assert.deepEqual(expo.args, [
      'run:ios',
      '--scheme',
      CONFIG.scheme,
      '--device',
      CREATED_UDID,
      '--port',
      String(assignment.port),
    ]);
    assert.equal(expo.outcome, `ok cwd=${context.mobileDirectory}`);
    assert.match(
      first.stdout,
      new RegExp(`Simulator: ${CREATED_NAME} \\(${CREATED_UDID}\\)`)
    );

    // The fake left the device Booted, so the second run reuses the assignment
    // and must skip boot while still waiting on bootstatus.
    const registryBefore = readFileSync(context.statePath, 'utf8');
    const second = runChild(fixture, ['run']);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(readCalls(fixture).slice(calls.length).map(label), [
      'xcrun --find',
      'pod --version',
      'simctl list',
      'git worktree',
      'simctl list',
      'simctl bootstatus',
      'simctl spawn',
      'expo run:ios',
    ]);
    assert.equal(readFileSync(context.statePath, 'utf8'), registryBefore);
  });
};

const deleteSpawnErrorCase = (): void => {
  const udid = 'FIXTURE-DELETE-0001';
  withFixture(
    { devices: [{ udid, name: 'Fixture Delete', state: 'Shutdown' }] },
    (fixture) => {
      const result = runChild(fixture, ['delete', udid], 'empty-bin');
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        new RegExp(`Could not delete ${udid}: Cannot run xcrun: .+`)
      );
      assert.deepEqual(readCalls(fixture), []);
      assert.ok(inventoryUdids(fixture).includes(udid));
    }
  );
};

const deleteTerminationCase = (
  failure: DeleteFailure,
  expected: string
): void => {
  const udid = 'FIXTURE-DELETE-0002';
  withFixture(
    {
      devices: [{ udid, name: 'Fixture Delete', state: 'Shutdown' }],
      deleteFailures: { [udid]: failure },
    },
    (fixture) => {
      const result = runChild(fixture, ['delete', udid]);
      assert.equal(result.status, 1);
      assert.ok(
        result.stderr.includes(expected),
        `expected "${expected}" in: ${result.stderr}`
      );
      assert.equal(simctlCalls(fixture, 'delete').length, 1);
      assert.ok(inventoryUdids(fixture).includes(udid));
    }
  );
};

const deleteSuccessCase = (): void => {
  const udid = 'FIXTURE-DELETE-0003';
  withFixture(
    { devices: [{ udid, name: 'Fixture Delete', state: 'Shutdown' }] },
    (fixture) => {
      const result = runChild(fixture, ['delete', udid]);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!inventoryUdids(fixture).includes(udid));
    }
  );
};

const mixedBatchCase = (failurePosition: 'first' | 'last'): void => {
  const a = { udid: 'FIXTURE-MIXED-000A', name: 'Fixture Mixed A' };
  const b = { udid: 'FIXTURE-MIXED-000B', name: 'Fixture Mixed B' };
  const c = { udid: 'FIXTURE-MIXED-000C', name: 'Fixture Mixed C' };
  const d = { udid: 'FIXTURE-MIXED-000D', name: 'Fixture Mixed D' };
  const order = failurePosition === 'first' ? [a, b, c, d] : [b, c, d, a];
  const failing = new Set([a.udid, c.udid]);
  const fixtureHolder = createFixture({
    devices: order.map((simulator) => ({
      ...simulator,
      state: simulator === a ? 'Booted' : 'Shutdown',
    })),
    deleteFailures: {
      [a.udid]: exitFailure('fixture: A is busy\n'),
      [c.udid]: exitFailure('fixture: C is busy\n'),
    },
  });
  try {
    const fixture = fixtureHolder;
    const kept: Assignment = {
      worktree: fixture.worktreeB,
      simulatorUdid: a.udid,
      port: port(1),
    };
    writeFileSync(
      fixture.context.statePath,
      serializeState(
        state(order, [
          kept,
          // Its worktree is gone, so reconciliation drops this assignment and a
          // failed delete of C must not bring it back.
          {
            worktree: fixture.worktreeGone,
            simulatorUdid: c.udid,
            port: port(2),
          },
          { worktree: fixture.worktreeC, simulatorUdid: d.udid, port: port(3) },
        ])
      )
    );
    const result = runChild(fixture, REMOVE_ALL_FORCED);
    assert.equal(result.status, 1, 'a failed deletion fails the command');
    assert.deepEqual(
      simctlCalls(fixture, 'delete').map(({ args }) => args[2]),
      order.map(({ udid }) => udid),
      'every selected simulator is attempted'
    );
    assert.equal(simctlCalls(fixture, 'shutdown').length, 1);
    for (const simulator of [b, d]) {
      assert.ok(
        result.stdout.includes(`Deleted ${simulator.name} (${simulator.udid}).`)
      );
    }
    for (const simulator of [a, c]) {
      assert.ok(!result.stdout.includes(`Deleted ${simulator.name}`));
    }
    assert.ok(result.stderr.includes('2 simulators could not be deleted:'));
    assert.ok(
      result.stderr.includes(deleteDiagnostic(a.udid, 'fixture: A is busy'))
    );
    assert.ok(
      result.stderr.includes(deleteDiagnostic(c.udid, 'fixture: C is busy'))
    );
    assert.ok(result.stderr.includes(STILL_MANAGED));
    assert.deepEqual(
      readRegistry(fixture),
      state(
        order.filter(({ udid }) => failing.has(udid)),
        [kept]
      )
    );
    const remaining = inventoryUdids(fixture);
    assert.ok(remaining.includes(a.udid) && remaining.includes(c.udid));
    assert.ok(!remaining.includes(b.udid) && !remaining.includes(d.udid));
  } finally {
    destroyFixture(fixtureHolder);
  }
};

const shutdownWarningCase = (): void => {
  const simulator = { udid: 'FIXTURE-WARN-0001', name: 'Fixture Warn' };
  withFixture(
    {
      devices: [{ ...simulator, state: 'Booted' }],
      registry: state([simulator], []),
      shutdownFailures: [simulator.udid],
    },
    (fixture) => {
      const result = runChild(fixture, [
        'remove',
        'one',
        'safe',
        simulator.name,
      ]);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(
        result.stderr.includes(
          `Warning: could not shut down ${simulator.name} (${simulator.udid}): xcrun simctl shutdown ${simulator.udid} failed: fixture: unable to shut down`
        )
      );
      assert.ok(
        result.stdout.includes(`Deleted ${simulator.name} (${simulator.udid}).`)
      );
      assert.deepEqual(
        readCalls(fixture)
          .map(label)
          .filter((entry) => /shutdown|delete/.test(entry)),
        ['simctl shutdown', 'simctl delete']
      );
      assert.deepEqual(readRegistry(fixture), state([], []));
      assert.ok(!inventoryUdids(fixture).includes(simulator.udid));
    }
  );
};

const unavailableRuntimeCase = (): void => {
  const simulator = { udid: 'FIXTURE-OLD-0001', name: 'Fixture Old Runtime' };
  const fixtureHolder = createFixture({
    devices: [{ ...simulator, state: 'Shutdown', unavailable: true }],
    deleteFailures: {
      [simulator.udid]: exitFailure('fixture: runtime is unavailable\n'),
    },
  });
  try {
    const fixture = fixtureHolder;
    const before = state(
      [simulator],
      [
        {
          worktree: fixture.worktreeB,
          simulatorUdid: simulator.udid,
          port: port(1),
        },
      ]
    );
    writeFileSync(fixture.context.statePath, serializeState(before));
    const result = runChild(fixture, REMOVE_ALL_FORCED);
    assert.equal(result.status, 1);
    assert.ok(!result.stdout.includes('Deleted Fixture'));
    assert.ok(result.stderr.includes('One simulator could not be deleted:'));
    assert.ok(
      result.stderr.includes(
        deleteDiagnostic(simulator.udid, 'fixture: runtime is unavailable')
      )
    );
    assert.deepEqual(readRegistry(fixture), before);
  } finally {
    destroyFixture(fixtureHolder);
  }
};

const removeWriteFailureCase = (withDeletionFailure: boolean): void => {
  const a = { udid: 'FIXTURE-WRITE-000A', name: 'Fixture Write A' };
  const b = { udid: 'FIXTURE-WRITE-000B', name: 'Fixture Write B' };
  const simulators = withDeletionFailure ? [a, b] : [b];
  const before = state(simulators, []);
  withFixture(
    {
      devices: simulators.map((simulator) => ({
        ...simulator,
        state: 'Shutdown',
      })),
      registry: before,
      deleteFailures: withDeletionFailure
        ? { [a.udid]: exitFailure('', 'fixture: A stdout diagnostic\n') }
        : {},
      readOnlyRegistry: true,
    },
    (fixture) => {
      const { statePath, commonGitDirectory } = fixture.context;
      const result = runChild(fixture, REMOVE_ALL_FORCED);
      assert.equal(result.status, 1);
      assert.equal(simctlCalls(fixture, 'delete').length, simulators.length);
      assert.ok(
        result.stderr.includes(
          `Could not update the simulator registry ${statePath}: `
        )
      );
      assert.match(result.stderr, /EACCES|permission denied/i);
      assert.ok(
        result.stderr.includes(
          'Nothing was saved. The registry still holds its previous contents.'
        )
      );
      assert.ok(
        result.stderr.includes(
          `These simulators are already deleted and the registry still lists them:\n  ${b.name} (${b.udid})\nThe next command that writes the registry drops them.`
        )
      );
      assert.equal(
        result.stderr.includes('One simulator could not be deleted:'),
        withDeletionFailure
      );
      assert.equal(
        result.stderr.includes(
          deleteDiagnostic(a.udid, 'fixture: A stdout diagnostic')
        ),
        withDeletionFailure
      );
      assert.equal(result.stderr.includes(STILL_MANAGED), withDeletionFailure);
      assert.equal(
        readFileSync(statePath, 'utf8'),
        serializeState(before),
        'the previous registry is still readable and unchanged'
      );
      assert.deepEqual(readdirSync(commonGitDirectory), [
        `${CONFIG.registryName}.json`,
      ]);
      assert.ok(!inventoryUdids(fixture).includes(b.udid));
    }
  );
};

const createdRollbackCase = (cleanupFails: boolean): void => {
  withFixture(
    {
      deleteFailures: cleanupFails
        ? { [CREATED_UDID]: exitFailure('fixture: created device is busy\n') }
        : {},
      readOnlyRegistry: true,
    },
    (fixture) => {
      const result = runChild(fixture, ['run']);
      assert.equal(result.status, 1);
      const calls = readCalls(fixture).map(label);
      assert.deepEqual(calls.slice(-2), ['simctl create', 'simctl delete']);
      assert.deepEqual(simctlCalls(fixture, 'delete')[0]?.args, [
        'simctl',
        'delete',
        CREATED_UDID,
      ]);
      assert.ok(!existsSync(fixture.context.statePath));
      assert.ok(!existsSync(fixture.context.environmentDestination));

      const writeError = result.stderr.search(/EACCES|permission denied/i);
      assert.ok(writeError >= 0, 'the original write error is reported');
      const cleanup = result.stderr.indexOf(
        'Cleaning up after that failure also failed: '
      );
      if (!cleanupFails) {
        assert.equal(cleanup, -1);
        assert.ok(!result.stderr.includes(CREATED_UDID));
        assert.ok(!inventoryUdids(fixture).includes(CREATED_UDID));
        return;
      }
      assert.ok(writeError < cleanup, 'the write error comes first');
      assert.ok(
        result.stderr.includes(
          `Cleaning up after that failure also failed: ${deleteDiagnostic(CREATED_UDID, 'fixture: created device is busy')}`
        )
      );
      assert.ok(
        result.stderr.includes(
          `${CREATED_NAME} (${CREATED_UDID}) was created by this run and is not in the registry. Delete it with "xcrun simctl delete ${CREATED_UDID}".`
        )
      );
      assert.ok(inventoryUdids(fixture).includes(CREATED_UDID));
    }
  );
};

const pooledRollbackCase = (): void => {
  const pooled = { udid: 'FIXTURE-POOL-0001', name: 'Fixture Pooled' };
  const before = state([pooled], []);
  withFixture(
    {
      devices: [{ ...pooled, state: 'Shutdown' }],
      registry: before,
      readOnlyRegistry: true,
    },
    (fixture) => {
      const result = runChild(fixture, ['run']);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /EACCES|permission denied/i);
      assert.ok(!result.stderr.includes('Cleaning up after that failure'));
      assert.deepEqual(readCalls(fixture).map(label), [
        'xcrun --find',
        'pod --version',
        'simctl list',
        'git worktree',
        'simctl rename',
      ]);
      assert.ok(inventoryUdids(fixture).includes(pooled.udid));
      assert.equal(
        readFileSync(fixture.context.statePath, 'utf8'),
        serializeState(before)
      );
    }
  );
};

const inventoryNames = (fixture: Fixture): Record<string, string> => {
  const value: unknown = JSON.parse(
    readFileSync(join(fixture.root, 'inventory.json'), 'utf8')
  );
  if (!isRecord(value) || !isRecord(value.devices)) {
    throw new Error('Malformed fixture inventory.');
  }
  const names: Record<string, string> = {};
  for (const entries of Object.values(value.devices)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (isRecord(entry)) names[String(entry.udid)] = String(entry.name);
    }
  }
  return names;
};

const renames = (fixture: Fixture): string[] =>
  simctlCalls(fixture, 'rename').map(({ args }) => args.slice(2).join(' -> '));

// The pooled simulator takes the last segment of the branch, the simulator a
// removed worktree left behind goes back to a pool name, and a detach does the
// same for this worktree's own.
const branchNameCase = (): void => {
  const prefix = CONFIG.simulatorNamePrefix;
  const pooled = { udid: 'FIXTURE-NAME-0001', name: `${prefix} 1` };
  const orphan = { udid: 'FIXTURE-NAME-0002', name: `${prefix} gone` };
  const taken = { udid: 'FIXTURE-NAME-0003', name: `${prefix} naming` };
  const setup: FixtureSetup = {
    devices: [
      { ...pooled, state: 'Shutdown' },
      { ...orphan, state: 'Shutdown' },
      // Not managed, and it already holds the name this worktree would take.
      { ...taken, state: 'Shutdown' },
    ],
    branch: 'owner/feature/naming',
  };
  withFixture(setup, (fixture) => {
    const removed = {
      worktree: fixture.worktreeGone,
      simulatorUdid: orphan.udid,
      port: port(5),
    };
    writeFileSync(
      fixture.context.statePath,
      serializeState(state([pooled, orphan], [removed]))
    );

    const dryRun = runChild(fixture, ['run', '--dry-run']);
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.match(
      dryRun.stdout,
      new RegExp(`Simulator: ${prefix} naming 2 \\(${pooled.udid}\\)`)
    );
    assert.deepEqual(renames(fixture), [], 'a dry run renames nothing');

    const first = runChild(fixture, ['run']);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(renames(fixture), [
      `${pooled.udid} -> ${prefix} naming 2`,
      `${orphan.udid} -> ${prefix} 1`,
    ]);
    assert.match(
      first.stdout,
      new RegExp(`Simulator: ${prefix} naming 2 \\(${pooled.udid}\\)`)
    );
    assert.deepEqual(readRegistry(fixture).simulators, [
      { udid: pooled.udid, name: `${prefix} naming 2` },
      { udid: orphan.udid, name: `${prefix} 1` },
    ]);

    // A run on the same branch has nothing to rename.
    const second = runChild(fixture, ['run']);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(renames(fixture).length, 2);

    const detached = runChild(fixture, ['detach']);
    assert.equal(detached.status, 0, detached.stderr);
    assert.deepEqual(renames(fixture).slice(2), [
      `${pooled.udid} -> ${prefix} 2`,
    ]);
    assert.deepEqual(readRegistry(fixture).simulators, [
      { udid: pooled.udid, name: `${prefix} 2` },
      { udid: orphan.udid, name: `${prefix} 1` },
    ]);
    assert.deepEqual(inventoryNames(fixture), {
      [TEMPLATE_UDID]: 'iPhone Fixture',
      [pooled.udid]: `${prefix} 2`,
      [orphan.udid]: `${prefix} 1`,
      [taken.udid]: `${prefix} naming`,
    });
  });
};

interface VerificationCase {
  name: string;
  evidence: string;
  check: () => void;
}

const CASES: VerificationCase[] = [
  {
    name: 'boot a Shutdown device: inventory, boot, bootstatus',
    evidence: UNMODIFIED,
    check: () =>
      bootCase('Shutdown', ['simctl list', 'simctl boot', 'simctl bootstatus']),
  },
  {
    name: 'boot an already-Booted device: inventory, bootstatus, no boot',
    evidence: UNMODIFIED,
    check: () => bootCase('Booted', ['simctl list', 'simctl bootstatus']),
  },
  {
    name: 'non-dry run: persist, copy environment, boot, Metro defaults, Expo',
    evidence: UNMODIFIED,
    check: fullRunCase,
  },
  {
    name: 'delete: spawn error carries the UDID',
    evidence: UNMODIFIED,
    check: deleteSpawnErrorCase,
  },
  {
    name: 'delete: nonzero exit reports stderr',
    evidence: UNMODIFIED,
    check: () =>
      deleteTerminationCase(
        exitFailure('fixture: device is busy\n'),
        deleteDiagnostic('FIXTURE-DELETE-0002', 'fixture: device is busy')
      ),
  },
  {
    name: 'delete: nonzero exit falls back to stdout',
    evidence: UNMODIFIED,
    check: () =>
      deleteTerminationCase(
        exitFailure('', 'fixture: stdout diagnostic\n'),
        deleteDiagnostic('FIXTURE-DELETE-0002', 'fixture: stdout diagnostic')
      ),
  },
  {
    name: 'delete: termination by signal (null status) is a failure',
    evidence: UNMODIFIED,
    check: () =>
      deleteTerminationCase(
        { kind: 'signal' },
        'Could not delete FIXTURE-DELETE-0002: xcrun simctl delete FIXTURE-DELETE-0002 failed.'
      ),
  },
  {
    name: 'delete: success stays silent',
    evidence: UNMODIFIED,
    check: deleteSuccessCase,
  },
  {
    name: 'remove: mixed batch with the failure first',
    evidence: UNMODIFIED,
    check: () => mixedBatchCase('first'),
  },
  {
    name: 'remove: mixed batch with the failure last',
    evidence: UNMODIFIED,
    check: () => mixedBatchCase('last'),
  },
  {
    name: 'remove: shutdown warning does not stop a successful delete',
    evidence: UNMODIFIED,
    check: shutdownWarningCase,
  },
  {
    name: 'remove: failed delete on an unavailable runtime keeps its record',
    evidence: UNMODIFIED,
    check: unavailableRuntimeCase,
  },
  {
    name: 'remove: registry write failure with a deletion failure',
    evidence: READ_ONLY,
    check: () => removeWriteFailureCase(true),
  },
  {
    name: 'remove: registry write failure after successful deletions only',
    evidence: READ_ONLY,
    check: () => removeWriteFailureCase(false),
  },
  {
    name: 'allocation: created simulator, write fails, cleanup succeeds',
    evidence: READ_ONLY,
    check: () => createdRollbackCase(false),
  },
  {
    name: 'allocation: created simulator, write fails, cleanup fails',
    evidence: READ_ONLY,
    check: () => createdRollbackCase(true),
  },
  {
    name: 'allocation: pooled simulator, write fails, no delete attempt',
    evidence: READ_ONLY,
    check: pooledRollbackCase,
  },
  {
    name: 'names: branch on allocation, pool name on release and after a removed worktree',
    evidence: UNMODIFIED,
    check: branchNameCase,
  },
];

const verify = (): void => {
  let failed = 0;
  for (const { name, evidence, check } of CASES) {
    try {
      check();
      console.log(`ok    ${name} [${evidence}]`);
    } catch (error: unknown) {
      failed += 1;
      console.error(`FAIL  ${name} [${evidence}]\n${errorMessage(error)}`);
    }
  }
  console.log(
    `\n${CASES.length - failed} of ${CASES.length} cases passed. No case uses an instrumented copy or in-process fault injection.`
  );
  if (failed > 0) process.exitCode = 1;
};

const removeOptions = (args: string[]): CliOptions => ({
  command: 'remove',
  dryRun: false,
  force: args[1] === 'force',
  help: false,
  all: args[0] === 'all',
  confirmed: true,
  target: args[2],
});

// The child half: one exported function per process, reported the way the CLI
// reports it, so the parent asserts on the text a user would see.
const runChildAction = async (
  root: string,
  args: string[]
): Promise<number> => {
  const context = contextFor(root);
  const [action, ...rest] = args;
  if (action === 'boot') {
    bootSimulator(context, {
      worktree: context.worktree,
      simulatorUdid: rest[0] ?? '',
      port: Number(rest[1]),
    });
    return 0;
  }
  if (action === 'delete') {
    deleteSimulator(context, rest[0] ?? '');
    return 0;
  }
  if (action === 'remove') {
    await remove(context, removeOptions(rest));
    return 0;
  }
  if (action === 'run') {
    const result = await run(context, {
      command: 'run',
      dryRun: rest.includes('--dry-run'),
      force: false,
      help: false,
      all: false,
      confirmed: false,
    });
    return typeof result === 'number' ? result : 1;
  }
  if (action === 'detach') {
    await detach(context, {
      command: 'detach',
      dryRun: false,
      force: false,
      help: false,
      all: false,
      confirmed: false,
    });
    return 0;
  }
  throw new Error(`Unknown fixture action: ${action ?? ''}`);
};

const [mode, childRoot, ...childArgs] = process.argv.slice(2);
if (mode === CHILD_FLAG && childRoot) {
  runChildAction(childRoot, childArgs)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(`iOS worktree command failed: ${errorMessage(error)}`);
      process.exitCode = 1;
    });
} else {
  verify();
}
