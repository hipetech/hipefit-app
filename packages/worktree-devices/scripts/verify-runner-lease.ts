import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PortRange, WorktreeDevicesConfig } from '../src/config';
import type {
  Assignment,
  CliOptions,
  GitContext,
  ManagedSimulator,
  RegistryState,
  RunnerLease,
} from '../src/types';

import { detach } from '../src/commands/detach';
import { list } from '../src/commands/list';
import { run } from '../src/commands/run';
import { decodeState, serializeState } from '../src/core/registry';
import { sleep } from '../src/lib/async';
import { errorMessage } from '../src/lib/command';
import { isRecord } from '../src/lib/guards';
import { STATE_VERSION } from '../src/types';

// Assertion script for the runner lease and for Metro port synchronization.
// Run it with: bun run packages/worktree-devices/scripts/verify-runner-lease.ts
//
// Every command runs the unmodified modules in a child process whose PATH holds
// only the fake xcrun, git, pod, and ps written into a temporary fixture. The
// fakes allowlist exact argument shapes and exit 97 on anything else, so
// nothing here can reach Xcode, a real simulator, the real registry, or a real
// env file. The fake Expo can stay running until the script releases it, which
// stands in for a native build: a live runner with nothing on its Metro port.
// The only processes this script signals are children it started, and the only
// listeners on fixture ports are loopback servers it opened itself.

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const CHILD_FLAG = '--child';
const REJECTED = 'rejected';
const CHILD_TIMEOUT_MS = 60_000;
const HOLD = 'hold';

const CONFIG: WorktreeDevicesConfig = {
  appDirectory: 'apps/mobile',
  scheme: 'Fixture-dev',
  bundleIdentifier: 'com.example.fixture.development',
  environmentFile: '.env.development',
  environmentLocalName: '.env.local',
  simulatorNamePrefix: 'Fixture Worktree',
  registryName: 'fixture-registry',
  ports: { start: 39_460, end: 39_479 },
  reservedPorts: [],
};

const ENVIRONMENT_CONTENT = 'FIXTURE_ONLY=synthetic\n';
const RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-99-0';
const DEVICE_TYPE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-Fixture';
const TEMPLATE_UDID = 'FIXTURE-TEMPLATE-0000';
const CREATED_PREFIX = 'FIXTURE-CREATED-000';
const WORKTREE_NAMES = ['worktree-a', 'worktree-b', 'worktree-c'] as const;

// What the fake ps prints for a pid the scenario does not name: a start time
// older than any lease, which is what a genuine runner looks like.
const OLD_PROCESS_START = 'Sat Jan  1 00:00:00 2000';
// A start time later than any lease, which is what a reused pid looks like.
const LATER_PROCESS_START = 'Thu Jan  1 00:00:00 2099';

type WorktreeName = (typeof WORKTREE_NAMES)[number];
type ExpoBehavior = typeof HOLD | number;

const contextFor = (
  root: string,
  name: string,
  ports: PortRange
): GitContext => {
  const worktree = join(root, name);
  const mobileDirectory = join(worktree, CONFIG.appDirectory);
  return {
    config: { ...CONFIG, ports },
    worktree,
    commonGitDirectory: join(root, 'registry'),
    statePath: join(root, 'registry', `${CONFIG.registryName}.json`),
    lockPath: join(root, 'registry', `${CONFIG.registryName}.lock`),
    mobileDirectory,
    environmentSource: join(worktree, CONFIG.environmentFile),
    environmentDestination: join(mobileDirectory, CONFIG.environmentLocalName),
    iosDirectory: join(mobileDirectory, 'ios'),
  };
};

// The fake tools share one program. It is plain JavaScript because it runs
// outside this script's module graph, started by the shell wrappers in bin/.
// The fake Expo leaves when it is released, when it is signalled, when its
// runner is gone, or after a minute, so no fixture process outlives the script.
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
      cwd: process.cwd(),
      registry: readText(scenario.statePath),
    }) + '\\n'
  );
const succeed = (stdout = '') => {
  record('ok');
  process.stdout.write(stdout);
  process.exit(0);
};
const reject = () => {
  record('${REJECTED}');
  process.stderr.write('fixture rejected: ' + [tool, ...args].join(' ') + '\\n');
  process.exit(97);
};
const equals = (expected) =>
  args.length === expected.length && args.every((arg, index) => arg === expected[index]);
const allDevices = (inventory) => Object.values(inventory.devices).flat();
const findDevice = (inventory, udid) =>
  allDevices(inventory).find((device) => device.udid === udid);
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
    const created = allDevices(inventory).filter((device) =>
      device.udid.startsWith('${CREATED_PREFIX}')
    ).length;
    const createdUdid = '${CREATED_PREFIX}' + (created + 1);
    inventory.devices[runtime] = [
      ...(inventory.devices[runtime] ?? []),
      { udid: createdUdid, name, state: 'Shutdown', isAvailable: true, deviceTypeIdentifier: deviceType },
    ];
    writeInventory(inventory);
    succeed(createdUdid + '\\n');
  }
  if (!findDevice(inventory, udid)) reject();
  if (action === 'boot' && args.length === 3) {
    setState(udid, 'Booted');
    succeed();
  }
  if (action === 'bootstatus' && equals(['simctl', 'bootstatus', udid, '-b'])) succeed();
  if (action === 'shutdown' && args.length === 3) {
    setState(udid, 'Shutdown');
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
  succeed(scenario.worktrees.map((path) => 'worktree ' + path + '\\0HEAD 0000\\0\\0').join(''));
}
if (tool === 'pod') {
  if (!equals(['--version'])) reject();
  succeed('1.0.0\\n');
}
if (tool === 'ps') {
  if (!equals(['-o', 'lstart=', '-p', args[3]]) || !/^\\d+$/.test(args[3])) reject();
  succeed((scenario.processStarts[args[3]] ?? '${OLD_PROCESS_START}') + '\\n');
}
if (tool === 'expo') {
  const device = findDevice(readInventory(), args[4]);
  const worktree = scenario.worktrees.find((path) => process.cwd().startsWith(path + '/'));
  if (
    args.length !== 7 ||
    !equals(['run:ios', '--scheme', scenario.scheme, '--device', args[4], '--port', args[6]]) ||
    !device ||
    !worktree ||
    !/^\\d+$/.test(args[6])
  ) {
    reject();
  }
  const countPath = join(worktree, 'expo-count');
  const launch = Number(readText(countPath) ?? '0') + 1;
  writeFileSync(countPath, String(launch));
  const behavior = (scenario.expo[worktree] ?? [])[launch - 1] ?? 0;
  record('ok');
  if (behavior !== '${HOLD}') process.exit(behavior);
  const runner = process.ppid;
  const deadline = Date.now() + ${CHILD_TIMEOUT_MS};
  writeFileSync(join(worktree, 'expo-started-' + launch), '');
  setInterval(() => {
    if (existsSync(join(worktree, 'expo-release-' + launch))) process.exit(0);
    if (process.ppid !== runner || Date.now() > deadline) process.exit(96);
  }, 20);
} else {
  reject();
}
`;

interface FixtureDevice {
  udid: string;
  name: string;
  state: 'Booted' | 'Shutdown';
}

interface FixtureSetup {
  devices?: FixtureDevice[];
  ports?: PortRange;
  registry?: (fixture: Fixture) => RegistryState;
  expo?: Partial<Record<WorktreeName, ExpoBehavior[]>>;
  processStarts?: Record<string, string>;
}

interface ChildResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

interface StartedChild {
  pid: number;
  interrupt: () => void;
  done: Promise<ChildResult>;
}

interface Fixture {
  root: string;
  ports: PortRange;
  setup: FixtureSetup;
  statePath: string;
  cleanups: (() => void)[];
}

interface FakeCall {
  tool: string;
  args: string[];
  outcome: string;
  cwd: string;
  registry: string | null;
}

const context = (fixture: Fixture, name: WorktreeName): GitContext =>
  contextFor(fixture.root, name, fixture.ports);

const writeExecutable = (path: string, content: string): void => {
  writeFileSync(path, content, { mode: 0o755 });
};

const toolWrapper = (root: string, tool: string): string =>
  `#!/bin/sh\nexec '${process.execPath}' '${join(root, 'fake-tool.mjs')}' '${root}' ${tool} "$@"\n`;

const writeScenario = (fixture: Fixture): void => {
  const { setup } = fixture;
  const expo: Record<string, ExpoBehavior[]> = {};
  for (const name of WORKTREE_NAMES) {
    expo[join(fixture.root, name)] = setup.expo?.[name] ?? [];
  }
  writeFileSync(
    join(fixture.root, 'scenario.json'),
    JSON.stringify({
      statePath: fixture.statePath,
      bundleIdentifier: CONFIG.bundleIdentifier,
      scheme: CONFIG.scheme,
      ports: fixture.ports,
      worktrees: WORKTREE_NAMES.map((name) => join(fixture.root, name)),
      expo,
      processStarts: setup.processStarts ?? {},
    })
  );
};

const createFixture = (setup: FixtureSetup): Fixture => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'worktree-devices-runner-'))
  );
  const ports = setup.ports ?? CONFIG.ports;
  const fixture: Fixture = {
    root,
    ports,
    setup,
    statePath: contextFor(root, WORKTREE_NAMES[0], ports).statePath,
    cleanups: [],
  };
  for (const directory of ['bin', 'bin-without-ps', 'tmp', 'registry']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  writeFileSync(join(root, 'fake-tool.mjs'), FAKE_TOOL_SOURCE);
  for (const tool of ['xcrun', 'git', 'pod', 'ps']) {
    writeExecutable(join(root, 'bin', tool), toolWrapper(root, tool));
    if (tool === 'ps') continue;
    writeExecutable(
      join(root, 'bin-without-ps', tool),
      toolWrapper(root, tool)
    );
  }
  for (const name of WORKTREE_NAMES) {
    const worktree = context(fixture, name);
    const expoDirectory = join(
      worktree.mobileDirectory,
      'node_modules',
      '.bin'
    );
    mkdirSync(expoDirectory, { recursive: true });
    mkdirSync(join(worktree.iosDirectory, 'Pods'), { recursive: true });
    writeExecutable(join(expoDirectory, 'expo'), toolWrapper(root, 'expo'));
    writeFileSync(worktree.environmentSource, ENVIRONMENT_CONTENT);
    writeFileSync(join(worktree.iosDirectory, 'Podfile.lock'), 'PODFILE: {}\n');
  }
  const devices: FixtureDevice[] = [
    { udid: TEMPLATE_UDID, name: 'iPhone Fixture', state: 'Shutdown' },
    ...(setup.devices ?? []),
  ];
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
      ],
      devices: {
        [RUNTIME]: devices.map((device) => ({
          ...device,
          isAvailable: true,
          deviceTypeIdentifier: DEVICE_TYPE,
        })),
      },
    })
  );
  writeScenario(fixture);
  if (setup.registry) {
    writeFileSync(fixture.statePath, serializeState(setup.registry(fixture)));
  }
  return fixture;
};

const withFixture = async (
  setup: FixtureSetup,
  check: (fixture: Fixture) => Promise<void>
): Promise<void> => {
  const fixture = createFixture(setup);
  try {
    await check(fixture);
  } finally {
    fixture.cleanups.forEach((cleanup) => {
      cleanup();
    });
    rmSync(fixture.root, { recursive: true, force: true });
  }
};

// Starts one command in a child process. A child that is still running when
// its case ends, or after a minute, is killed, and the fake Expo it started
// leaves when it sees that its runner is gone.
const startChild = (
  fixture: Fixture,
  args: string[],
  toolDirectory = 'bin'
): StartedChild => {
  const child = spawn(
    process.execPath,
    [SCRIPT_PATH, CHILD_FLAG, fixture.root, ...args],
    {
      cwd: fixture.root,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: join(fixture.root, toolDirectory),
        HOME: fixture.root,
        TMPDIR: join(fixture.root, 'tmp'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const { pid } = child;
  if (pid === undefined) throw new Error('The fixture child did not start.');
  let stdout = '';
  let stderr = '';
  let exited = false;
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  const kill = (): void => {
    if (!exited) child.kill('SIGKILL');
  };
  const timer = setTimeout(kill, CHILD_TIMEOUT_MS);
  fixture.cleanups.push(kill);
  const done = new Promise<ChildResult>((resolveChild, reject) => {
    child.once('error', reject);
    child.once('close', (status, signal) => {
      exited = true;
      clearTimeout(timer);
      resolveChild({ status, signal, stdout, stderr });
    });
  });
  return {
    pid,
    interrupt: () => {
      child.kill('SIGINT');
    },
    done,
  };
};

const runChild = async (
  fixture: Fixture,
  args: string[],
  toolDirectory = 'bin'
): Promise<ChildResult> => startChild(fixture, args, toolDirectory).done;

const waitForFile = async (path: string): Promise<void> => {
  const deadline = Date.now() + CHILD_TIMEOUT_MS / 2;
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${path}`);
    await sleep(20);
  }
};

// Resolves once the fake Expo of that launch is running, which is the state a
// worktree is in during its native build.
const expoStarted = async (
  fixture: Fixture,
  name: WorktreeName,
  launch = 1
): Promise<void> =>
  waitForFile(join(fixture.root, name, `expo-started-${launch}`));

const releaseExpo = (
  fixture: Fixture,
  name: WorktreeName,
  launch = 1
): void => {
  writeFileSync(join(fixture.root, name, `expo-release-${launch}`), '');
};

// A loopback listener this script owns, standing in for whatever holds a port.
const listenOn = async (fixture: Fixture, port: number): Promise<void> => {
  const server = createServer((socket) => {
    socket.destroy();
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen({ port, host: '127.0.0.1' }, resolveListen);
  });
  fixture.cleanups.push(() => {
    server.close();
  });
};

// The pid of a child this script started and that has already exited.
const exitedPid = (): number => {
  const result = spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' });
  if (result.error) throw result.error;
  return result.pid;
};

const decodeCall = (line: string): FakeCall => {
  const value: unknown = JSON.parse(line);
  if (
    !isRecord(value) ||
    typeof value.tool !== 'string' ||
    !Array.isArray(value.args) ||
    typeof value.outcome !== 'string' ||
    typeof value.cwd !== 'string' ||
    (value.registry !== null && typeof value.registry !== 'string')
  ) {
    throw new Error(`Malformed fixture call record: ${line}`);
  }
  return {
    tool: value.tool,
    args: value.args.map(String),
    outcome: value.outcome,
    cwd: value.cwd,
    registry: value.registry,
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

const callsLabelled = (fixture: Fixture, wanted: string): FakeCall[] =>
  readCalls(fixture).filter((call) => label(call) === wanted);

const lastCall = (fixture: Fixture, wanted: string): FakeCall => {
  const call = callsLabelled(fixture, wanted).at(-1);
  assert.ok(call, `expected a "${wanted}" call`);
  return call;
};

const decodeRegistry = (fixture: Fixture, source: string): RegistryState => {
  const value: unknown = JSON.parse(source);
  return decodeState(value, fixture.ports);
};

const readRegistryText = (fixture: Fixture): string =>
  readFileSync(fixture.statePath, 'utf8');

const readRegistry = (fixture: Fixture): RegistryState =>
  decodeRegistry(fixture, readRegistryText(fixture));

const assignmentIn = (
  fixture: Fixture,
  registry: RegistryState,
  name: WorktreeName
): Assignment | undefined =>
  registry.assignments.find(
    ({ worktree }) => worktree === join(fixture.root, name)
  );

const assignmentOf = (fixture: Fixture, name: WorktreeName): Assignment => {
  const assignment = assignmentIn(fixture, readRegistry(fixture), name);
  assert.ok(assignment, `expected an assignment for ${name}`);
  return assignment;
};

const state = (
  simulators: ManagedSimulator[],
  assignments: Assignment[]
): RegistryState => ({ version: STATE_VERSION, assignments, simulators });

const port = (offset: number): number => CONFIG.ports.start + offset;

const leaseFor = (pid: number, startedAt = '2001-01-01T00:00:00.000Z') => ({
  pid,
  hostname: hostname(),
  startedAt,
});

const SIMULATOR_X = { udid: 'FIXTURE-POOL-000X', name: 'Fixture Pooled X' };
const SIMULATOR_Y = { udid: 'FIXTURE-POOL-000Y', name: 'Fixture Pooled Y' };

const DEVICES_XY: FixtureDevice[] = [
  { ...SIMULATOR_X, state: 'Shutdown' },
  { ...SIMULATOR_Y, state: 'Shutdown' },
];

// Worktree A holds simulator X on the first fixture port, optionally with a
// runner lease, and worktree B holds simulator Y the same way.
const assignedRegistry =
  (leaseA?: RunnerLease, leaseB?: RunnerLease) =>
  (fixture: Fixture): RegistryState => {
    const a: Assignment = {
      worktree: join(fixture.root, 'worktree-a'),
      simulatorUdid: SIMULATOR_X.udid,
      port: fixture.ports.start,
    };
    if (leaseA) a.runner = leaseA;
    const b: Assignment = {
      worktree: join(fixture.root, 'worktree-b'),
      simulatorUdid: SIMULATOR_Y.udid,
      port: fixture.ports.start + 1,
    };
    if (leaseB) b.runner = leaseB;
    return state([SIMULATOR_X, SIMULATOR_Y], leaseB ? [a, b] : [a]);
  };

const assertOwnLease = (lease: RunnerLease | undefined, pid: number): void => {
  assert.ok(lease, 'the assignment carries a runner lease');
  assert.equal(lease.pid, pid, 'the lease names the run command process');
  assert.equal(lease.hostname, hostname());
  assert.ok(!Number.isNaN(Date.parse(lease.startedAt)));
};

const leaseLifecycleCase = async (): Promise<void> =>
  withFixture({ expo: { 'worktree-a': [HOLD] } }, async (fixture) => {
    const runner = startChild(fixture, ['run', 'worktree-a']);
    await expoStarted(fixture, 'worktree-a');
    assertOwnLease(assignmentOf(fixture, 'worktree-a').runner, runner.pid);

    // Each fake call snapshots the registry, so these read what was on disk
    // when the tool ran: the lease is there before boot and before Expo.
    for (const wanted of ['simctl boot', 'expo run:ios']) {
      const { registry } = lastCall(fixture, wanted);
      assert.ok(registry, `the registry exists at "${wanted}"`);
      const assignment = assignmentIn(
        fixture,
        decodeRegistry(fixture, registry),
        'worktree-a'
      );
      assertOwnLease(assignment?.runner, runner.pid);
    }

    const during = await runChild(fixture, ['list', 'worktree-b']);
    assert.equal(during.status, 0, during.stderr);
    assert.match(
      during.stdout,
      new RegExp(
        `Metro port: \\d+ \\(idle\\)\\n {2}Runner: active \\(pid ${runner.pid} on this host, started `
      )
    );

    releaseExpo(fixture, 'worktree-a');
    const result = await runner.done;
    assert.equal(result.status, 0, result.stderr);
    assert.equal(assignmentOf(fixture, 'worktree-a').runner, undefined);
    assert.ok(!readRegistryText(fixture).includes('"runner"'));

    const after = await runChild(fixture, ['list', 'worktree-b']);
    assert.match(after.stdout, / {2}Runner: none\n/);
  });

const nonzeroExitCase = async (): Promise<void> =>
  withFixture({ expo: { 'worktree-a': [3] } }, async (fixture) => {
    const runner = startChild(fixture, ['run', 'worktree-a']);
    const result = await runner.done;
    assert.equal(result.status, 3, result.stderr);
    const { registry } = lastCall(fixture, 'expo run:ios');
    assert.ok(registry);
    assertOwnLease(
      assignmentIn(fixture, decodeRegistry(fixture, registry), 'worktree-a')
        ?.runner,
      runner.pid
    );
    const assignment = assignmentOf(fixture, 'worktree-a');
    assert.equal(assignment.runner, undefined);
    assert.equal(assignment.simulatorUdid, `${CREATED_PREFIX}1`);
  });

const interruptCase = async (): Promise<void> =>
  withFixture({ expo: { 'worktree-a': [HOLD] } }, async (fixture) => {
    const runner = startChild(fixture, ['run', 'worktree-a']);
    await expoStarted(fixture, 'worktree-a');
    assertOwnLease(assignmentOf(fixture, 'worktree-a').runner, runner.pid);
    runner.interrupt();
    const result = await runner.done;
    assert.equal(result.signal, 'SIGINT', 'the runner ends by the signal');
    assert.equal(assignmentOf(fixture, 'worktree-a').runner, undefined);
  });

const detachDuringBuildCase = async (): Promise<void> =>
  withFixture({ expo: { 'worktree-a': [HOLD] } }, async (fixture) => {
    const runner = startChild(fixture, ['run', 'worktree-a']);
    await expoStarted(fixture, 'worktree-a');
    const held = assignmentOf(fixture, 'worktree-a');
    assertOwnLease(held.runner, runner.pid);
    const before = readRegistryText(fixture);

    const refused = await runChild(fixture, ['detach', 'worktree-a']);
    assert.equal(refused.status, 1, 'detach refuses during the build');
    assert.ok(
      refused.stderr.includes(
        `A runner for this worktree is still active (pid ${runner.pid} on this host, started ${held.runner?.startedAt}). Stop it before detaching: interrupt it in its terminal, or run "bun run ios:worktree:stop" once Metro is serving. Pass --force to release the assignment anyway.`
      ),
      refused.stderr
    );
    assert.equal(readRegistryText(fixture), before, 'nothing was written');
    assert.deepEqual(callsLabelled(fixture, 'simctl shutdown'), []);

    const dry = await runChild(fixture, ['detach', 'worktree-a', 'dry']);
    assert.equal(dry.status, 0, dry.stderr);
    assert.ok(
      dry.stdout.includes(
        `Detach would refuse while the runner (pid ${runner.pid}) is active. Stop the runner, or pass --force.`
      ),
      dry.stdout
    );
    assert.ok(!dry.stdout.includes('(in use)'), 'nothing answers on the port');
    assert.equal(readRegistryText(fixture), before);

    // Worktree B cannot be handed the simulator A is building on.
    const second = await runChild(fixture, ['run', 'worktree-b']);
    assert.equal(second.status, 0, second.stderr);
    const other = assignmentOf(fixture, 'worktree-b');
    assert.notEqual(other.simulatorUdid, held.simulatorUdid);
    assert.notEqual(other.port, held.port);
    assert.deepEqual(assignmentOf(fixture, 'worktree-a'), held);

    const forced = await runChild(fixture, ['detach', 'worktree-a', 'force']);
    assert.equal(forced.status, 0, forced.stderr);
    assert.ok(
      forced.stdout.includes('Simulator returned to the managed pool.')
    );
    assert.equal(
      assignmentIn(fixture, readRegistry(fixture), 'worktree-a'),
      undefined
    );
    assert.equal(callsLabelled(fixture, 'simctl shutdown').length, 1);

    // The released simulator is now in the pool, and the first runner's exit
    // must not disturb the worktree that took it.
    const third = await runChild(fixture, ['run', 'worktree-c']);
    assert.equal(third.status, 0, third.stderr);
    assert.equal(
      assignmentOf(fixture, 'worktree-c').simulatorUdid,
      held.simulatorUdid
    );
    const settled = readRegistryText(fixture);
    releaseExpo(fixture, 'worktree-a');
    const result = await runner.done;
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readRegistryText(fixture), settled);
  });

const deadLeaseDetachCase = async (): Promise<void> => {
  const dead = exitedPid();
  await withFixture(
    {
      devices: DEVICES_XY,
      registry: assignedRegistry(leaseFor(dead), leaseFor(dead)),
    },
    async (fixture) => {
      const result = await runChild(fixture, ['detach', 'worktree-a']);
      assert.equal(result.status, 0, result.stderr);
      const registry = readRegistry(fixture);
      assert.equal(assignmentIn(fixture, registry, 'worktree-a'), undefined);
      // The write that detached A also drops the dead lease B was left with.
      const other = assignmentIn(fixture, registry, 'worktree-b');
      assert.ok(other);
      assert.equal(other.runner, undefined);
    }
  );
};

const deadLeaseRunCase = async (): Promise<void> => {
  const dead = exitedPid();
  await withFixture(
    {
      devices: DEVICES_XY,
      registry: assignedRegistry(leaseFor(dead), leaseFor(dead)),
      expo: { 'worktree-a': [HOLD] },
    },
    async (fixture) => {
      const runner = startChild(fixture, ['run', 'worktree-a']);
      await expoStarted(fixture, 'worktree-a');
      const lease = assignmentOf(fixture, 'worktree-a').runner;
      assertOwnLease(lease, runner.pid);
      assert.notEqual(lease?.startedAt, leaseFor(dead).startedAt);
      assert.equal(assignmentOf(fixture, 'worktree-b').runner, undefined);
      releaseExpo(fixture, 'worktree-a');
      const result = await runner.done;
      assert.equal(result.status, 0, result.stderr);
      assert.equal(assignmentOf(fixture, 'worktree-a').runner, undefined);
    }
  );
};

// The lease names this script's own pid, which is alive, so only the start
// time the fake ps reports decides whether the pid still means the runner.
const pidReuseCase = async (): Promise<void> =>
  withFixture(
    {
      devices: DEVICES_XY,
      registry: assignedRegistry(leaseFor(process.pid)),
    },
    async (fixture) => {
      const before = readRegistryText(fixture);
      const unknown = await runChild(
        fixture,
        ['detach', 'worktree-a'],
        'bin-without-ps'
      );
      assert.equal(unknown.status, 1, 'without ps the lease stays live');
      assert.ok(unknown.stderr.includes(`still active (pid ${process.pid} `));

      const genuine = await runChild(fixture, ['detach', 'worktree-a']);
      assert.equal(genuine.status, 1, 'an older process start keeps the lease');
      assert.equal(readRegistryText(fixture), before);

      fixture.setup.processStarts = {
        [String(process.pid)]: LATER_PROCESS_START,
      };
      writeScenario(fixture);
      const reused = await runChild(fixture, ['detach', 'worktree-a']);
      assert.equal(reused.status, 0, reused.stderr);
      assert.deepEqual(readRegistry(fixture).assignments, []);
      assert.deepEqual(
        callsLabelled(fixture, 'ps -o').map(({ args }) => args),
        [
          ['-o', 'lstart=', '-p', String(process.pid)],
          ['-o', 'lstart=', '-p', String(process.pid)],
        ]
      );
    }
  );

const secondRunCase = async (): Promise<void> =>
  withFixture({ expo: { 'worktree-a': [HOLD, 0] } }, async (fixture) => {
    const first = startChild(fixture, ['run', 'worktree-a']);
    await expoStarted(fixture, 'worktree-a');
    const held = assignmentOf(fixture, 'worktree-a');
    assertOwnLease(held.runner, first.pid);
    const before = readRegistryText(fixture);
    // Stands in for the first runner's Metro once its build has finished.
    await listenOn(fixture, held.port);

    const second = await runChild(fixture, ['run', 'worktree-a']);
    assert.equal(second.status, 0, second.stderr);
    assert.ok(
      second.stderr.includes(
        `Warning: Metro port ${held.port} is already in use, and a runner for this worktree is already active on it (pid ${first.pid} on this host, started ${held.runner?.startedAt}). Expo attaches to that dev server. Stop that runner if this run does not attach to it.`
      ),
      second.stderr
    );
    assert.equal(lastCall(fixture, 'expo run:ios').args[6], String(held.port));
    assert.equal(
      readRegistryText(fixture),
      before,
      'the second run neither took nor cleared the lease'
    );

    releaseExpo(fixture, 'worktree-a');
    const result = await first.done;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(assignmentOf(fixture, 'worktree-a'), {
      worktree: held.worktree,
      simulatorUdid: held.simulatorUdid,
      port: held.port,
    });
  });

const foreignListenerCase = async (): Promise<void> =>
  withFixture(
    { devices: DEVICES_XY, registry: assignedRegistry() },
    async (fixture) => {
      const occupied = port(0);
      await listenOn(fixture, occupied);
      const runner = startChild(fixture, ['run', 'worktree-a']);
      const result = await runner.done;
      assert.equal(result.status, 0, result.stderr);

      const assignment = assignmentOf(fixture, 'worktree-a');
      const moved = assignment.port;
      assert.notEqual(moved, occupied, 'the registry left the occupied port');
      assert.equal(assignment.runner, undefined);
      assert.ok(
        result.stderr.includes(
          `Warning: Metro port ${occupied} is held by a process that is not this worktree's runner, so this worktree moved to port ${moved}. The registry, the app's Metro location, and Expo all use ${moved}.`
        ),
        result.stderr
      );
      assert.ok(result.stdout.includes(`Metro port: ${moved}\n`));

      // The registry already carries the new port, with the lease, before
      // anything boots.
      const { registry } = lastCall(fixture, 'simctl bootstatus');
      assert.ok(registry);
      const atBoot = assignmentIn(
        fixture,
        decodeRegistry(fixture, registry),
        'worktree-a'
      );
      assert.equal(atBoot?.port, moved);
      assertOwnLease(atBoot?.runner, runner.pid);
      assert.deepEqual(lastCall(fixture, 'simctl spawn').args, [
        'simctl',
        'spawn',
        SIMULATOR_X.udid,
        'defaults',
        'write',
        CONFIG.bundleIdentifier,
        'RCT_jsLocation',
        `localhost:${moved}`,
      ]);
      assert.deepEqual(lastCall(fixture, 'expo run:ios').args, [
        'run:ios',
        '--scheme',
        CONFIG.scheme,
        '--device',
        SIMULATOR_X.udid,
        '--port',
        String(moved),
      ]);
    }
  );

const noFreePortCase = async (): Promise<void> => {
  const only = port(12);
  await withFixture(
    {
      devices: DEVICES_XY,
      ports: { start: only, end: only },
      registry: assignedRegistry(),
    },
    async (fixture) => {
      const before = readRegistryText(fixture);
      await listenOn(fixture, only);
      const result = await runChild(fixture, ['run', 'worktree-a']);
      assert.equal(result.status, 1);
      assert.ok(
        result.stderr.includes(
          `No available Metro port remains in ${only}-${only}.`
        ),
        result.stderr
      );
      assert.deepEqual(readCalls(fixture).map(label), [
        'xcrun --find',
        'pod --version',
        'simctl list',
        'git worktree',
      ]);
      assert.equal(readRegistryText(fixture), before, 'no lease was left');
      assert.ok(
        !existsSync(context(fixture, 'worktree-a').environmentDestination)
      );
    }
  );
};

const busyPortDetachCase = async (): Promise<void> =>
  withFixture(
    { devices: DEVICES_XY, registry: assignedRegistry() },
    async (fixture) => {
      const before = readRegistryText(fixture);
      await listenOn(fixture, port(0));
      const refused = await runChild(fixture, ['detach', 'worktree-a']);
      assert.equal(refused.status, 1);
      assert.ok(
        refused.stderr.includes(
          `Metro port ${port(0)} is still active. Stop the worktree runner before detaching, or pass --force to release the assignment anyway.`
        ),
        refused.stderr
      );
      assert.equal(readRegistryText(fixture), before);
      const forced = await runChild(fixture, ['detach', 'worktree-a', 'force']);
      assert.equal(forced.status, 0, forced.stderr);
      assert.deepEqual(readRegistry(fixture).assignments, []);
    }
  );

const dryRunCase = async (): Promise<void> => {
  await withFixture({}, async (fixture) => {
    const result = await runChild(fixture, ['run', 'worktree-a', 'dry']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!existsSync(fixture.statePath), 'a dry run writes no registry');
  });
  await withFixture(
    { devices: DEVICES_XY, registry: assignedRegistry() },
    async (fixture) => {
      const before = readRegistryText(fixture);
      const result = await runChild(fixture, ['run', 'worktree-a', 'dry']);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readRegistryText(fixture), before);
      assert.deepEqual(callsLabelled(fixture, 'expo run:ios'), []);
    }
  );
};

// Pure functions with no system access, so this case runs in this process.
const roundTripCase = async (): Promise<void> => {
  const lease = leaseFor(4242, '2026-01-02T03:04:05.678Z');
  const leased: Assignment = {
    worktree: '/fixture/a',
    simulatorUdid: SIMULATOR_X.udid,
    port: port(0),
    runner: lease,
  };
  const plain: Assignment = {
    worktree: '/fixture/b',
    simulatorUdid: SIMULATOR_Y.udid,
    port: port(1),
  };
  const original = state([SIMULATOR_X, SIMULATOR_Y], [leased, plain]);
  const decode = (source: string): RegistryState => {
    const value: unknown = JSON.parse(source);
    return decodeState(value, CONFIG.ports);
  };
  const decoded = decode(serializeState(original));
  assert.deepEqual(decoded, original);
  assert.equal(serializeState(decoded), serializeState(original));
  assert.ok(decoded.assignments[1]);
  assert.ok(
    !Object.hasOwn(decoded.assignments[1], 'runner'),
    'an assignment without a lease gets no runner key'
  );

  const malformed: unknown[] = [
    'not a lease',
    null,
    [],
    {},
    { ...lease, pid: 0 },
    { ...lease, pid: -1 },
    { ...lease, pid: 1.5 },
    { ...lease, pid: String(lease.pid) },
    { ...lease, pid: Number.MAX_SAFE_INTEGER + 1 },
    { ...lease, hostname: '' },
    { ...lease, hostname: 7 },
    { ...lease, startedAt: 'not a date' },
    { ...lease, startedAt: 0 },
    { pid: lease.pid, hostname: lease.hostname },
  ];
  for (const runner of malformed) {
    const source = JSON.stringify({
      version: STATE_VERSION,
      simulators: [SIMULATOR_X, SIMULATOR_Y],
      assignments: [{ ...leased, runner }, plain],
    });
    const result = decode(source);
    assert.equal(result.assignments.length, 2, JSON.stringify(runner));
    for (const assignment of result.assignments) {
      assert.ok(!Object.hasOwn(assignment, 'runner'), JSON.stringify(runner));
    }
  }

  const withoutLease = state([SIMULATOR_Y], [plain]);
  assert.deepEqual(decode(serializeState(withoutLease)), withoutLease);
};

interface VerificationCase {
  name: string;
  check: () => Promise<void>;
}

const CASES: VerificationCase[] = [
  {
    name: 'run: lease is on disk before boot and Expo, listed as active, gone after a normal exit',
    check: leaseLifecycleCase,
  },
  {
    name: 'run: lease is gone after Expo exits nonzero',
    check: nonzeroExitCase,
  },
  {
    name: 'run: lease is gone after the runner is interrupted with SIGINT',
    check: interruptCase,
  },
  {
    name: 'detach during a build: refuses, dry run reports it, another worktree gets another simulator, --force releases',
    check: detachDuringBuildCase,
  },
  {
    name: 'dead lease: detach proceeds and its write drops other dead leases',
    check: deadLeaseDetachCase,
  },
  {
    name: 'dead lease: the next run replaces it and drops other dead leases',
    check: deadLeaseRunCase,
  },
  {
    name: 'reused pid: a later process start ends the lease, an older one or no ps keeps it',
    check: pidReuseCase,
  },
  {
    name: 'second run in a worktree: keeps the port, warns, leaves the first lease alone',
    check: secondRunCase,
  },
  {
    name: 'foreign listener: registry, RCT_jsLocation, and Expo --port move to one new port',
    check: foreignListenerCase,
  },
  {
    name: 'foreign listener with no free port: fails before boot and launch, leaves no lease',
    check: noFreePortCase,
  },
  {
    name: 'detach: a port that answers still refuses without a lease, --force releases',
    check: busyPortDetachCase,
  },
  {
    name: 'dry run: takes no lease and writes nothing',
    check: dryRunCase,
  },
  {
    name: 'registry: a lease round-trips, a malformed lease is dropped, no lease still decodes',
    check: roundTripCase,
  },
];

const verify = async (): Promise<void> => {
  let failed = 0;
  for (const { name, check } of CASES) {
    try {
      await check();
      console.log(`ok    ${name}`);
    } catch (error: unknown) {
      failed += 1;
      console.error(`FAIL  ${name}\n${errorMessage(error)}`);
    }
  }
  console.log(
    `\n${CASES.length - failed} of ${CASES.length} cases passed. Every command ran the unmodified modules against fixture tools.`
  );
  if (failed > 0) process.exitCode = 1;
};

const readFixturePorts = (root: string): PortRange => {
  const value: unknown = JSON.parse(
    readFileSync(join(root, 'scenario.json'), 'utf8')
  );
  if (
    !isRecord(value) ||
    !isRecord(value.ports) ||
    typeof value.ports.start !== 'number' ||
    typeof value.ports.end !== 'number'
  ) {
    throw new Error('Malformed fixture scenario.');
  }
  return { start: value.ports.start, end: value.ports.end };
};

// The child half: one command per process, with the result handled the way
// the CLI handles it, so the parent asserts on what a user would see.
const runChildAction = async (
  root: string,
  args: string[]
): Promise<number | NodeJS.Signals> => {
  const [action, name, ...flags] = args;
  const childContext = contextFor(root, name ?? '', readFixturePorts(root));
  const options: CliOptions = {
    dryRun: flags.includes('dry'),
    force: flags.includes('force'),
    help: false,
    all: false,
    confirmed: false,
  };
  if (action === 'run')
    return run(childContext, { ...options, command: 'run' });
  if (action === 'detach') {
    await detach(childContext, { ...options, command: 'detach' });
    return 0;
  }
  if (action === 'list') {
    await list(childContext);
    return 0;
  }
  throw new Error(`Unknown fixture action: ${action ?? ''}`);
};

const [mode, childRoot, ...childArgs] = process.argv.slice(2);
if (mode === CHILD_FLAG && childRoot) {
  runChildAction(childRoot, childArgs)
    .then((result) => {
      if (typeof result === 'number') {
        process.exitCode = result;
        return;
      }
      process.kill(process.pid, result);
    })
    .catch((error: unknown) => {
      console.error(`iOS worktree command failed: ${errorMessage(error)}`);
      process.exitCode = 1;
    });
} else {
  await verify();
}
