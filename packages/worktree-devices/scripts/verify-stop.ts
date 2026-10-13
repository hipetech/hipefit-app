import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { connect, createServer } from 'node:net';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorktreeDevicesConfig } from '../src/config';
import type { GitContext } from '../src/types';
import type { ChildProcess } from 'node:child_process';

import { stop } from '../src/commands/stop';
import { errorMessage } from '../src/lib/command';
import { isRecord } from '../src/lib/guards';
import { parseOptions } from '../src/options';
import { STATE_VERSION } from '../src/types';

// Assertion script for what stop signals and what it refuses to signal.
// Run it with: bun run packages/worktree-devices/scripts/verify-stop.ts
//
// Every case runs the unmodified stop command in a child process whose PATH
// holds only the fake xcrun, git, lsof, and ps written into a temporary
// fixture. The fakes allowlist exact argument shapes and exit 97 on anything
// else. The fake lsof and ps answer only about processes this script started:
// for those they either run the real tool, so the command sees real macOS
// output, or return what the case dictates. A pid the fixture does not list is
// reported as missing without the real tool being asked. Stop can therefore
// reach no simulator, no real registry, and no process outside the fixture.
//
// Fixture listeners are real loopback servers. One started as Expo runs a
// script at <worktree>/node_modules/.bin/expo with the arguments `run` passes
// to Expo, so its command line and working directory look like the real thing.
// Every listener records an interrupt in a marker file, which is how a case
// proves that a process stop had to leave alone received no signal.

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const COMMAND_CHILD = '--command-child';
const REJECTED = 'rejected';
const CHILD_TIMEOUT_MS = 45_000;
const FAILURE_PREFIX = 'iOS worktree command failed: ';
const ADVICE =
  'Stop that process yourself, or detach with --force if the port is held by something else.';

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
// Port lookups are counted so a case can change what a process looks like, or
// when it becomes visible, between two inspections by the same command.
const FAKE_TOOL_SOURCE = `import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [root, tool, ...args] = process.argv.slice(2);
const scenario = JSON.parse(readFileSync(join(root, 'scenario.json'), 'utf8'));
const counterPath = join(root, 'port-lookups');
const lookups = () => (existsSync(counterPath) ? Number(readFileSync(counterPath, 'utf8')) : 0);
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
const factsOf = (pid) => {
  const entry = scenario.processes[pid];
  if (!entry) return undefined;
  return entry.later && lookups() >= entry.later.fromLookup ? { ...entry, ...entry.later } : entry;
};
const answer = (mode, executable) => {
  if (mode === 'empty') succeed('');
  if (mode === 'error') fail(1);
  if (mode !== 'real') succeed(mode.text);
  const result = spawnSync(executable, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) fail(result.status ?? 1);
  succeed(result.stdout);
};

if (tool === 'xcrun') {
  if (equals(['--find', 'simctl'])) succeed('/fixture/simctl\\n');
  if (equals(['simctl', 'list', '--json'])) {
    succeed(readFileSync(join(root, 'inventory.json'), 'utf8'));
  }
  reject();
}
if (tool === 'git') {
  if (!equals(['worktree', 'list', '--porcelain', '-z'])) reject();
  succeed(scenario.worktrees.map((path) => 'worktree ' + path + '\\0HEAD 0000\\0\\0').join(''));
}
if (tool === 'lsof' && args[0] === '-ti') {
  const port = /^tcp:(\\d+)$/.exec(args[1] ?? '')?.[1];
  if (!port || !equals(['-ti', 'tcp:' + port, '-sTCP:LISTEN'])) reject();
  if (!scenario.ports.includes(Number(port))) reject();
  const count = lookups() + 1;
  writeFileSync(counterPath, String(count));
  const result = spawnSync('/usr/sbin/lsof', args, { encoding: 'utf8' });
  const pids = (result.stdout ?? '')
    .split('\\n')
    .map((line) => line.trim())
    .filter((pid) => scenario.processes[pid] && (scenario.processes[pid].fromLookup ?? 1) <= count);
  if (pids.length === 0) fail(1);
  succeed(pids.join('\\n') + '\\n');
}
if (tool === 'lsof') {
  const pid = args[2] ?? '';
  if (!equals(['-a', '-p', pid, '-d', 'cwd', '-Fn'])) reject();
  const facts = factsOf(pid);
  if (!facts) reject();
  answer(facts.cwd, '/usr/sbin/lsof');
}
if (tool === 'ps') {
  const pid = args[4] ?? '';
  if (!/^\\d+$/.test(pid) || !equals(['-ww', '-o', 'ppid=,command=', '-p', pid])) reject();
  const facts = factsOf(pid);
  if (!facts) fail(1);
  answer(facts.ps, '/bin/ps');
}
reject();
`;

const FAKE_TOOLS = ['xcrun', 'git', 'lsof', 'ps'];

// Both the Expo stand-in and the unrelated server run this program. Only the
// path it is started from and its arguments differ.
const LISTENER_SOURCE = `import { appendFileSync } from 'node:fs';
import { createServer } from 'node:net';

const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
const server = createServer((socket) => socket.destroy());
process.on('SIGINT', () => {
  appendFileSync(process.env.FIXTURE_MARKER, 'SIGINT\\n');
  if (process.env.FIXTURE_ON_INTERRUPT === 'exit') process.exit(0);
});
server.listen(port, process.env.FIXTURE_HOST, () => process.stdout.write('ready\\n'));
`;

// Stands in for the run command: it starts one listener as its child, so that
// listener really descends from this pid. Ending it ends the listener.
const RUNNER_SOURCE = `import { spawn } from 'node:child_process';

const { executable, argv, cwd } = JSON.parse(process.argv[2]);
const child = spawn(executable, argv, { cwd, env: process.env, stdio: ['ignore', 'inherit', 'inherit'] });
process.stdout.write('pid ' + child.pid + '\\n');
child.once('exit', () => process.exit(0));
process.on('SIGINT', () => undefined);
process.on('SIGTERM', () => child.kill('SIGKILL'));
`;

type Owner = 'here' | 'b';
type Inspection = 'real' | 'empty' | 'error' | { text: string };

interface ProcessFacts {
  ps: Inspection;
  cwd: Inspection;
}

interface ProcessEntry extends ProcessFacts {
  /** First port lookup that lists this process. */
  fromLookup?: number;
  /** What the process looks like from a later port lookup on. */
  later?: Partial<ProcessFacts> & { fromLookup: number };
}

interface FixtureLease {
  pid: number;
  hostname: string;
}

interface FixtureAssignment {
  owner: Owner;
  device: number;
  port: number;
  runner?: FixtureLease;
}

interface Fixture {
  root: string;
  context: GitContext;
  worktrees: Record<Owner, string>;
  elsewhere: string;
}

interface ListenerOptions {
  kind: 'expo' | 'server';
  cwd: string;
  port: number;
  /** Whose node_modules the Expo script is started from. */
  scriptOwner?: Owner;
  device?: number;
  host?: string;
  onInterrupt?: 'exit' | 'ignore';
  viaRunner?: boolean;
}

// `child` is the process this script spawned: the listener itself, or the
// runner whose child the listener is.
interface Started {
  child: ChildProcess;
  pid: number;
  runnerPid?: number;
  port: number;
  host: string;
  command: string;
  marker: string;
}

interface FakeCall {
  tool: string;
  args: string[];
  outcome: string;
}

interface ChildResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

const udid = (index: number): string => `FIXTURE-ABCD-000${index}`;
const name = (index: number): string =>
  `${CONFIG.simulatorNamePrefix} ${index}`;

const appDirectory = (fixture: Fixture, owner: Owner): string =>
  join(fixture.worktrees[owner], CONFIG.appDirectory);

const writeExecutable = (path: string, content: string): void => {
  writeFileSync(path, content, { mode: 0o755 });
};

const toolWrapper = (root: string, tool: string): string =>
  `#!/bin/sh\nexec '${process.execPath}' '${join(root, 'fake-tool.mjs')}' '${root}' ${tool} "$@"\n`;

const createFixture = (): Fixture => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'worktree-devices-stop-'))
  );
  const context = contextFor(root);
  const worktrees: Record<Owner, string> = {
    here: context.worktree,
    b: join(root, 'worktree-b'),
  };
  const elsewhere = join(root, 'elsewhere');
  for (const directory of [
    join(root, 'bin'),
    join(root, 'tmp'),
    join(root, 'locks'),
    join(root, 'tools'),
    join(root, 'markers'),
    elsewhere,
    context.commonGitDirectory,
    ...Object.values(worktrees).flatMap((worktree) => [
      join(worktree, CONFIG.appDirectory),
      join(worktree, 'node_modules', '.bin'),
    ]),
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(join(root, 'fake-tool.mjs'), FAKE_TOOL_SOURCE);
  writeFileSync(join(root, 'tools', 'http-server.mjs'), LISTENER_SOURCE);
  writeFileSync(join(root, 'tools', 'runner.mjs'), RUNNER_SOURCE);
  for (const worktree of Object.values(worktrees)) {
    writeFileSync(
      join(worktree, 'node_modules', '.bin', 'expo'),
      LISTENER_SOURCE
    );
  }
  for (const tool of FAKE_TOOLS) {
    writeExecutable(join(root, 'bin', tool), toolWrapper(root, tool));
  }
  return { root, context, worktrees, elsewhere };
};

// The registry is written as JSON text, not through the registry module, so a
// runner lease reaches stop exactly as a stored file would deliver it.
const arm = (
  fixture: Fixture,
  assignments: FixtureAssignment[],
  processes: Record<string, ProcessEntry>
): void => {
  const devices = assignments.map(({ device }) => device);
  writeFileSync(
    join(fixture.root, 'inventory.json'),
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
        [RUNTIME]: devices.map((index) => ({
          udid: udid(index),
          name: name(index),
          state: 'Booted',
          isAvailable: true,
          deviceTypeIdentifier: DEVICE_TYPE,
        })),
      },
    })
  );
  writeFileSync(
    join(fixture.root, 'scenario.json'),
    JSON.stringify({
      worktrees: Object.values(fixture.worktrees),
      ports: assignments.map(({ port }) => port),
      processes,
    })
  );
  writeFileSync(
    fixture.context.statePath,
    JSON.stringify({
      version: STATE_VERSION,
      assignments: assignments.map(({ owner, device, port, runner }) => ({
        worktree: fixture.worktrees[owner],
        simulatorUdid: udid(device),
        port,
        ...(runner
          ? { runner: { ...runner, startedAt: new Date().toISOString() } }
          : {}),
      })),
      simulators: devices.map((index) => ({
        udid: udid(index),
        name: name(index),
      })),
    })
  );
};

const liveChildren = new Set<ChildProcess>();

const hasExited = ({ child }: Started): boolean =>
  child.exitCode !== null || child.signalCode !== null;

const pause = async (milliseconds: number): Promise<void> => {
  await new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
};

const waitForExit = async (started: Started): Promise<void> => {
  for (let attempt = 0; attempt < 150 && !hasExited(started); attempt += 1) {
    await pause(20);
  }
  assert.ok(hasExited(started), 'the signalled fixture process exited');
};

// Signals reach only what this script spawned. A listener behind a runner is
// ended by asking the runner, which is its parent, to end it.
const endProcess = async (started: Started): Promise<void> => {
  if (hasExited(started)) return;
  if (started.runnerPid === undefined) {
    started.child.kill('SIGKILL');
    return;
  }
  started.child.kill('SIGTERM');
  for (let attempt = 0; attempt < 100 && !hasExited(started); attempt += 1) {
    await pause(20);
  }
  if (!hasExited(started)) started.child.kill('SIGKILL');
};

const withFixture = async (
  check: (
    fixture: Fixture,
    start: (options: ListenerOptions) => Promise<Started>
  ) => Promise<void>
): Promise<void> => {
  const fixture = createFixture();
  const started: Started[] = [];
  let sequence = 0;
  const start = async (options: ListenerOptions): Promise<Started> => {
    sequence += 1;
    const listener = await startListener(fixture, options, sequence);
    started.push(listener);
    return listener;
  };
  try {
    await check(fixture, start);
  } finally {
    for (const listener of started) await endProcess(listener);
    rmSync(fixture.root, { recursive: true, force: true });
  }
};

const startListener = async (
  fixture: Fixture,
  options: ListenerOptions,
  sequence: number
): Promise<Started> =>
  new Promise<Started>((resolveListener, rejectListener) => {
    const host = options.host ?? '127.0.0.1';
    const marker = join(fixture.root, 'markers', `listener-${sequence}`);
    const argv =
      options.kind === 'expo'
        ? [
            join(
              fixture.worktrees[options.scriptOwner ?? 'here'],
              'node_modules',
              '.bin',
              'expo'
            ),
            'run:ios',
            '--scheme',
            CONFIG.scheme,
            '--device',
            udid(options.device ?? 1),
            '--port',
            String(options.port),
          ]
        : [
            join(fixture.root, 'tools', 'http-server.mjs'),
            '--port',
            String(options.port),
          ];
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: process.env.NODE_ENV,
      PATH: '',
      FIXTURE_HOST: host,
      FIXTURE_MARKER: marker,
      FIXTURE_ON_INTERRUPT: options.onInterrupt ?? 'exit',
    };
    const child = options.viaRunner
      ? spawn(
          process.execPath,
          [
            join(fixture.root, 'tools', 'runner.mjs'),
            JSON.stringify({
              executable: process.execPath,
              argv,
              cwd: options.cwd,
            }),
          ],
          { cwd: fixture.root, env, stdio: ['ignore', 'pipe', 'inherit'] }
        )
      : spawn(process.execPath, argv, {
          cwd: options.cwd,
          env,
          stdio: ['ignore', 'pipe', 'inherit'],
        });
    liveChildren.add(child);
    child.once('exit', () => liveChildren.delete(child));
    child.once('error', rejectListener);
    let output = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      output += chunk;
      if (!/^ready$/m.test(output) || child.pid === undefined) return;
      const reported = /^pid (\d+)$/m.exec(output)?.[1];
      if (options.viaRunner && reported === undefined) return;
      resolveListener({
        child,
        pid: reported === undefined ? child.pid : Number(reported),
        runnerPid: options.viaRunner ? child.pid : undefined,
        port: options.port,
        host,
        command: [process.execPath, ...argv].join(' '),
        marker,
      });
    });
  });

const freePort = async (): Promise<number> =>
  new Promise<number>((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        rejectPort(new Error('No free port could be reserved.'));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });

const answers = async ({ port, host }: Started): Promise<boolean> =>
  new Promise<boolean>((resolveAnswer) => {
    const socket = connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolveAnswer(true);
    });
    socket.once('error', () => resolveAnswer(false));
  });

const wasInterrupted = ({ marker }: Started): boolean => existsSync(marker);

// The process got neither signal: it is alive, still serves its port, and its
// interrupt handler never ran.
const assertUntouched = async (started: Started): Promise<void> => {
  assert.equal(hasExited(started), false, 'the process is still alive');
  assert.equal(wasInterrupted(started), false, 'no interrupt was delivered');
  assert.equal(await answers(started), true, 'the process still serves');
};

const childEnvironment = (root: string): NodeJS.ProcessEnv => ({
  NODE_ENV: process.env.NODE_ENV,
  PATH: join(root, 'bin'),
  HOME: root,
  TMPDIR: join(root, 'tmp'),
});

const runStop = async (
  fixture: Fixture,
  args: string[]
): Promise<ChildResult> =>
  new Promise<ChildResult>((resolveChild, rejectChild) => {
    const child = spawn(
      process.execPath,
      [SCRIPT_PATH, COMMAND_CHILD, fixture.root, 'stop', ...args],
      {
        cwd: fixture.root,
        env: childEnvironment(fixture.root),
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectChild(
        new Error(`Stop timed out.\nstdout: ${stdout}\nstderr: ${stderr}`)
      );
    }, CHILD_TIMEOUT_MS);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
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
      resolveChild({ status, stdout, stderr });
    });
  });

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
  if (tool === 'xcrun') {
    return args[0] === 'simctl' ? 'simctl list' : 'xcrun --find';
  }
  if (tool === 'lsof' && args[0] === '-a') return `lsof cwd ${args[2] ?? ''}`;
  if (tool === 'lsof') return `lsof ${args[1] ?? ''}`;
  if (tool === 'ps') return `ps ${args[4] ?? ''}`;
  return `${tool} ${args[0] ?? ''}`;
};

// Reading the log also proves the allowlist held: one rejected call fails the
// case, whatever stop made of the fake's exit status.
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

const DISCOVERY = ['xcrun --find', 'simctl list', 'git worktree'];

// One inspection: who listens, then each listener's command line and
// working directory.
const inspection = (port: number, ...pids: number[]): string[] => [
  `lsof tcp:${port}`,
  ...pids.flatMap((pid) => [`ps ${pid}`, `lsof cwd ${pid}`]),
];

const REAL: ProcessEntry = { ps: 'real', cwd: 'real' };

const processes = (
  ...entries: [Started, ProcessEntry][]
): Record<string, ProcessEntry> =>
  Object.fromEntries(
    entries.map(([started, entry]) => [String(started.pid), entry])
  );

const notExpo = (device: number, port: number): string =>
  `its command line is not "expo run:ios" with --device ${udid(device)} and --port ${port}`;

const wrongDirectory = (actual: string, expected: string): string =>
  `its working directory is ${actual}, not ${expected}`;

const described = (started: Started, ...reasons: string[]): string =>
  `  PID ${started.pid} (${started.command}): ${reasons.join('; ')}.`;

const refusal = (port: number, worktree: string, lines: string[]): string =>
  [
    `Port ${port} answers, but no process listening on it was recognized as the Metro server of ${worktree}, so nothing was signalled:`,
    ...lines,
    ADVICE,
  ].join('\n');

const assertFailedWith = (result: ChildResult, message: string): void => {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(result.stderr, `${FAILURE_PREFIX}${message}\n`);
};

const assertStopped = (
  result: ChildResult,
  port: number,
  worktree: string
): void => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(
    result.stdout.includes(`Stopped Metro on port ${port} for ${worktree}.`),
    result.stdout
  );
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

const verifiedCases = async (): Promise<void> => {
  await verifyCase(
    "the assigned worktree's Expo is interrupted and the port stops answering",
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([metro, REAL])
        );
        const result = await runStop(fixture, []);
        assertStopped(result, port, fixture.worktrees.here);
        assert.ok(result.stdout.includes(`${name(1)} keeps running.`));
        assert.deepEqual(calls(fixture), [
          ...DISCOVERY,
          ...inspection(port, metro.pid),
        ]);
        await waitForExit(metro);
        assert.equal(wasInterrupted(metro), true);
        assert.equal(metro.child.signalCode, null, 'it exited on its own');
        assert.equal(await answers(metro), false);
      })
  );

  await verifyCase(
    'a working directory reached through a symlink is the same directory',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const link = join(fixture.root, 'link-to-app');
        symlinkSync(appDirectory(fixture, 'here'), link);
        const metro = await start({ kind: 'expo', cwd: link, port });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([metro, REAL])
        );
        assertStopped(await runStop(fixture, []), port, fixture.worktrees.here);
        await waitForExit(metro);
      })
  );

  await verifyCase('nothing serving on the port needs no inspection', () =>
    withFixture(async (fixture) => {
      const port = await freePort();
      arm(fixture, [{ owner: 'here', device: 1, port }], {});
      const result = await runStop(fixture, []);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `Nothing is serving on port ${port}.\n`);
      assert.deepEqual(calls(fixture), DISCOVERY);
    })
  );
};

const refusedCases = async (): Promise<void> => {
  await verifyCase(
    'an unrelated service on the assigned port gets no signal',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const service = await start({
          kind: 'server',
          cwd: fixture.elsewhere,
          port,
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([service, REAL])
        );
        const result = await runStop(fixture, []);
        assertFailedWith(
          result,
          refusal(port, fixture.worktrees.here, [
            described(
              service,
              notExpo(1, port),
              wrongDirectory(fixture.elsewhere, appDirectory(fixture, 'here'))
            ),
          ])
        );
        assert.deepEqual(calls(fixture), [
          ...DISCOVERY,
          ...inspection(port, service.pid),
        ]);
        await assertUntouched(service);
      })
  );

  await verifyCase(
    "Expo's command line from another worktree's directory gets no signal",
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const foreign = await start({
          kind: 'expo',
          scriptOwner: 'b',
          cwd: appDirectory(fixture, 'b'),
          port,
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([foreign, REAL])
        );
        assertFailedWith(
          await runStop(fixture, []),
          refusal(port, fixture.worktrees.here, [
            described(
              foreign,
              wrongDirectory(
                appDirectory(fixture, 'b'),
                appDirectory(fixture, 'here')
              )
            ),
          ])
        );
        await assertUntouched(foreign);
      })
  );

  await verifyCase(
    "a non-Expo command in the worktree's app directory gets no signal",
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const service = await start({
          kind: 'server',
          cwd: appDirectory(fixture, 'here'),
          port,
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([service, REAL])
        );
        assertFailedWith(
          await runStop(fixture, []),
          refusal(port, fixture.worktrees.here, [
            described(service, notExpo(1, port)),
          ])
        );
        await assertUntouched(service);
      })
  );

  await verifyCase('Expo started for another simulator gets no signal', () =>
    withFixture(async (fixture, start) => {
      const port = await freePort();
      const other = await start({
        kind: 'expo',
        cwd: appDirectory(fixture, 'here'),
        device: 2,
        port,
      });
      arm(
        fixture,
        [{ owner: 'here', device: 1, port }],
        processes([other, REAL])
      );
      assertFailedWith(
        await runStop(fixture, []),
        refusal(port, fixture.worktrees.here, [
          described(other, notExpo(1, port)),
        ])
      );
      await assertUntouched(other);
    })
  );

  await verifyCase(
    'a port whose listener cannot be found fails without a signal',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const hidden = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
        });
        arm(fixture, [{ owner: 'here', device: 1, port }], {});
        assertFailedWith(
          await runStop(fixture, []),
          `Port ${port} answers but no local process owns it. Stop that runner yourself, or detach with --force.`
        );
        await assertUntouched(hidden);
      })
  );
};

// The listener is the real thing in every one of these. Only the inspection
// fails, and that alone has to keep stop from signalling.
const inspectionFailureCases = async (): Promise<void> => {
  const unreadableCommand = 'its command line could not be read';
  const unreadableDirectory = 'its working directory could not be read';
  const failures: [string, Partial<ProcessFacts>, string][] = [
    ['ps prints nothing', { ps: 'empty' }, unreadableCommand],
    ['ps fails', { ps: 'error' }, unreadableCommand],
    [
      'ps prints two processes',
      { ps: { text: '  1 node a\n  1 node b\n' } },
      unreadableCommand,
    ],
    [
      'ps prints no parent pid',
      { ps: { text: 'node expo run:ios\n' } },
      unreadableCommand,
    ],
    ['lsof prints no working directory', { cwd: 'empty' }, unreadableDirectory],
    ['lsof fails', { cwd: 'error' }, unreadableDirectory],
    [
      'lsof answers for another pid',
      { cwd: { text: 'p1\nfcwd\nn/\n' } },
      unreadableDirectory,
    ],
  ];
  for (const [title, facts, reason] of failures) {
    await verifyCase(`inspection failure, ${title}: no signal`, () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([metro, { ...REAL, ...facts }])
        );
        const line =
          reason === unreadableCommand
            ? `  PID ${metro.pid} (command line unreadable): ${reason}.`
            : described(metro, reason);
        assertFailedWith(
          await runStop(fixture, []),
          refusal(port, fixture.worktrees.here, [line])
        );
        calls(fixture);
        await assertUntouched(metro);
      })
    );
  }
};

const changingListenerCases = async (): Promise<void> => {
  await verifyCase(
    'verified and unverified listeners together: only the verified one is signalled',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
        });
        const service = await start({
          kind: 'server',
          cwd: fixture.elsewhere,
          port,
          host: '::1',
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([metro, REAL], [service, REAL])
        );
        const result = await runStop(fixture, []);
        assertFailedWith(
          result,
          [
            `Port ${port} still answers. Metro for ${fixture.worktrees.here} (PID ${metro.pid}) was interrupted, but the port is held by:`,
            described(
              service,
              notExpo(1, port),
              wrongDirectory(fixture.elsewhere, appDirectory(fixture, 'here'))
            ),
            ADVICE,
          ].join('\n')
        );
        calls(fixture);
        await waitForExit(metro);
        assert.equal(wasInterrupted(metro), true);
        await assertUntouched(service);
      })
  );

  await verifyCase(
    'an unrelated listener that appears after the interrupt is not killed',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
        });
        const late = await start({
          kind: 'server',
          cwd: fixture.elsewhere,
          port,
          host: '::1',
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([metro, REAL], [late, { ...REAL, fromLookup: 2 }])
        );
        const result = await runStop(fixture, []);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.ok(
          result.stderr.includes(`Port ${port} still answers.`),
          result.stderr
        );
        assert.ok(result.stderr.includes(`PID ${late.pid} (`), result.stderr);
        assert.ok(!result.stderr.includes('was then killed'), result.stderr);
        assert.deepEqual(calls(fixture), [
          ...DISCOVERY,
          ...inspection(port, metro.pid),
          ...inspection(port, late.pid),
        ]);
        await waitForExit(metro);
        await assertUntouched(late);
      })
  );

  await verifyCase(
    'an Expo listener that appears after the interrupt is not killed unasked',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
        });
        const restarted = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
          host: '::1',
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([metro, REAL], [restarted, { ...REAL, fromLookup: 2 }])
        );
        const result = await runStop(fixture, []);
        assertFailedWith(
          result,
          [
            `Port ${port} still answers. Metro for ${fixture.worktrees.here} (PID ${metro.pid}) was interrupted, but the port is held by:`,
            `  PID ${restarted.pid} (${restarted.command}): it started listening after the interrupt was sent, so it was not killed. Run stop again to stop it.`,
            ADVICE,
          ].join('\n')
        );
        calls(fixture);
        await waitForExit(metro);
        await assertUntouched(restarted);
      })
  );
};

// Each of these waits out the full interrupt grace period, so there are two.
const killCases = async (): Promise<void> => {
  await verifyCase(
    'verified Expo that ignores the interrupt is killed after the wait',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
          onInterrupt: 'ignore',
        });
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([metro, REAL])
        );
        const result = await runStop(fixture, []);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.ok(
          result.stdout.includes(
            `Metro on port ${port} ignored an interrupt, so it was killed outright.`
          ),
          result.stdout
        );
        assert.ok(!result.stdout.includes('Stopped Metro'));
        // Verified once before the interrupt and again before the kill.
        assert.deepEqual(calls(fixture), [
          ...DISCOVERY,
          ...inspection(port, metro.pid),
          ...inspection(port, metro.pid),
        ]);
        await waitForExit(metro);
        assert.equal(wasInterrupted(metro), true);
        assert.equal(metro.child.signalCode, 'SIGKILL');
        assert.equal(await answers(metro), false);
      })
  );

  await verifyCase(
    'a listener that no longer verifies after the wait is not killed',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          port,
          onInterrupt: 'ignore',
        });
        const replacement = 'python3 -m http.server';
        arm(
          fixture,
          [{ owner: 'here', device: 1, port }],
          processes([
            metro,
            {
              ...REAL,
              later: { fromLookup: 2, ps: { text: `    1 ${replacement}\n` } },
            },
          ])
        );
        const result = await runStop(fixture, []);
        assertFailedWith(
          result,
          [
            `Port ${port} still answers. Metro for ${fixture.worktrees.here} (PID ${metro.pid}) was interrupted, but the port is held by:`,
            `  PID ${metro.pid} (${replacement}): ${notExpo(1, port)}.`,
            ADVICE,
          ].join('\n')
        );
        assert.deepEqual(calls(fixture), [
          ...DISCOVERY,
          ...inspection(port, metro.pid),
          ...inspection(port, metro.pid),
        ]);
        assert.equal(wasInterrupted(metro), true);
        assert.equal(hasExited(metro), false, 'it was not killed');
        assert.equal(await answers(metro), true);
      })
  );
};

const leaseCases = async (): Promise<void> => {
  const here = hostname();

  await verifyCase(
    'runner lease: Expo descended from the recorded runner is stopped from another directory',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: fixture.elsewhere,
          port,
          viaRunner: true,
        });
        assert.ok(metro.runnerPid !== undefined);
        arm(
          fixture,
          [
            {
              owner: 'here',
              device: 1,
              port,
              runner: { pid: metro.runnerPid, hostname: here },
            },
          ],
          {
            ...processes([metro, REAL]),
            [String(metro.runnerPid)]: REAL,
          }
        );
        const result = await runStop(fixture, []);
        assertStopped(result, port, fixture.worktrees.here);
        calls(fixture);
        await waitForExit(metro);
        assert.equal(wasInterrupted(metro), true);
      })
  );

  await verifyCase(
    'runner lease: a lease from another host does not stand in for the directory',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const metro = await start({
          kind: 'expo',
          cwd: fixture.elsewhere,
          port,
          viaRunner: true,
        });
        assert.ok(metro.runnerPid !== undefined);
        arm(
          fixture,
          [
            {
              owner: 'here',
              device: 1,
              port,
              runner: { pid: metro.runnerPid, hostname: `${here}.elsewhere` },
            },
          ],
          {
            ...processes([metro, REAL]),
            [String(metro.runnerPid)]: REAL,
          }
        );
        assertFailedWith(
          await runStop(fixture, []),
          refusal(port, fixture.worktrees.here, [
            described(
              metro,
              wrongDirectory(fixture.elsewhere, appDirectory(fixture, 'here'))
            ),
          ])
        );
        calls(fixture);
        await assertUntouched(metro);
      })
  );

  await verifyCase(
    'runner lease: a non-Expo descendant of the runner gets no signal',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const service = await start({
          kind: 'server',
          cwd: fixture.elsewhere,
          port,
          viaRunner: true,
        });
        assert.ok(service.runnerPid !== undefined);
        arm(
          fixture,
          [
            {
              owner: 'here',
              device: 1,
              port,
              runner: { pid: service.runnerPid, hostname: here },
            },
          ],
          {
            ...processes([service, REAL]),
            [String(service.runnerPid)]: REAL,
          }
        );
        assertFailedWith(
          await runStop(fixture, []),
          refusal(port, fixture.worktrees.here, [
            described(service, notExpo(1, port)),
          ])
        );
        calls(fixture);
        await assertUntouched(service);
      })
  );

  await verifyCase(
    'runner lease: Expo in another directory that the runner did not start gets no signal',
    () =>
      withFixture(async (fixture, start) => {
        const port = await freePort();
        const runnerPort = await freePort();
        const runner = await start({
          kind: 'server',
          cwd: fixture.elsewhere,
          port: runnerPort,
          viaRunner: true,
        });
        assert.ok(runner.runnerPid !== undefined);
        const stray = await start({
          kind: 'expo',
          cwd: fixture.elsewhere,
          port,
        });
        arm(
          fixture,
          [
            {
              owner: 'here',
              device: 1,
              port,
              runner: { pid: runner.runnerPid, hostname: here },
            },
          ],
          {
            ...processes([stray, REAL]),
            [String(runner.runnerPid)]: REAL,
          }
        );
        assertFailedWith(
          await runStop(fixture, []),
          refusal(port, fixture.worktrees.here, [
            described(
              stray,
              `${wrongDirectory(fixture.elsewhere, appDirectory(fixture, 'here'))}, and it was not started by the recorded runner (PID ${runner.runnerPid})`
            ),
          ])
        );
        calls(fixture);
        await assertUntouched(stray);
        await assertUntouched(runner);
      })
  );
};

const explicitTargetCases = async (): Promise<void> => {
  await verifyCase(
    "an explicit target is verified against the assignment's worktree",
    () =>
      withFixture(async (fixture, start) => {
        const ownPort = await freePort();
        const otherPort = await freePort();
        const own = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          device: 1,
          port: ownPort,
        });
        const other = await start({
          kind: 'expo',
          scriptOwner: 'b',
          cwd: appDirectory(fixture, 'b'),
          device: 2,
          port: otherPort,
        });
        arm(
          fixture,
          [
            { owner: 'here', device: 1, port: ownPort },
            { owner: 'b', device: 2, port: otherPort },
          ],
          processes([own, REAL], [other, REAL])
        );
        const result = await runStop(fixture, [String(otherPort)]);
        assertStopped(result, otherPort, fixture.worktrees.b);
        assert.deepEqual(calls(fixture), [
          ...DISCOVERY,
          ...inspection(otherPort, other.pid),
        ]);
        await waitForExit(other);
        await assertUntouched(own);
      })
  );

  await verifyCase(
    "Expo in the current worktree's directory on another worktree's port gets no signal",
    () =>
      withFixture(async (fixture, start) => {
        const otherPort = await freePort();
        const misplaced = await start({
          kind: 'expo',
          cwd: appDirectory(fixture, 'here'),
          device: 2,
          port: otherPort,
        });
        arm(
          fixture,
          [{ owner: 'b', device: 2, port: otherPort }],
          processes([misplaced, REAL])
        );
        assertFailedWith(
          await runStop(fixture, [name(2)]),
          refusal(otherPort, fixture.worktrees.b, [
            described(
              misplaced,
              wrongDirectory(
                appDirectory(fixture, 'here'),
                appDirectory(fixture, 'b')
              )
            ),
          ])
        );
        await assertUntouched(misplaced);
      })
  );
};

const verify = async (): Promise<void> => {
  await verifiedCases();
  await refusedCases();
  await inspectionFailureCases();
  await changingListenerCases();
  await leaseCases();
  await explicitTargetCases();
  await killCases();
  console.log(`\nAll ${passed} stop cases passed.`);
};

// The command child follows the CLI entry point: the real parser, then stop,
// reported the way the CLI reports it.
const runCommandChild = async (root: string, args: string[]): Promise<void> => {
  const options = parseOptions(args);
  if (options.command !== 'stop') {
    throw new Error(`Unsupported fixture command: ${options.command ?? ''}`);
  }
  return stop(contextFor(root), options.target);
};

const [mode, ...modeArgs] = process.argv.slice(2);
if (mode === COMMAND_CHILD) {
  const [root, ...args] = modeArgs;
  runCommandChild(root ?? '', args).catch((error: unknown) => {
    console.error(`${FAILURE_PREFIX}${errorMessage(error)}`);
    process.exitCode = 1;
  });
} else {
  // A runner ends its own listener on SIGTERM, so no grandchild is signalled
  // from here.
  process.once('exit', () => {
    liveChildren.forEach((child) => child.kill('SIGTERM'));
  });
  verify().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
