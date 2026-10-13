import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorktreeDevicesConfig } from '../src/config';
import type {
  Assignment,
  GitContext,
  RegistryState,
  SimulatorChoice,
} from '../src/types';
import type { ChildProcess } from 'node:child_process';

import { hide } from '../src/commands/hide';
import { remove } from '../src/commands/remove';
import { show } from '../src/commands/show';
import { stop } from '../src/commands/stop';
import { decodeState, serializeState } from '../src/core/registry';
import { resolveChoice } from '../src/core/selector';
import { SIMULATOR_APP_PROCESS } from '../src/core/simulator-app';
import { errorMessage } from '../src/lib/command';
import { isRecord } from '../src/lib/guards';
import { HELP, parseOptions } from '../src/options';
import { STATE_VERSION } from '../src/types';

// Assertion script for target selection in show, hide, stop, and remove.
// Run it with: bun run packages/worktree-devices/scripts/verify-selection.ts
//
// Every case runs unmodified modules in a child process whose PATH holds only
// the fake xcrun, git, pgrep, pkill, open, lsof, and ps written into a temporary
// fixture. The fakes allowlist exact argument shapes and exit 97 on anything
// else, so nothing here can reach Xcode, a real simulator, the Simulator
// application, or the real registry. The fake lsof only ever prints the pid of
// a listener this script started, so stop can signal nothing else. For that
// pid the fake lsof and ps describe the Expo process of the worktree the port
// is assigned to, which is what stop requires before it signals. Listeners
// that stop must refuse are covered by scripts/verify-stop.ts.
//
// A terminal is simulated, not allocated: the interactive child marks its piped
// stdin as a TTY and the parent writes each answer after the prompt appears.
// That exercises the real readline question and close, but not raw-mode key
// handling, which stays a manual check in a real terminal.

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const COMMAND_CHILD = '--command-child';
const INTERACTIVE_CHILD = '--interactive-child';
const SELECTOR_CHILD = '--selector-child';
const LISTENER_CHILD = '--listener-child';
const REJECTED = 'rejected';
const CHILD_TIMEOUT_MS = 30_000;
const FAILURE_PREFIX = 'iOS worktree command failed: ';

// Stop probes whichever port an assignment holds, so the range is wide enough
// to accept the ephemeral ports the fixture listeners are given.
const CONFIG: WorktreeDevicesConfig = {
  appDirectory: 'apps/mobile',
  scheme: 'Fixture-dev',
  bundleIdentifier: 'com.example.fixture.development',
  environmentFile: '.env.development',
  environmentLocalName: '.env.local',
  simulatorNamePrefix: 'Fixture Worktree',
  registryName: 'fixture-registry',
  ports: { start: 1024, end: 65_535 },
  reservedPorts: [],
};

const RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-99-0';
const DEVICE_TYPE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-Fixture';
// Show, hide, and remove never probe a port, so these are never connected to.
const IDLE_PORT_BASE = 39_600;

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
const FAKE_TOOL_SOURCE = `import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [root, tool, ...args] = process.argv.slice(2);
const scenario = JSON.parse(readFileSync(join(root, 'scenario.json'), 'utf8'));
const inventoryPath = join(root, 'inventory.json');
const appMarker = join(root, 'simulator-app-running');
const readInventory = () => JSON.parse(readFileSync(inventoryPath, 'utf8'));
const record = (outcome) =>
  appendFileSync(join(root, 'calls.jsonl'), JSON.stringify({ tool, args, outcome }) + '\\n');
const succeed = (stdout = '') => {
  record('ok');
  process.stdout.write(stdout);
  process.exit(0);
};
const fail = (status) => {
  record('failed');
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

const simctl = () => {
  const [, action, udid] = args;
  const inventory = readInventory();
  if (equals(['simctl', 'list', '--json'])) succeed(JSON.stringify(inventory));
  const device = findDevice(inventory, udid);
  if (!device) reject();
  const save = () => writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
  if (action === 'boot' && args.length === 3) {
    device.state = 'Booted';
    save();
    succeed();
  }
  if (equals(['simctl', 'bootstatus', udid, '-b'])) succeed();
  if (action === 'shutdown' && args.length === 3) {
    device.state = 'Shutdown';
    save();
    succeed();
  }
  if (action === 'delete' && args.length === 3) {
    for (const runtime of Object.keys(inventory.devices)) {
      inventory.devices[runtime] = inventory.devices[runtime].filter(
        (entry) => entry.udid !== udid
      );
    }
    save();
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
if (tool === 'pgrep') {
  if (!equals(['-f', scenario.simulatorAppProcess])) reject();
  if (existsSync(appMarker)) succeed();
  fail(1);
}
if (tool === 'pkill') {
  if (!equals(['-9', '-f', scenario.simulatorAppProcess])) reject();
  rmSync(appMarker, { force: true });
  succeed();
}
if (tool === 'open') {
  if (!equals(['-a', 'Simulator', '--args', '-CurrentDeviceUDID', args[4]])) reject();
  if (!findDevice(readInventory(), args[4])) reject();
  writeFileSync(appMarker, '');
  succeed();
}
if (tool === 'lsof' && args[0] === '-a') {
  const evidence = scenario.evidence[args[2]];
  if (!evidence || !equals(['-a', '-p', args[2], '-d', 'cwd', '-Fn'])) reject();
  succeed('p' + args[2] + '\\nfcwd\\nn' + evidence.cwd + '\\n');
}
if (tool === 'ps') {
  const evidence = scenario.evidence[args[4]];
  if (!evidence || !equals(['-ww', '-o', 'ppid=,command=', '-p', args[4]])) reject();
  succeed('    1 ' + evidence.command + '\\n');
}
if (tool === 'lsof') {
  const port = /^tcp:(\\d+)$/.exec(args[1] ?? '')?.[1];
  if (!port || !equals(['-ti', 'tcp:' + port, '-sTCP:LISTEN'])) reject();
  const pid = scenario.listeners[port];
  if (pid === undefined) fail(1);
  succeed(String(pid) + '\\n');
}
reject();
`;

const FAKE_TOOLS = ['xcrun', 'git', 'pgrep', 'pkill', 'open', 'lsof', 'ps'];

type Owner = 'here' | 'b' | 'c';
type DeviceState = 'Booted' | 'Shutdown';

interface FixtureDevice {
  udid: string;
  name: string;
  state: DeviceState;
}

interface FixtureAssignment {
  owner: Owner;
  device: number;
  port: number;
}

interface Listener {
  child: ChildProcess;
  pid: number;
  port: number;
}

interface FixtureSetup {
  devices?: FixtureDevice[];
  assignments?: FixtureAssignment[];
  appRunning?: boolean;
  listeners?: Listener[];
}

interface Fixture {
  root: string;
  context: GitContext;
  worktrees: Record<Owner, string>;
}

interface FakeCall {
  tool: string;
  args: string[];
  outcome: string;
}

interface Step {
  after: string;
  send: string;
}

interface ChildResult {
  status: number | null;
  stdout: string;
  stderr: string;
  unsent: number;
}

interface SelectorRequest {
  choices: SimulatorChoice[];
  here: string;
  target?: string;
  emptyMessage?: string;
}

const udid = (index: number): string => `FIXTURE-ABCD-000${index}`;
const name = (index: number): string =>
  `${CONFIG.simulatorNamePrefix} ${index}`;
const device = (index: number, state: DeviceState): FixtureDevice => ({
  udid: udid(index),
  name: name(index),
  state,
});
const idlePort = (index: number): number => IDLE_PORT_BASE + index;
const assign = (
  owner: Owner,
  index: number,
  port = idlePort(index)
): FixtureAssignment => ({ owner, device: index, port });

const writeExecutable = (path: string, content: string): void => {
  writeFileSync(path, content, { mode: 0o755 });
};

const toolWrapper = (root: string, tool: string): string =>
  `#!/bin/sh\nexec '${process.execPath}' '${join(root, 'fake-tool.mjs')}' '${root}' ${tool} "$@"\n`;

const createFixture = (setup: FixtureSetup): Fixture => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'worktree-devices-selection-'))
  );
  const context = contextFor(root);
  const worktrees: Record<Owner, string> = {
    here: context.worktree,
    b: join(root, 'worktree-b'),
    c: join(root, 'worktree-c'),
  };
  for (const directory of [
    join(root, 'bin'),
    join(root, 'tmp'),
    join(root, 'locks'),
    context.commonGitDirectory,
    ...Object.values(worktrees).map((worktree) =>
      join(worktree, CONFIG.appDirectory)
    ),
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(join(root, 'fake-tool.mjs'), FAKE_TOOL_SOURCE);
  for (const tool of FAKE_TOOLS) {
    writeExecutable(join(root, 'bin', tool), toolWrapper(root, tool));
  }
  const devices = setup.devices ?? [];
  // Each fixture listener is presented as the Expo process `run` starts for
  // the assignment holding its port: that worktree's app directory and the
  // launcher's arguments.
  const evidence = Object.fromEntries(
    (setup.listeners ?? []).flatMap(({ pid, port }) => {
      const holder = (setup.assignments ?? []).find(
        (entry) => entry.port === port
      );
      if (!holder) return [];
      const worktree = worktrees[holder.owner];
      return [
        [
          String(pid),
          {
            cwd: join(worktree, CONFIG.appDirectory),
            command: `node ${join(worktree, 'node_modules', '.bin', 'expo')} run:ios --scheme ${CONFIG.scheme} --device ${udid(holder.device)} --port ${port}`,
          },
        ],
      ];
    })
  );
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
        [RUNTIME]: devices.map((entry) => ({
          ...entry,
          isAvailable: true,
          deviceTypeIdentifier: DEVICE_TYPE,
        })),
      },
    })
  );
  writeFileSync(
    join(root, 'scenario.json'),
    JSON.stringify({
      worktrees: Object.values(worktrees),
      simulatorAppProcess: SIMULATOR_APP_PROCESS,
      listeners: Object.fromEntries(
        (setup.listeners ?? []).map(({ port, pid }) => [String(port), pid])
      ),
      evidence,
    })
  );
  if (setup.appRunning) writeFileSync(join(root, 'simulator-app-running'), '');
  const assignments: Assignment[] = (setup.assignments ?? []).map(
    ({ owner, device: index, port }) => ({
      worktree: worktrees[owner],
      simulatorUdid: udid(index),
      port,
    })
  );
  const registry: RegistryState = {
    version: STATE_VERSION,
    assignments,
    simulators: devices.map((entry) => ({
      udid: entry.udid,
      name: entry.name,
    })),
  };
  writeFileSync(context.statePath, serializeState(registry));
  return { root, context, worktrees };
};

const withFixture = async (
  setup: FixtureSetup,
  check: (fixture: Fixture) => Promise<void>
): Promise<void> => {
  const fixture = createFixture(setup);
  try {
    await check(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
};

// Every child gets the fixture PATH and nothing else, including the listener,
// which runs no command at all.
const childEnvironment = (root: string): NodeJS.ProcessEnv => ({
  NODE_ENV: process.env.NODE_ENV,
  PATH: join(root, 'bin'),
  HOME: root,
  TMPDIR: join(root, 'tmp'),
});

// A scripted call has no stdin at all. The interactive child gets a pipe that
// stays open until it exits, and each answer is written only once its prompt
// has been printed, the way a person would type it.
const runChild = async (
  fixture: Fixture,
  mode: string,
  args: string[],
  steps?: Step[]
): Promise<ChildResult> =>
  new Promise<ChildResult>((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, mode, ...args], {
      cwd: fixture.root,
      env: childEnvironment(fixture.root),
      stdio: [steps ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    const pending = steps ?? [];
    let stdout = '';
    let stderr = '';
    let cursor = 0;
    let sent = 0;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectChild(
        new Error(
          `Fixture child timed out: ${args.join(' ')}\nstdout: ${stdout}\nstderr: ${stderr}`
        )
      );
    }, CHILD_TIMEOUT_MS);
    child.stdin?.on('error', () => undefined);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      for (let step = pending[sent]; step; step = pending[sent]) {
        const at = stdout.indexOf(step.after, cursor);
        if (at < 0) return;
        cursor = at + step.after.length;
        sent += 1;
        child.stdin?.write(step.send);
      }
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      rejectChild(error);
    });
    child.once('close', (status) => {
      clearTimeout(timer);
      resolveChild({ status, stdout, stderr, unsent: pending.length - sent });
    });
  });

const command = async (
  fixture: Fixture,
  args: string[],
  steps?: Step[]
): Promise<ChildResult> =>
  runChild(
    fixture,
    steps ? INTERACTIVE_CHILD : COMMAND_CHILD,
    [fixture.root, ...args],
    steps
  );

const selector = async (
  fixture: Fixture,
  request: SelectorRequest,
  steps?: Step[]
): Promise<ChildResult> =>
  runChild(
    fixture,
    SELECTOR_CHILD,
    [steps ? 'tty' : 'pipe', JSON.stringify(request)],
    steps
  );

const liveListeners = new Set<ChildProcess>();

const startListener = async (): Promise<Listener> =>
  new Promise<Listener>((resolveListener, rejectListener) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, LISTENER_CHILD], {
      env: { NODE_ENV: process.env.NODE_ENV, PATH: '' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    liveListeners.add(child);
    child.once('exit', () => liveListeners.delete(child));
    child.once('error', rejectListener);
    child.stdout?.setEncoding('utf8');
    child.stdout?.once('data', (chunk: string) => {
      const port = Number.parseInt(chunk.trim(), 10);
      if (!Number.isInteger(port) || child.pid === undefined) {
        rejectListener(new Error(`Fixture listener printed "${chunk}".`));
        return;
      }
      resolveListener({ child, pid: child.pid, port });
    });
  });

const hasExited = (listener: Listener): boolean =>
  listener.child.exitCode !== null || listener.child.signalCode !== null;

const waitForExit = async (listener: Listener): Promise<void> => {
  for (let attempt = 0; attempt < 100 && !hasExited(listener); attempt += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }
  assert.ok(hasExited(listener), 'the signalled fixture listener exited');
};

// Only listeners this script started are ever killed here.
const withListeners = async (
  count: number,
  check: (listeners: Listener[]) => Promise<void>
): Promise<void> => {
  const listeners: Listener[] = [];
  try {
    for (let index = 0; index < count; index += 1) {
      listeners.push(await startListener());
    }
    await check(listeners);
  } finally {
    listeners.forEach(({ child }) => child.kill('SIGKILL'));
  }
};

const listenerAt = (listeners: Listener[], index: number): Listener => {
  const listener = listeners[index];
  assert.ok(listener, `fixture listener ${index} exists`);
  return listener;
};

const decodeCall = (line: string): FakeCall => {
  const value: unknown = JSON.parse(line);
  if (
    !isRecord(value) ||
    typeof value.tool !== 'string' ||
    !Array.isArray(value.args) ||
    typeof value.outcome !== 'string'
  ) {
    throw new Error(`Malformed fixture call record: ${line}`);
  }
  return {
    tool: value.tool,
    args: value.args.map(String),
    outcome: value.outcome,
  };
};

const label = ({ tool, args }: FakeCall): string => {
  if (tool === 'xcrun' && args[0] === 'simctl') {
    return args[1] === 'list'
      ? 'simctl list'
      : `simctl ${args[1] ?? ''} ${args[2] ?? ''}`;
  }
  if (tool === 'open') return `open ${args[4] ?? ''}`;
  if (tool === 'lsof' && args[0] === '-a') return `lsof cwd ${args[2] ?? ''}`;
  if (tool === 'lsof') return `lsof ${args[1] ?? ''}`;
  if (tool === 'ps') return `ps ${args[4] ?? ''}`;
  if (tool === 'pgrep' || tool === 'pkill') return tool;
  return `${tool} ${args[0] ?? ''}`;
};

// Reading the log also proves the allowlist held: one rejected call fails the
// case, whatever the command under test made of the fake's exit status.
const calls = (fixture: Fixture): string[] => {
  const path = join(fixture.root, 'calls.jsonl');
  if (!existsSync(path)) return [];
  const entries = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map(decodeCall);
  assert.deepEqual(
    entries.filter(({ outcome }) => outcome === REJECTED).map(label),
    [],
    'the fake tools rejected a call outside the allowlist'
  );
  return entries.map(label);
};

// What every caller does before it selects: the prerequisite check, one
// inventory read, and the worktree list. None of it changes anything.
const DISCOVERY = ['xcrun --find', 'simctl list', 'git worktree'];
const after = (...mutations: string[]): string[] => [
  ...DISCOVERY,
  ...mutations,
];
// What stop reads before it signals: who listens on the port, then that
// process's command line and working directory.
const stopping = ({ pid, port }: Listener): string[] =>
  after(`lsof tcp:${port}`, `ps ${pid}`, `lsof cwd ${pid}`);

interface Snapshot {
  registry: string;
  inventory: string;
  appRunning: boolean;
  lockHeld: boolean;
}

const snapshot = (fixture: Fixture): Snapshot => ({
  registry: readFileSync(fixture.context.statePath, 'utf8'),
  inventory: readFileSync(join(fixture.root, 'inventory.json'), 'utf8'),
  appRunning: existsSync(join(fixture.root, 'simulator-app-running')),
  lockHeld: existsSync(fixture.context.lockPath),
});

const registryOf = (fixture: Fixture): RegistryState => {
  const value: unknown = JSON.parse(
    readFileSync(fixture.context.statePath, 'utf8')
  );
  return decodeState(value, CONFIG.ports);
};

const managedUdids = (fixture: Fixture): string[] =>
  registryOf(fixture).simulators.map((simulator) => simulator.udid);

const quoted = (indexes: number[]): string =>
  indexes.map((index) => `"${name(index)}"`).join(', ');

const TARGET_FORMS = 'a simulator name or a UDID';
const TARGET_FORMS_WITH_PORT =
  'a simulator name, a UDID, or an assigned Metro port';

const noDefault = (indexes: number[], forms: string): string =>
  `None of these simulators belongs to this worktree, so there is no default: ${quoted(indexes)}. Pass ${forms}.`;

const nothingSelected = (count: number, forms: string): string =>
  `No simulator was selected, and none of these belongs to this worktree. Enter a number between 1 and ${count}, or pass ${forms}.`;

const unknownTarget = (target: string, indexes: number[]): string =>
  `No managed simulator named "${target}". Known: ${quoted(indexes)}.`;

const NEEDS_CONFIRMATION =
  'Deleting needs a confirmation. Re-run with --yes when there is no terminal to ask.';
const CONFIRM_PROMPT = 'Delete them and everything installed on them? [y/N]: ';

const prompt = (count: number, preselected?: number): string =>
  preselected === undefined
    ? `Select a simulator [1-${count}]: `
    : `Select a simulator [1-${count}] (${preselected}): `;

const answer = (count: number, send: string, preselected?: number): Step => ({
  after: prompt(count, preselected),
  send,
});

// The command failed with exactly this message and did nothing but discovery:
// no boot, shutdown, delete, Simulator replacement, or process lookup, and the
// registry, the inventory, and the lock are as they were.
const assertRejected = async (
  fixture: Fixture,
  args: string[],
  message: string,
  steps?: Step[]
): Promise<ChildResult> => {
  const before = snapshot(fixture);
  const result = await command(fixture, args, steps);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(result.stderr, `${FAILURE_PREFIX}${message}\n`);
  assert.deepEqual(calls(fixture), DISCOVERY);
  assert.deepEqual(snapshot(fixture), before);
  assert.equal(result.unsent, 0, 'every scripted answer was asked for');
  return result;
};

const assertSucceeded = async (
  fixture: Fixture,
  args: string[],
  expectedCalls: string[],
  steps?: Step[]
): Promise<ChildResult> => {
  const result = await command(fixture, args, steps);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(calls(fixture), expectedCalls);
  assert.equal(result.unsent, 0, 'every scripted answer was asked for');
  assert.equal(existsSync(fixture.context.lockPath), false);
  return result;
};

const assertNoDefaultShown = (result: ChildResult, count: number): void => {
  assert.ok(result.stdout.includes('Managed simulators:'));
  assert.ok(result.stdout.includes(prompt(count)));
  assert.doesNotMatch(result.stdout, /^\*/m, 'no row is marked as default');
  assert.doesNotMatch(result.stdout, /\(\d+\): /, 'no default number is shown');
};

const assertNoPrompt = (result: ChildResult): void => {
  assert.ok(!result.stdout.includes('Managed simulators:'));
  assert.ok(!result.stdout.includes('Select a simulator'));
};

let passed = 0;
const verifyCase = async (
  title: string,
  check: () => Promise<void>
): Promise<void> => {
  try {
    await check();
  } catch (error: unknown) {
    console.error(`FAILED  ${title}`);
    throw error;
  }
  passed += 1;
  console.log(`ok  ${title}`);
};

const ENTER = '\n';
const BLANK = '   \n';

// Two other worktrees hold 1 and 2, and 3 is free. This worktree holds nothing.
const unownedSeveral = (state: DeviceState): FixtureSetup => ({
  devices: [device(1, state), device(2, state), device(3, state)],
  assignments: [assign('b', 1), assign('c', 2)],
});

// This worktree holds 2, which is not the first row, so a default that still
// pointed at index zero would land on the other worktree's simulator.
const ownedSecond = (state: DeviceState): FixtureSetup => ({
  devices: [device(1, state), device(2, state), device(3, state)],
  assignments: [assign('b', 1), assign('here', 2)],
});

const scriptedUnownedCases = async (): Promise<void> => {
  for (const subcommand of ['show', 'hide']) {
    // Show would boot a shut down device and hide would shut down a booted one,
    // so each starts from the state a wrong selection would visibly change.
    const state: DeviceState = subcommand === 'show' ? 'Shutdown' : 'Booted';
    await verifyCase(
      `${subcommand}: scripted, one free simulator, no target`,
      async () =>
        withFixture({ devices: [device(1, state)] }, async (fixture) => {
          await assertRejected(
            fixture,
            [subcommand],
            noDefault([1], TARGET_FORMS)
          );
        })
    );
    await verifyCase(
      `${subcommand}: scripted, one simulator of another worktree, no target`,
      async () =>
        withFixture(
          { devices: [device(1, state)], assignments: [assign('b', 1)] },
          async (fixture) => {
            await assertRejected(
              fixture,
              [subcommand],
              noDefault([1], TARGET_FORMS_WITH_PORT)
            );
          }
        )
    );
    await verifyCase(
      `${subcommand}: scripted, several unowned simulators, no target`,
      async () =>
        withFixture(unownedSeveral(state), async (fixture) => {
          await assertRejected(
            fixture,
            [subcommand],
            noDefault([1, 2, 3], TARGET_FORMS_WITH_PORT)
          );
        })
    );
  }

  await verifyCase(
    'stop: scripted, one serving port of another worktree, no target',
    async () =>
      withListeners(1, async (listeners) => {
        const serving = listenerAt(listeners, 0);
        await withFixture(
          {
            devices: [device(1, 'Booted')],
            assignments: [assign('b', 1, serving.port)],
            listeners,
          },
          async (fixture) => {
            await assertRejected(
              fixture,
              ['stop'],
              noDefault([1], TARGET_FORMS_WITH_PORT)
            );
            assert.equal(hasExited(serving), false, 'Metro was not signalled');
          }
        );
      })
  );
  await verifyCase(
    'stop: scripted, several serving ports of other worktrees, no target',
    async () =>
      withListeners(2, async (listeners) => {
        await withFixture(
          {
            devices: [
              device(1, 'Booted'),
              device(2, 'Booted'),
              device(3, 'Booted'),
            ],
            assignments: [
              assign('b', 1, listenerAt(listeners, 0).port),
              assign('c', 2, listenerAt(listeners, 1).port),
            ],
            listeners,
          },
          async (fixture) => {
            // The free simulator has no port, so stop does not offer it.
            await assertRejected(
              fixture,
              ['stop'],
              noDefault([1, 2], TARGET_FORMS_WITH_PORT)
            );
            assert.deepEqual(listeners.map(hasExited), [false, false]);
          }
        );
      })
  );

  for (const flags of [[], ['--yes']]) {
    const title = ['remove', ...flags].join(' ');
    await verifyCase(`${title}: scripted, one free simulator, no target`, () =>
      withFixture({ devices: [device(1, 'Booted')] }, async (fixture) => {
        await assertRejected(
          fixture,
          ['remove', ...flags],
          noDefault([1], TARGET_FORMS)
        );
      })
    );
    await verifyCase(
      `${title}: scripted, several free simulators while this worktree holds another`,
      () =>
        withFixture(
          {
            devices: [
              device(1, 'Booted'),
              device(2, 'Booted'),
              device(3, 'Booted'),
            ],
            assignments: [assign('here', 3)],
          },
          async (fixture) => {
            await assertRejected(
              fixture,
              ['remove', ...flags],
              noDefault([1, 2], TARGET_FORMS)
            );
          }
        )
    );
  }
  await verifyCase(
    'remove --force --yes: scripted, one simulator of another worktree, no target',
    () =>
      withFixture(
        { devices: [device(1, 'Booted')], assignments: [assign('b', 1)] },
        async (fixture) => {
          await assertRejected(
            fixture,
            ['remove', '--force', '--yes'],
            noDefault([1], TARGET_FORMS_WITH_PORT)
          );
        }
      )
  );
  await verifyCase(
    'remove --force --yes: scripted, several unowned simulators, no target',
    () =>
      withFixture(unownedSeveral('Booted'), async (fixture) => {
        await assertRejected(
          fixture,
          ['remove', '--force', '--yes'],
          noDefault([1, 2, 3], TARGET_FORMS_WITH_PORT)
        );
      })
  );
};

const interactiveUnownedCases = async (): Promise<void> => {
  const single: FixtureSetup = {
    devices: [device(1, 'Shutdown')],
    assignments: [assign('b', 1)],
  };
  for (const [title, input] of [
    ['Enter', ENTER],
    ['whitespace', BLANK],
  ] as const) {
    await verifyCase(
      `show: terminal, one unowned simulator, ${title} selects nothing`,
      () =>
        withFixture(single, async (fixture) => {
          const result = await assertRejected(
            fixture,
            ['show'],
            nothingSelected(1, TARGET_FORMS_WITH_PORT),
            [answer(1, input)]
          );
          assertNoDefaultShown(result, 1);
          assert.ok(
            result.stdout.includes(
              `  1) ${name(1)} (${udid(1)}) Shutdown, port ${idlePort(1)}, ${fixture.worktrees.b}\n`
            )
          );
        })
    );
    await verifyCase(
      `show: terminal, several unowned simulators, ${title} selects nothing`,
      () =>
        withFixture(unownedSeveral('Shutdown'), async (fixture) => {
          const result = await assertRejected(
            fixture,
            ['show'],
            nothingSelected(3, TARGET_FORMS_WITH_PORT),
            [answer(3, input)]
          );
          assertNoDefaultShown(result, 3);
        })
    );
  }
  await verifyCase('show: terminal, one unowned simulator, typed number', () =>
    withFixture(single, async (fixture) => {
      const result = await assertSucceeded(
        fixture,
        ['show'],
        after(
          `simctl boot ${udid(1)}`,
          `simctl bootstatus ${udid(1)}`,
          'pgrep',
          `open ${udid(1)}`
        ),
        [answer(1, '1\n')]
      );
      assertNoDefaultShown(result, 1);
    })
  );
  await verifyCase(
    'show: terminal, several unowned simulators, typed number',
    () =>
      withFixture(unownedSeveral('Shutdown'), async (fixture) => {
        await assertSucceeded(
          fixture,
          ['show'],
          after(
            `simctl boot ${udid(3)}`,
            `simctl bootstatus ${udid(3)}`,
            'pgrep',
            `open ${udid(3)}`
          ),
          [answer(3, '3\n')]
        );
      })
  );
  for (const input of ['0\n', '4\n', 'two\n']) {
    await verifyCase(
      `show: terminal, answer ${JSON.stringify(input)} is out of range`,
      () =>
        withFixture(unownedSeveral('Shutdown'), async (fixture) => {
          await assertRejected(
            fixture,
            ['show'],
            'Choose a number between 1 and 3.',
            [answer(3, input)]
          );
        })
    );
  }

  const freeBooted: FixtureSetup = { devices: [device(1, 'Booted')] };
  await verifyCase(
    'hide: terminal, one free simulator, Enter selects nothing',
    () =>
      withFixture(freeBooted, async (fixture) => {
        const result = await assertRejected(
          fixture,
          ['hide'],
          nothingSelected(1, TARGET_FORMS),
          [answer(1, ENTER)]
        );
        assertNoDefaultShown(result, 1);
      })
  );
  await verifyCase('hide: terminal, one free simulator, typed number', () =>
    withFixture(freeBooted, async (fixture) => {
      await assertSucceeded(
        fixture,
        ['hide'],
        after(`simctl shutdown ${udid(1)}`, 'pgrep'),
        [answer(1, '1\n')]
      );
    })
  );

  await verifyCase(
    'stop: terminal, one port of another worktree, Enter selects nothing',
    () =>
      withListeners(1, async (listeners) => {
        const serving = listenerAt(listeners, 0);
        await withFixture(
          {
            devices: [device(1, 'Booted')],
            assignments: [assign('b', 1, serving.port)],
            listeners,
          },
          async (fixture) => {
            const result = await assertRejected(
              fixture,
              ['stop'],
              nothingSelected(1, TARGET_FORMS_WITH_PORT),
              [answer(1, ENTER)]
            );
            assertNoDefaultShown(result, 1);
            assert.ok(result.stdout.includes(`port ${serving.port} serving`));
            assert.equal(hasExited(serving), false, 'Metro was not signalled');
          }
        );
      })
  );
  await verifyCase(
    'stop: terminal, one port of another worktree, typed number',
    () =>
      withListeners(1, async (listeners) => {
        const serving = listenerAt(listeners, 0);
        await withFixture(
          {
            devices: [device(1, 'Booted')],
            assignments: [assign('b', 1, serving.port)],
            listeners,
          },
          async (fixture) => {
            const result = await assertSucceeded(
              fixture,
              ['stop'],
              stopping(serving),
              [answer(1, '1\n')]
            );
            assert.ok(
              result.stdout.includes(
                `Stopped Metro on port ${serving.port} for ${fixture.worktrees.b}.`
              )
            );
            await waitForExit(serving);
          }
        );
      })
  );

  const freeShutdown: FixtureSetup = { devices: [device(1, 'Shutdown')] };
  for (const flags of [[], ['--yes']]) {
    const title = ['remove', ...flags].join(' ');
    await verifyCase(
      `${title}: terminal, one free simulator, Enter selects nothing`,
      () =>
        withFixture(freeShutdown, async (fixture) => {
          const result = await assertRejected(
            fixture,
            ['remove', ...flags],
            nothingSelected(1, TARGET_FORMS),
            [answer(1, ENTER)]
          );
          assertNoDefaultShown(result, 1);
          assert.ok(!result.stdout.includes('Deleting permanently:'));
        })
    );
  }
  await verifyCase(
    'remove: terminal, one free simulator, answer out of range',
    () =>
      withFixture(freeShutdown, async (fixture) => {
        await assertRejected(
          fixture,
          ['remove'],
          'Choose a number between 1 and 1.',
          [answer(1, '7\n')]
        );
      })
  );
  await verifyCase(
    'remove: terminal, typed number, then confirmed deletion',
    () =>
      withFixture(freeShutdown, async (fixture) => {
        await assertSucceeded(
          fixture,
          ['remove'],
          after(`simctl delete ${udid(1)}`),
          [answer(1, '1\n'), { after: CONFIRM_PROMPT, send: 'y\n' }]
        );
        assert.deepEqual(managedUdids(fixture), []);
      })
  );
  await verifyCase('remove: terminal, typed number, then declined', () =>
    withFixture(freeShutdown, async (fixture) => {
      const before = snapshot(fixture);
      const result = await assertSucceeded(fixture, ['remove'], DISCOVERY, [
        answer(1, '1\n'),
        { after: CONFIRM_PROMPT, send: ENTER },
      ]);
      assert.ok(result.stdout.includes('Nothing was deleted.'));
      assert.deepEqual(snapshot(fixture), before);
    })
  );
  await verifyCase(
    'remove --yes: terminal, typed number, no confirmation asked',
    () =>
      withFixture(freeShutdown, async (fixture) => {
        const result = await assertSucceeded(
          fixture,
          ['remove', '--yes'],
          after(`simctl delete ${udid(1)}`),
          [answer(1, '1\n')]
        );
        assert.ok(!result.stdout.includes(CONFIRM_PROMPT));
      })
  );
  await verifyCase(
    'remove --force: terminal, several unowned simulators, Enter selects nothing',
    () =>
      withFixture(unownedSeveral('Shutdown'), async (fixture) => {
        const result = await assertRejected(
          fixture,
          ['remove', '--force'],
          nothingSelected(3, TARGET_FORMS_WITH_PORT),
          [answer(3, ENTER)]
        );
        assertNoDefaultShown(result, 3);
      })
  );
};

const ownedCases = async (): Promise<void> => {
  const showSecond = after(
    `simctl boot ${udid(2)}`,
    `simctl bootstatus ${udid(2)}`,
    'pgrep',
    `open ${udid(2)}`
  );
  await verifyCase(
    'show: scripted, owned simulator in the second row is the default',
    () =>
      withFixture(ownedSecond('Shutdown'), async (fixture) => {
        const result = await assertSucceeded(fixture, ['show'], showSecond);
        assertNoPrompt(result);
        assert.ok(
          result.stdout.includes(
            `Defaulting to ${name(2)}. Pass a name to choose another.`
          )
        );
      })
  );
  await verifyCase(
    'hide: scripted, owned simulator in the second row is the default',
    () =>
      withFixture(ownedSecond('Booted'), async (fixture) => {
        await assertSucceeded(
          fixture,
          ['hide'],
          after(`simctl shutdown ${udid(2)}`, 'pgrep')
        );
      })
  );
  await verifyCase(
    'stop: scripted, owned port in the second row is the default',
    () =>
      withListeners(2, async (listeners) => {
        const other = listenerAt(listeners, 0);
        const own = listenerAt(listeners, 1);
        await withFixture(
          {
            devices: [device(1, 'Booted'), device(2, 'Booted')],
            assignments: [
              assign('b', 1, other.port),
              assign('here', 2, own.port),
            ],
            listeners,
          },
          async (fixture) => {
            const result = await assertSucceeded(
              fixture,
              ['stop'],
              stopping(own)
            );
            assert.ok(
              result.stdout.includes(
                `Stopped Metro on port ${own.port} for ${fixture.worktrees.here}.`
              )
            );
            await waitForExit(own);
            assert.equal(hasExited(other), false, 'only the owned port stops');
          }
        );
      })
  );
  await verifyCase(
    'show: terminal, Enter takes the marked owned simulator in the second row',
    () =>
      withFixture(ownedSecond('Shutdown'), async (fixture) => {
        const result = await assertSucceeded(fixture, ['show'], showSecond, [
          answer(3, ENTER, 2),
        ]);
        assert.deepEqual(
          result.stdout.split('\n').filter((line) => line.startsWith('*')),
          [
            `* 2) ${name(2)} (${udid(2)}) Shutdown, port ${idlePort(2)}, this worktree`,
          ]
        );
      })
  );
  await verifyCase(
    'show: terminal, a typed number overrides the owned default',
    () =>
      withFixture(ownedSecond('Shutdown'), async (fixture) => {
        await assertSucceeded(
          fixture,
          ['show'],
          after(
            `simctl boot ${udid(1)}`,
            `simctl bootstatus ${udid(1)}`,
            'pgrep',
            `open ${udid(1)}`
          ),
          [answer(3, '1\n', 2)]
        );
      })
  );
  await verifyCase(
    'show: terminal, out-of-range answer with an owned default',
    () =>
      withFixture(ownedSecond('Shutdown'), async (fixture) => {
        await assertRejected(
          fixture,
          ['show'],
          'Choose a number between 1 and 3.',
          [answer(3, '9\n', 2)]
        );
      })
  );

  const ownedOnly: FixtureSetup = {
    devices: [device(2, 'Shutdown')],
    assignments: [assign('here', 2)],
  };
  await verifyCase('show: scripted, owned singleton needs no target', () =>
    withFixture(ownedOnly, async (fixture) => {
      const result = await assertSucceeded(fixture, ['show'], showSecond);
      assertNoPrompt(result);
      assert.ok(!result.stdout.includes('Defaulting to'));
    })
  );
  await verifyCase('show: terminal, owned singleton is taken unasked', () =>
    withFixture(ownedOnly, async (fixture) => {
      const result = await assertSucceeded(fixture, ['show'], showSecond, []);
      assertNoPrompt(result);
    })
  );
  await verifyCase('hide: terminal, owned singleton is taken unasked', () =>
    withFixture(
      { devices: [device(2, 'Booted')], assignments: [assign('here', 2)] },
      async (fixture) => {
        const result = await assertSucceeded(
          fixture,
          ['hide'],
          after(`simctl shutdown ${udid(2)}`, 'pgrep'),
          []
        );
        assertNoPrompt(result);
      }
    )
  );
  await verifyCase('stop: terminal, owned singleton is taken unasked', () =>
    withListeners(1, async (listeners) => {
      const own = listenerAt(listeners, 0);
      await withFixture(
        {
          devices: [device(2, 'Booted')],
          assignments: [assign('here', 2, own.port)],
          listeners,
        },
        async (fixture) => {
          const result = await assertSucceeded(
            fixture,
            ['stop'],
            stopping(own),
            []
          );
          assertNoPrompt(result);
          await waitForExit(own);
        }
      );
    })
  );

  const forced: FixtureSetup = {
    devices: [device(1, 'Shutdown'), device(2, 'Shutdown')],
    assignments: [assign('b', 1), assign('here', 2)],
  };
  await verifyCase(
    "remove --force --yes: scripted, takes this worktree's assignment",
    () =>
      withFixture(forced, async (fixture) => {
        await assertSucceeded(
          fixture,
          ['remove', '--force', '--yes'],
          after(`simctl delete ${udid(2)}`)
        );
        const registry = registryOf(fixture);
        assert.deepEqual(managedUdids(fixture), [udid(1)]);
        assert.deepEqual(
          registry.assignments.map((entry) => entry.worktree),
          [fixture.worktrees.b]
        );
      })
  );
  await verifyCase(
    "remove --force: terminal, Enter takes this worktree's assignment, then confirmed",
    () =>
      withFixture(forced, async (fixture) => {
        await assertSucceeded(
          fixture,
          ['remove', '--force'],
          after(`simctl delete ${udid(2)}`),
          [answer(2, ENTER, 2), { after: CONFIRM_PROMPT, send: 'yes\n' }]
        );
        assert.deepEqual(managedUdids(fixture), [udid(1)]);
      })
  );
  await verifyCase(
    'remove --force: scripted, owned default still needs --yes',
    () =>
      withFixture(forced, async (fixture) => {
        await assertRejected(
          fixture,
          ['remove', '--force'],
          NEEDS_CONFIRMATION
        );
      })
  );
};

const explicitTargetCases = async (): Promise<void> => {
  const showOf = (index: number): string[] =>
    after(
      `simctl boot ${udid(index)}`,
      `simctl bootstatus ${udid(index)}`,
      'pgrep',
      `open ${udid(index)}`
    );
  for (const [title, target, index] of [
    ['name in another case with padding', `  ${name(1).toUpperCase()} `, 1],
    ['lowercase UDID of a free simulator', udid(3).toLowerCase(), 3],
    ['assigned port of another worktree', String(idlePort(1)), 1],
  ] as const) {
    await verifyCase(`show: explicit ${title}`, () =>
      withFixture(ownedSecond('Shutdown'), async (fixture) => {
        const result = await assertSucceeded(
          fixture,
          ['show', target],
          showOf(index)
        );
        assertNoPrompt(result);
      })
    );
  }
  await verifyCase('show: terminal, explicit target is not asked about', () =>
    withFixture(unownedSeveral('Shutdown'), async (fixture) => {
      const result = await assertSucceeded(
        fixture,
        ['show', name(3)],
        showOf(3),
        []
      );
      assertNoPrompt(result);
    })
  );
  await verifyCase('hide: explicit assigned port of another worktree', () =>
    withFixture(unownedSeveral('Booted'), async (fixture) => {
      await assertSucceeded(
        fixture,
        ['hide', String(idlePort(2))],
        after(`simctl shutdown ${udid(2)}`, 'pgrep')
      );
    })
  );
  for (const subcommand of ['show', 'hide']) {
    await verifyCase(`${subcommand}: unknown explicit target`, () =>
      withFixture(ownedSecond('Booted'), async (fixture) => {
        await assertRejected(
          fixture,
          [subcommand, 'nope'],
          unknownTarget('nope', [1, 2, 3])
        );
      })
    );
    await verifyCase(`${subcommand}: nothing managed`, () =>
      withFixture({}, async (fixture) => {
        await assertRejected(
          fixture,
          [subcommand],
          'No managed simulator exists yet. Run "bun run ios:worktree" first.'
        );
      })
    );
  }
  // A free simulator has no port, so a port number never names it.
  await verifyCase('show: a port nobody holds is an unknown target', () =>
    withFixture(ownedSecond('Shutdown'), async (fixture) => {
      await assertRejected(
        fixture,
        ['show', String(idlePort(3))],
        unknownTarget(String(idlePort(3)), [1, 2, 3])
      );
    })
  );

  for (const [title, targetOf] of [
    ['name', (): string => name(1)],
    ['port', (listener: Listener): string => String(listener.port)],
  ] as const) {
    await verifyCase(`stop: explicit ${title} of another worktree`, () =>
      withListeners(2, async (listeners) => {
        const other = listenerAt(listeners, 0);
        const own = listenerAt(listeners, 1);
        await withFixture(
          {
            devices: [device(1, 'Booted'), device(2, 'Booted')],
            assignments: [
              assign('b', 1, other.port),
              assign('here', 2, own.port),
            ],
            listeners,
          },
          async (fixture) => {
            await assertSucceeded(
              fixture,
              ['stop', targetOf(other)],
              stopping(other)
            );
            await waitForExit(other);
            assert.equal(hasExited(own), false, 'only the named port stops');
          }
        );
      })
    );
  }
  await verifyCase('stop: a free simulator is not a stop target', () =>
    withListeners(1, async (listeners) => {
      const serving = listenerAt(listeners, 0);
      await withFixture(
        {
          devices: [device(1, 'Booted'), device(2, 'Booted')],
          assignments: [assign('b', 1, serving.port)],
          listeners,
        },
        async (fixture) => {
          await assertRejected(
            fixture,
            ['stop', name(2)],
            unknownTarget(name(2), [1])
          );
          assert.equal(hasExited(serving), false);
        }
      );
    })
  );
  await verifyCase('stop: no reserved port', () =>
    withFixture({ devices: [device(1, 'Booted')] }, async (fixture) => {
      await assertRejected(
        fixture,
        ['stop'],
        'No worktree has a reserved Metro port. Run "bun run ios:worktree" first.'
      );
    })
  );

  // 1 belongs to another worktree, 2 to this one, 3 is free.
  const mixed = ownedSecond('Shutdown');
  await verifyCase('remove --yes: explicit free simulator', () =>
    withFixture(mixed, async (fixture) => {
      await assertSucceeded(
        fixture,
        ['remove', name(3), '--yes'],
        after(`simctl delete ${udid(3)}`)
      );
      assert.deepEqual(managedUdids(fixture), [udid(1), udid(2)]);
      assert.equal(registryOf(fixture).assignments.length, 2);
    })
  );
  await verifyCase('remove: scripted, explicit target still needs --yes', () =>
    withFixture(mixed, async (fixture) => {
      await assertRejected(fixture, ['remove', name(3)], NEEDS_CONFIRMATION);
    })
  );
  for (const index of [1, 2]) {
    await verifyCase(
      `remove --yes: assigned simulator ${index} is refused without --force`,
      () =>
        withFixture(mixed, async (fixture) => {
          await assertRejected(
            fixture,
            ['remove', name(index), '--yes'],
            unknownTarget(name(index), [3])
          );
        })
    );
  }
  await verifyCase(
    "remove --force --yes: explicit name of another worktree's simulator",
    () =>
      withFixture(mixed, async (fixture) => {
        await assertSucceeded(
          fixture,
          ['remove', name(1), '--force', '--yes'],
          after(`simctl delete ${udid(1)}`)
        );
        assert.deepEqual(managedUdids(fixture), [udid(2), udid(3)]);
        assert.deepEqual(
          registryOf(fixture).assignments.map((entry) => entry.worktree),
          [fixture.worktrees.here]
        );
      })
  );
  await verifyCase(
    'remove --force --yes: explicit assigned port of another worktree',
    () =>
      withFixture(mixed, async (fixture) => {
        await assertSucceeded(
          fixture,
          ['remove', String(idlePort(1)), '--force', '--yes'],
          after(`simctl delete ${udid(1)}`)
        );
      })
  );
  await verifyCase(
    'remove --force: scripted, explicit assigned target still needs --yes',
    () =>
      withFixture(mixed, async (fixture) => {
        await assertRejected(
          fixture,
          ['remove', name(1), '--force'],
          NEEDS_CONFIRMATION
        );
      })
  );
  await verifyCase(
    'remove --force: terminal, explicit assigned target, declined',
    () =>
      withFixture(mixed, async (fixture) => {
        const before = snapshot(fixture);
        const result = await assertSucceeded(
          fixture,
          ['remove', name(1), '--force'],
          DISCOVERY,
          [{ after: CONFIRM_PROMPT, send: 'n\n' }]
        );
        assertNoPrompt(result);
        assert.deepEqual(snapshot(fixture), before);
      })
  );
  await verifyCase('remove: every simulator is assigned', () =>
    withFixture(
      { devices: [device(1, 'Shutdown')], assignments: [assign('b', 1)] },
      async (fixture) => {
        await assertRejected(
          fixture,
          ['remove', '--yes'],
          'Every managed simulator is assigned to a worktree. Detach one first, or pass --force.'
        );
      }
    )
  );
  await verifyCase('remove --force: nothing managed', () =>
    withFixture({}, async (fixture) => {
      await assertRejected(
        fixture,
        ['remove', '--force', '--yes'],
        'No managed simulator exists.'
      );
    })
  );
};

const bulkCases = async (): Promise<void> => {
  await verifyCase('hide --all: closes Simulator and shuts nothing down', () =>
    withFixture(
      { ...unownedSeveral('Booted'), appRunning: true },
      async (fixture) => {
        const inventory = snapshot(fixture).inventory;
        const result = await assertSucceeded(
          fixture,
          ['hide', '--all'],
          after('pgrep', 'pkill', 'pgrep')
        );
        assertNoPrompt(result);
        assert.ok(result.stdout.includes('Closed Simulator.'));
        for (const index of [1, 2, 3]) {
          assert.ok(
            result.stdout.includes(
              `  ${name(index)} (${udid(index)}) still running`
            )
          );
        }
        assert.equal(snapshot(fixture).inventory, inventory);
        assert.equal(snapshot(fixture).appRunning, false);
      }
    )
  );
  await verifyCase('hide --all: Simulator is not running', () =>
    withFixture(unownedSeveral('Booted'), async (fixture) => {
      const before = snapshot(fixture);
      const result = await assertSucceeded(
        fixture,
        ['hide', '--all'],
        after('pgrep')
      );
      assert.ok(result.stdout.includes('Simulator is not running.'));
      assert.deepEqual(snapshot(fixture), before);
    })
  );

  // 1 belongs to another worktree, 3 to this one, 2 and 4 are free.
  const pool: FixtureSetup = {
    devices: [1, 2, 3, 4].map((index) => device(index, 'Shutdown')),
    assignments: [assign('b', 1), assign('here', 3)],
  };
  await verifyCase('remove --all --yes: deletes the free pool only', () =>
    withFixture(pool, async (fixture) => {
      const result = await assertSucceeded(
        fixture,
        ['remove', '--all', '--yes'],
        after(`simctl delete ${udid(2)}`, `simctl delete ${udid(4)}`)
      );
      assertNoPrompt(result);
      assert.deepEqual(managedUdids(fixture), [udid(1), udid(3)]);
      assert.equal(registryOf(fixture).assignments.length, 2);
    })
  );
  await verifyCase(
    'remove --all --force --yes: deletes every managed simulator',
    () =>
      withFixture(pool, async (fixture) => {
        await assertSucceeded(
          fixture,
          ['remove', '--all', '--force', '--yes'],
          after(...[1, 2, 3, 4].map((index) => `simctl delete ${udid(index)}`))
        );
        assert.deepEqual(registryOf(fixture).simulators, []);
        assert.deepEqual(registryOf(fixture).assignments, []);
      })
  );
  for (const flags of [['--all'], ['--all', '--force']]) {
    await verifyCase(
      `remove ${flags.join(' ')}: scripted, still needs --yes`,
      () =>
        withFixture(pool, async (fixture) => {
          await assertRejected(
            fixture,
            ['remove', ...flags],
            NEEDS_CONFIRMATION
          );
        })
    );
  }
  await verifyCase('remove --all: terminal, confirmed without a picker', () =>
    withFixture(pool, async (fixture) => {
      const result = await assertSucceeded(
        fixture,
        ['remove', '--all'],
        after(`simctl delete ${udid(2)}`, `simctl delete ${udid(4)}`),
        [{ after: CONFIRM_PROMPT, send: 'y\n' }]
      );
      assertNoPrompt(result);
    })
  );
  await verifyCase('remove --all --yes: nothing is free', () =>
    withFixture(
      { devices: [device(1, 'Shutdown')], assignments: [assign('b', 1)] },
      async (fixture) => {
        const before = snapshot(fixture);
        const result = await assertSucceeded(
          fixture,
          ['remove', '--all', '--yes'],
          DISCOVERY
        );
        assert.ok(result.stdout.includes('No managed simulator is free.'));
        assert.deepEqual(snapshot(fixture), before);
      }
    )
  );
};

const HERE = '/fixture/here';
const OTHER = '/fixture/other';

const choice = (
  index: number,
  worktree?: string,
  port?: number
): SimulatorChoice => ({
  simulator: { udid: udid(index), name: name(index) },
  worktree,
  port,
});

// The selector on its own, with choices no caller would build, so the matching
// and prompt rules are pinned apart from any one command's candidate list.
const selectorCases = async (): Promise<void> => {
  const unowned = [choice(1, OTHER, 5001), choice(2)];
  const owned = [choice(1, OTHER, 5001), choice(2), choice(3, HERE, 5003)];
  const selected = (index: number): string => `SELECTED ${udid(index)}\n`;
  const failed = (message: string): string => `${FAILURE_PREFIX}${message}\n`;

  await withFixture({}, async (fixture) => {
    const expectSelected = async (
      title: string,
      request: SelectorRequest,
      index: number,
      steps?: Step[]
    ): Promise<ChildResult> => {
      let result: ChildResult | undefined;
      await verifyCase(`selector: ${title}`, async () => {
        result = await selector(fixture, request, steps);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(result.stdout.endsWith(selected(index)), result.stdout);
        assert.equal(result.unsent, 0);
      });
      assert.ok(result);
      return result;
    };
    const expectFailed = async (
      title: string,
      request: SelectorRequest,
      message: string,
      steps?: Step[]
    ): Promise<void> =>
      verifyCase(`selector: ${title}`, async () => {
        const result = await selector(fixture, request, steps);
        assert.equal(result.status, 1, result.stdout);
        assert.equal(result.stderr, failed(message));
        assert.ok(!result.stdout.includes('SELECTED'));
        assert.equal(result.unsent, 0);
      });

    for (const [title, target, index] of [
      ['padded name in another case', `\t${name(2).toLowerCase()}  `, 2],
      ['uppercase name', name(1).toUpperCase(), 1],
      ['lowercase UDID', udid(2).toLowerCase(), 2],
      ['padded UDID', ` ${udid(1)} `, 1],
      ['assigned port', '5001', 1],
      ['padded assigned port', ' 5003 ', 3],
    ] as const) {
      await expectSelected(
        `scripted, explicit ${title}`,
        { choices: owned, here: HERE, target },
        index
      );
    }
    const explicit = await expectSelected(
      'terminal, explicit target wins over the owned default unasked',
      { choices: owned, here: HERE, target: name(1) },
      1,
      []
    );
    assertNoPrompt(explicit);

    for (const target of ['nope', '5002', '50', '1']) {
      await expectFailed(
        `explicit ${JSON.stringify(target)} matches nothing`,
        { choices: owned, here: HERE, target },
        unknownTarget(target, [1, 2, 3])
      );
    }
    await expectFailed(
      'empty list uses the default message',
      { choices: [], here: HERE },
      'No managed simulator exists yet. Run "bun run ios:worktree" first.'
    );
    await expectFailed(
      'empty list uses the caller message, even with a target',
      {
        choices: [],
        here: HERE,
        target: name(1),
        emptyMessage: 'Caller message.',
      },
      'Caller message.'
    );

    await expectFailed(
      'scripted, several unowned, ports on offer',
      { choices: unowned, here: HERE },
      noDefault([1, 2], TARGET_FORMS_WITH_PORT)
    );
    await expectFailed(
      'scripted, one unowned, no ports on offer',
      { choices: [choice(2)], here: HERE },
      noDefault([2], TARGET_FORMS)
    );
    for (const input of [ENTER, BLANK, '\t\n']) {
      await expectFailed(
        `terminal, several unowned, ${JSON.stringify(input)} selects nothing`,
        { choices: unowned, here: HERE },
        nothingSelected(2, TARGET_FORMS_WITH_PORT),
        [answer(2, input)]
      );
      await expectFailed(
        `terminal, one unowned, ${JSON.stringify(input)} selects nothing`,
        { choices: [choice(2)], here: HERE },
        nothingSelected(1, TARGET_FORMS),
        [answer(1, input)]
      );
    }
    const typed = await expectSelected(
      'terminal, one unowned, typed number',
      { choices: [choice(2)], here: HERE },
      2,
      [answer(1, ' 1 \n')]
    );
    assertNoDefaultShown(typed, 1);
    const typedSecond = await expectSelected(
      'terminal, several unowned, typed number',
      { choices: unowned, here: HERE },
      2,
      [answer(2, '2\n')]
    );
    assertNoDefaultShown(typedSecond, 2);
    assert.ok(
      typedSecond.stdout.includes(
        `  1) ${name(1)} (${udid(1)}) missing, port 5001, ${OTHER}\n` +
          `  2) ${name(2)} (${udid(2)}) missing, free pool\n`
      )
    );
    for (const input of ['0\n', '3\n', '-1\n', 'x\n']) {
      await expectFailed(
        `terminal, unowned, ${JSON.stringify(input)} is out of range`,
        { choices: unowned, here: HERE },
        'Choose a number between 1 and 2.',
        [answer(2, input)]
      );
    }

    await expectSelected(
      'scripted, owned third row is the default',
      { choices: owned, here: HERE },
      3
    );
    const entered = await expectSelected(
      'terminal, Enter takes the owned third row',
      { choices: owned, here: HERE },
      3,
      [answer(3, ENTER, 3)]
    );
    assert.deepEqual(
      entered.stdout.split('\n').filter((line) => line.startsWith('*')),
      [`* 3) ${name(3)} (${udid(3)}) missing, port 5003, this worktree`]
    );
    await expectSelected(
      'terminal, whitespace takes the owned third row',
      { choices: owned, here: HERE },
      3,
      [answer(3, BLANK, 3)]
    );
    await expectSelected(
      'terminal, typed number overrides the owned default',
      { choices: owned, here: HERE },
      2,
      [answer(3, '2\n', 3)]
    );
    await expectFailed(
      'terminal, owned default, out-of-range answer',
      { choices: owned, here: HERE },
      'Choose a number between 1 and 3.',
      [answer(3, '4\n', 3)]
    );
    const shortcut = await expectSelected(
      'terminal, owned singleton is returned unasked',
      { choices: [choice(3, HERE, 5003)], here: HERE },
      3,
      []
    );
    assertNoPrompt(shortcut);
    await expectSelected(
      'scripted, owned singleton is returned',
      { choices: [choice(3, HERE, 5003)], here: HERE },
      3
    );
  });
};

const helpCases = async (): Promise<void> => {
  await verifyCase('help: states the selection rules', async () => {
    await withFixture({}, async (fixture) => {
      const result = await command(fixture, ['--help']);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `${HELP}\n`);
      assert.deepEqual(calls(fixture), []);
    });
    for (const phrase of [
      "[name] is a managed simulator's name, its UDID, or the Metro port assigned",
      'When this worktree holds none of them there is no default.',
      'even a single one, and needs a number: Enter selects',
      'Without a terminal it stops and asks for a',
      'so a scripted remove without --force needs a target or --all.',
      'does not choose the target.',
      'not choose the target either.',
    ]) {
      assert.ok(HELP.includes(phrase), `help mentions: ${phrase}`);
    }
    assert.ok(!HELP.includes('offers a list when several'));
    assert.ok(!HELP.includes("Names this worktree's by default"));
  });
};

const verify = async (): Promise<void> => {
  await scriptedUnownedCases();
  await interactiveUnownedCases();
  await ownedCases();
  await explicitTargetCases();
  await bulkCases();
  await selectorCases();
  await helpCases();
  console.log(`\nAll ${passed} selection cases passed.`);
};

// The command child follows the CLI entry point: the real parser, then one
// subcommand, reported the way the CLI reports it, so the parent asserts on the
// text a user would see.
const runCommandChild = async (root: string, args: string[]): Promise<void> => {
  const options = parseOptions(args);
  if (options.help) {
    console.log(HELP);
    return;
  }
  const context = contextFor(root);
  if (options.command === 'show') return show(context, options.target);
  if (options.command === 'hide') {
    return hide(context, options.target, options.all);
  }
  if (options.command === 'stop') return stop(context, options.target);
  if (options.command === 'remove') return remove(context, options);
  throw new Error(`Unsupported fixture command: ${options.command ?? ''}`);
};

const decodeSelectorRequest = (source: string): SelectorRequest => {
  const value: unknown = JSON.parse(source);
  if (
    !isRecord(value) ||
    !Array.isArray(value.choices) ||
    typeof value.here !== 'string' ||
    (value.target !== undefined && typeof value.target !== 'string') ||
    (value.emptyMessage !== undefined && typeof value.emptyMessage !== 'string')
  ) {
    throw new Error('Malformed selector request.');
  }
  const choices = value.choices.map((entry: unknown): SimulatorChoice => {
    if (
      !isRecord(entry) ||
      !isRecord(entry.simulator) ||
      typeof entry.simulator.udid !== 'string' ||
      typeof entry.simulator.name !== 'string' ||
      (entry.worktree !== undefined && typeof entry.worktree !== 'string') ||
      (entry.port !== undefined && typeof entry.port !== 'number')
    ) {
      throw new Error('Malformed selector choice.');
    }
    return {
      simulator: { udid: entry.simulator.udid, name: entry.simulator.name },
      worktree: entry.worktree,
      port: entry.port,
    };
  });
  return {
    choices,
    here: value.here,
    target: value.target,
    emptyMessage: value.emptyMessage,
  };
};

const runSelectorChild = async (source: string): Promise<void> => {
  const request = decodeSelectorRequest(source);
  const context: GitContext = {
    ...contextFor(process.cwd()),
    worktree: request.here,
  };
  const picked = await resolveChoice(
    context,
    request.choices,
    request.target,
    request.emptyMessage
  );
  console.log(`SELECTED ${picked.simulator.udid}`);
};

// A terminal cannot be allocated without a host tool, so the interactive
// children claim one on the pipe they were given. Nothing else is altered.
const simulateTerminal = (): void => {
  Object.defineProperty(process.stdin, 'isTTY', {
    value: true,
    configurable: true,
  });
};

const runListenerChild = (): void => {
  const server = createServer((socket) => socket.destroy());
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Fixture listener has no port.');
    }
    console.log(String(address.port));
  });
};

const report = (work: Promise<void>): void => {
  work.catch((error: unknown) => {
    console.error(`${FAILURE_PREFIX}${errorMessage(error)}`);
    process.exitCode = 1;
  });
};

const [mode, ...modeArgs] = process.argv.slice(2);
if (mode === COMMAND_CHILD || mode === INTERACTIVE_CHILD) {
  const [root, ...args] = modeArgs;
  if (mode === INTERACTIVE_CHILD) simulateTerminal();
  report(runCommandChild(root ?? '', args));
} else if (mode === SELECTOR_CHILD) {
  const [terminal, source] = modeArgs;
  if (terminal === 'tty') simulateTerminal();
  report(runSelectorChild(source ?? ''));
} else if (mode === LISTENER_CHILD) {
  runListenerChild();
} else {
  process.once('exit', () => {
    liveListeners.forEach((child) => child.kill('SIGKILL'));
  });
  verify().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
