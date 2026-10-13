import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorktreeDevicesConfig } from '../src/config';
import type * as RealLockModule from '../src/core/lock';
import type { GitContext } from '../src/types';
import type { ChildProcess } from 'node:child_process';

import { decodeState, readState, writeState } from '../src/core/registry';
import { sleep } from '../src/lib/async';
import { errorMessage } from '../src/lib/command';
import { isRecord } from '../src/lib/guards';
import { STATE_VERSION } from '../src/types';

// Assertion script for the registry lock and its transition guard.
// Run it with: bun run packages/worktree-devices/scripts/verify-lock.ts
//
// Every lock, guard, and registry path lives under one temporary directory
// created here. Workers are child processes of this script, driven over IPC,
// and they are the only processes it signals. Each case prints which of these
// it relies on:
//
// - the unmodified lock module, imported from src/;
// - an instrumented copy, written into the temporary directory, whose only
//   difference is that `node:fs/promises` is imported through a wrapper that
//   can pause at a checkpoint, report a call, or fail one;
// - the unmodified module in a child whose `process.kill` is replaced, so the
//   owner probe can return EPERM and unexpected errors without signalling
//   anything.

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SOURCE_ROOT = join(dirname(SCRIPT_PATH), '..', 'src');
const REAL_LOCK_MODULE = join(SOURCE_ROOT, 'core', 'lock.ts');
const CHILD_FLAG = '--child';
const ROOT_PREFIX = 'worktree-devices-verify-lock-';
const HOOK_KEY = 'hipefit.verify-lock.fs-hook';

const UNMODIFIED = 'unmodified module';
const CHECKPOINTS = 'instrumented copy, filesystem checkpoints';
const FAULTS = 'instrumented copy, injected filesystem failures';
const PROBES = 'unmodified module, process.kill replaced in the child';
const CRASH =
  'instrumented victim killed at a checkpoint, unmodified contender';

// These mirror the constants in the lock module. The assertions below fail if
// the module stops honoring them.
const LOCK_TIMEOUT_MS = 15_000;
const TIMEOUT_SLACK_MS = 4_000;
const PROMPT_MS = 6_000;
const WAIT_MS = 30_000;
const WORKER_LIFETIME_MS = 90_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FOREIGN_HOST = 'verify-lock-foreign-host.invalid';

const CONFIG: WorktreeDevicesConfig = {
  appDirectory: 'apps/mobile',
  scheme: 'Fixture-dev',
  bundleIdentifier: 'com.example.fixture.development',
  environmentFile: '.env.development',
  environmentLocalName: '.env.local',
  simulatorNamePrefix: 'Fixture Worktree',
  registryName: 'fixture-registry',
  ports: { start: 39_500, end: 39_559 },
  reservedPorts: [],
};

const FS_OPERATIONS = [
  'lstat',
  'mkdir',
  'readdir',
  'readFile',
  'rename',
  'rm',
  'rmdir',
  'writeFile',
] as const;
const HOOK_PHASES = ['before', 'after', 'failed'] as const;
const HOOK_TARGETS = [
  'lock',
  'lock-owner',
  'guard',
  'guard-owner',
  'quarantine',
] as const;
const HOOK_EFFECTS = ['pause', 'fail', 'notify', 'plant-dead-lock'] as const;
const PROBE_OUTCOMES = ['alive', 'EPERM', 'ESRCH', 'EIO'] as const;

type LockModule = typeof RealLockModule;
type FsOperation = (typeof FS_OPERATIONS)[number];
type HookPhase = (typeof HOOK_PHASES)[number];
type HookTarget = (typeof HOOK_TARGETS)[number];
type HookEffect = (typeof HOOK_EFFECTS)[number];
type ProbeOutcome = (typeof PROBE_OUTCOMES)[number];

interface HookRule {
  name: string;
  operation: FsOperation;
  target: HookTarget;
  phase: HookPhase;
  effect: HookEffect;
  /** 1-based call to act on. Every matching call when omitted. */
  occurrence?: number;
  /** Error code thrown by a `fail` rule. */
  code?: string;
}

interface WorkerSetup {
  root: string;
  modulePath: string;
  lockPath: string;
  rules: HookRule[];
  /** When present, `process.kill` is replaced and answers from this table. */
  probes?: Record<string, ProbeOutcome>;
  /** Owner pid written by a `plant-dead-lock` rule. */
  deadPid?: number;
}

interface WorkerCommand {
  command: string;
  id?: number;
  name?: string;
  handle?: string;
  lockPath?: string;
  calls?: number;
  behaviour?: string;
  sentinel?: string;
  rounds?: number;
  worker?: number;
}

interface CallResult {
  ok: boolean;
  message: string;
}

interface ProbeCall {
  pid: number;
  signal: string;
}

interface WorkerMessage {
  event: string;
  id?: number;
  name?: string;
  ok?: boolean;
  message?: string;
  elapsedMs?: number;
  results?: CallResult[];
  probes?: ProbeCall[];
}

interface Reply {
  ok: boolean;
  message: string;
  elapsedMs: number;
  results: CallResult[];
  probes: ProbeCall[];
}

interface Worker {
  pid: number;
  send: (command: WorkerCommand) => void;
  request: (command: WorkerCommand, timeoutMs?: number) => Promise<Reply>;
  waitFor: (
    event: string,
    key: number | string,
    timeoutMs?: number
  ) => Promise<WorkerMessage>;
  seen: (event: string, key: number | string) => number;
  kill: () => Promise<void>;
}

interface Fixture {
  root: string;
  lockPath: string;
  guardPath: string;
  locksDirectory: string;
  context: GitContext;
}

interface Suite {
  root: string;
  instrumentedModule: string;
  deadPid: number;
  livePid: number;
}

interface Case {
  name: string;
  evidence: string;
  check: (fixture: Fixture, suite: Suite) => Promise<void>;
}

const isOneOf = <T extends string>(
  values: readonly T[],
  value: unknown
): value is T => values.some((candidate) => candidate === value);

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const decodeCallResults = (value: unknown): CallResult[] | undefined =>
  Array.isArray(value)
    ? value.filter(isRecord).map((entry) => ({
        ok: entry.ok === true,
        message: optionalString(entry.message) ?? '',
      }))
    : undefined;

const decodeProbeCalls = (value: unknown): ProbeCall[] | undefined =>
  Array.isArray(value)
    ? value.filter(isRecord).map((entry) => ({
        pid: optionalNumber(entry.pid) ?? Number.NaN,
        signal: optionalString(entry.signal) ?? '',
      }))
    : undefined;

// ---------------------------------------------------------------------------
// Parent half: fixtures and worker control
// ---------------------------------------------------------------------------

const workers = new Set<ChildProcess>();
let nextRequestId = 1;

const assertInside = (root: string, path: string): void => {
  assert.ok(
    path.startsWith(`${root}/`) && root.includes(ROOT_PREFIX),
    `refusing to touch ${path}: it is outside the fixture root ${root}`
  );
};

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

const createFixture = (suite: Suite, index: number): Fixture => {
  const root = join(suite.root, `case-${index}`);
  const context = contextFor(root);
  for (const directory of [
    join(root, 'locks'),
    join(root, 'aside'),
    join(root, 'tmp'),
    context.commonGitDirectory,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  return {
    root,
    lockPath: context.lockPath,
    guardPath: `${context.lockPath}.guard`,
    locksDirectory: join(root, 'locks'),
    context,
  };
};

const startWorker = async (
  fixture: Fixture,
  setup: Omit<WorkerSetup, 'root' | 'lockPath'>
): Promise<Worker> => {
  const fullSetup: WorkerSetup = {
    ...setup,
    root: fixture.root,
    lockPath: fixture.lockPath,
  };
  const child = spawn(
    process.execPath,
    [SCRIPT_PATH, CHILD_FLAG, JSON.stringify(fullSetup)],
    {
      cwd: fixture.root,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HOME: fixture.root,
        TMPDIR: join(fixture.root, 'tmp'),
      },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    }
  );
  const pid = child.pid;
  if (pid === undefined) throw new Error('fixture worker did not start');
  workers.add(child);

  let stderr = '';
  let exitDescription: string | undefined;
  const inbox: WorkerMessage[] = [];
  const counts = new Map<string, number>();
  const waiters: {
    event: string;
    key: number | string;
    resolve: (message: WorkerMessage) => void;
    reject: (error: Error) => void;
  }[] = [];
  const keyOf = (message: WorkerMessage): number | string =>
    message.event === 'reply' ? (message.id ?? -1) : (message.name ?? '');

  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });
  child.on('message', (raw: unknown) => {
    if (!isRecord(raw) || typeof raw.event !== 'string') return;
    const message: WorkerMessage = {
      event: raw.event,
      id: optionalNumber(raw.id),
      name: optionalString(raw.name),
      ok: typeof raw.ok === 'boolean' ? raw.ok : undefined,
      message: optionalString(raw.message),
      elapsedMs: optionalNumber(raw.elapsedMs),
      results: decodeCallResults(raw.results),
      probes: decodeProbeCalls(raw.probes),
    };
    const countKey = `${message.event}:${keyOf(message)}`;
    counts.set(countKey, (counts.get(countKey) ?? 0) + 1);
    const waiterIndex = waiters.findIndex(
      (waiter) =>
        waiter.event === message.event && waiter.key === keyOf(message)
    );
    const waiter = waiters[waiterIndex];
    if (waiter) {
      waiters.splice(waiterIndex, 1);
      waiter.resolve(message);
      return;
    }
    inbox.push(message);
  });
  const exited = new Promise<void>((resolveExit) => {
    child.on('exit', (code, signal) => {
      workers.delete(child);
      exitDescription = `exited with ${signal ?? String(code)}`;
      for (const waiter of waiters.splice(0)) {
        waiter.reject(
          new Error(
            `worker ${pid} ${exitDescription} while the script waited for ${waiter.event} ${waiter.key}\n${stderr}`
          )
        );
      }
      resolveExit();
    });
  });

  const waitFor = (
    event: string,
    key: number | string,
    timeoutMs = WAIT_MS
  ): Promise<WorkerMessage> => {
    const inboxIndex = inbox.findIndex(
      (message) => message.event === event && keyOf(message) === key
    );
    const queued = inbox[inboxIndex];
    if (queued) {
      inbox.splice(inboxIndex, 1);
      return Promise.resolve(queued);
    }
    if (exitDescription) {
      return Promise.reject(
        new Error(`worker ${pid} ${exitDescription} before ${event} ${key}`)
      );
    }
    return new Promise<WorkerMessage>((resolveWait, rejectWait) => {
      const timer = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.resolve === settle);
        if (index >= 0) waiters.splice(index, 1);
        rejectWait(
          new Error(
            `worker ${pid} sent no ${event} ${key} within ${timeoutMs} ms\n${stderr}`
          )
        );
      }, timeoutMs);
      const settle = (message: WorkerMessage): void => {
        clearTimeout(timer);
        resolveWait(message);
      };
      waiters.push({
        event,
        key,
        resolve: settle,
        reject: (error: Error): void => {
          clearTimeout(timer);
          rejectWait(error);
        },
      });
    });
  };

  const send = (command: WorkerCommand): void => {
    child.send(command);
  };
  const worker: Worker = {
    pid,
    send,
    waitFor,
    request: async (command, timeoutMs = WAIT_MS): Promise<Reply> => {
      const id = nextRequestId;
      nextRequestId += 1;
      send({ ...command, id });
      const message = await waitFor('reply', id, timeoutMs);
      return {
        ok: message.ok === true,
        message: message.message ?? '',
        elapsedMs: message.elapsedMs ?? Number.NaN,
        results: message.results ?? [],
        probes: message.probes ?? [],
      };
    },
    seen: (event, key): number => counts.get(`${event}:${key}`) ?? 0,
    kill: async (): Promise<void> => {
      if (!exitDescription) child.kill('SIGKILL');
      await exited;
    },
  };
  await waitFor('ready', '');
  return worker;
};

const realWorker = (fixture: Fixture): Promise<Worker> =>
  startWorker(fixture, { modulePath: REAL_LOCK_MODULE, rules: [] });

const instrumentedWorker = (
  fixture: Fixture,
  suite: Suite,
  rules: HookRule[]
): Promise<Worker> =>
  startWorker(fixture, {
    modulePath: suite.instrumentedModule,
    rules,
    deadPid: suite.deadPid,
  });

const ownerSource = (
  pid: unknown,
  host: string = hostname(),
  createdAt: string = new Date().toISOString()
): string =>
  `${JSON.stringify({ pid, hostname: host, createdAt, token: randomUUID() })}\n`;

// Plants a lock directory the way a previous command would have left it.
// `ageMs` backdates the directory, which is how the module measures the age of
// a lock without usable owner metadata.
const plantLock = (
  fixture: Fixture,
  source: string | undefined,
  ageMs = 0,
  lockPath: string = fixture.lockPath
): void => {
  assertInside(fixture.root, lockPath);
  mkdirSync(lockPath);
  if (source !== undefined) writeFileSync(join(lockPath, 'owner.json'), source);
  if (ageMs > 0) {
    const then = new Date(Date.now() - ageMs);
    utimesSync(lockPath, then, then);
  }
};

const snapshot = (path: string): string => {
  const entry = lstatSync(path, { bigint: true });
  const ownerPath = join(path, 'owner.json');
  const owner =
    entry.isDirectory() && existsSync(ownerPath)
      ? readFileSync(ownerPath, 'utf8')
      : '<no owner>';
  return `${entry.isDirectory() ? 'directory' : 'other'} ${entry.dev}:${entry.ino} ${owner}`;
};

// Stands in for a command that does not honor the guard, such as one from an
// older worktree: it swaps the lock directory regardless of who holds the
// guard. The previous directory is kept aside so its inode cannot be reused.
const replaceLock = (fixture: Fixture, source: string): string => {
  assertInside(fixture.root, fixture.lockPath);
  renameSync(fixture.lockPath, join(fixture.root, 'aside', randomUUID()));
  plantLock(fixture, source);
  return snapshot(fixture.lockPath);
};

const removeFixturePath = (fixture: Fixture, path: string): void => {
  assertInside(fixture.root, path);
  rmSync(path, { recursive: true, force: true });
};

const coordinationEntries = (fixture: Fixture): string[] =>
  readdirSync(fixture.locksDirectory).sort();

const assertNoCoordinationEntries = (fixture: Fixture): void => {
  assert.deepEqual(
    coordinationEntries(fixture),
    [],
    'no lock, guard, or quarantine directory may remain'
  );
};

const quarantinePaths = (fixture: Fixture): string[] =>
  coordinationEntries(fixture)
    .filter((name) => name.endsWith('.stale'))
    .map((name) => join(fixture.locksDirectory, name));

const assertTimedOut = (reply: Reply, opening: string): void => {
  assert.equal(reply.ok, false, 'the wait must end in a failure');
  assert.ok(
    reply.message.startsWith(opening),
    `expected the message to open with:\n${opening}\ngot:\n${reply.message}`
  );
  assert.ok(
    reply.elapsedMs >= LOCK_TIMEOUT_MS - 10 &&
      reply.elapsedMs <= LOCK_TIMEOUT_MS + TIMEOUT_SLACK_MS,
    `expected one ${LOCK_TIMEOUT_MS} ms deadline, waited ${reply.elapsedMs} ms`
  );
};

const lockTimeoutOpening = (lockPath: string): string =>
  `Timed out after 15 seconds waiting for the simulator registry lock at ${lockPath}.`;
const guardTimeoutOpening = (guardPath: string): string =>
  `Timed out after 15 seconds waiting for the simulator registry transition guard at ${guardPath}.`;

const assertGuardGuidance = (fixture: Fixture, message: string): void => {
  for (const expected of [
    fixture.guardPath,
    fixture.lockPath,
    'never clear it automatically',
    'account for every command that shares this registry',
    'other hosts',
    'older worktrees',
    'a stopped process that could resume',
    'Its age alone does not show that it is abandoned',
    'Leave the registry JSON file and the simulators as they are',
  ]) {
    assert.ok(
      message.includes(expected),
      `the guidance must mention "${expected}":\n${message}`
    );
  }
};

const assertIncludes = (message: string, expected: string): void => {
  assert.ok(
    message.includes(expected),
    `expected "${expected}" in:\n${message}`
  );
};

const assertPrompt = (reply: Reply): void => {
  assert.ok(
    reply.elapsedMs < PROMPT_MS,
    `expected a prompt result, waited ${reply.elapsedMs} ms`
  );
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const contendersCase = async (
  fixture: Fixture,
  suite: Suite
): Promise<void> => {
  const workerCount = 8;
  const rounds = 3;
  const sentinel = join(fixture.root, 'critical-section');
  const journal = join(fixture.root, 'journal.log');
  // A dead owner's lock is already in place, so the first contenders race to
  // reclaim it as well as to take it.
  plantLock(fixture, ownerSource(suite.deadPid));
  const contenders = await Promise.all(
    Array.from({ length: workerCount }, () => realWorker(fixture))
  );
  const replies = await Promise.all(
    contenders.map((contender, worker) =>
      contender.request({ command: 'contend', rounds, worker, sentinel })
    )
  );
  for (const reply of replies) assert.equal(reply.ok, true, reply.message);

  const lines = readFileSync(journal, 'utf8').trim().split('\n');
  assert.equal(lines.length, workerCount * rounds * 2);
  for (let index = 0; index < lines.length; index += 2) {
    const [enterWord, enterWorker] = (lines[index] ?? '').split(' ');
    const [leaveWord, leaveWorker] = (lines[index + 1] ?? '').split(' ');
    assert.equal(enterWord, 'enter', 'actions must not interleave');
    assert.equal(leaveWord, 'leave', 'actions must not interleave');
    assert.equal(enterWorker, leaveWorker, 'actions must not interleave');
  }
  assert.equal(existsSync(sentinel), false);

  const parsed: unknown = JSON.parse(
    readFileSync(fixture.context.statePath, 'utf8')
  );
  const state = decodeState(parsed, CONFIG.ports);
  const expectedWorktrees = Array.from(
    { length: workerCount * rounds },
    (_, index) =>
      join(
        fixture.root,
        `worktree-${Math.floor(index / rounds)}-${index % rounds}`
      )
  ).sort();
  assert.deepEqual(
    state.assignments.map(({ worktree }) => worktree).sort(),
    expectedWorktrees,
    'every assignment written under the lock must survive'
  );
  assert.equal(
    new Set(state.assignments.map(({ port }) => port)).size,
    workerCount * rounds,
    'port reservations must be unique'
  );
  assert.equal(
    new Set(state.assignments.map(({ simulatorUdid }) => simulatorUdid)).size,
    workerCount * rounds,
    'simulator reservations must be unique'
  );
  assert.equal(state.simulators.length, workerCount * rounds);
  assertNoCoordinationEntries(fixture);
};

const staleObservationCase = async (
  fixture: Fixture,
  suite: Suite
): Promise<void> => {
  plantLock(fixture, ownerSource(suite.deadPid));
  // The second lstat of the lock is the revalidation, so the waiter is paused
  // holding a verdict that the dead owner's lock is reclaimable.
  const waiter = await instrumentedWorker(fixture, suite, [
    {
      name: 'observed-stale',
      operation: 'lstat',
      target: 'lock',
      phase: 'before',
      effect: 'pause',
      occurrence: 2,
    },
    {
      name: 'observed-again',
      operation: 'lstat',
      target: 'lock',
      phase: 'after',
      effect: 'notify',
      occurrence: 4,
    },
    {
      name: 'lock-renamed',
      operation: 'rename',
      target: 'lock',
      phase: 'before',
      effect: 'notify',
    },
  ]);
  const sentinel = join(fixture.root, 'critical-section');
  waiter.send({ command: 'with', id: 9001, behaviour: 'hold', sentinel });
  await waiter.waitFor('checkpoint', 'observed-stale');

  const replacement = replaceLock(fixture, ownerSource(suite.livePid));
  waiter.send({ command: 'resume', name: 'observed-stale' });
  await waiter.waitFor('notice', 'observed-again');

  assert.equal(
    snapshot(fixture.lockPath),
    replacement,
    'the replacement lock must survive the resumed waiter'
  );
  assert.equal(waiter.seen('notice', 'lock-renamed'), 0);
  assert.equal(waiter.seen('entered', ''), 0, 'the waiter must not enter');

  removeFixturePath(fixture, fixture.lockPath);
  await waiter.waitFor('entered', '');
  assert.equal(waiter.seen('notice', 'lock-renamed'), 0);
  waiter.send({ command: 'leave' });
  const reply = await waiter.waitFor('reply', 9001);
  assert.equal(reply.ok, true, reply.message);
  assertNoCoordinationEntries(fixture);
};

const swapAfterRevalidationCase = async (
  fixture: Fixture,
  suite: Suite
): Promise<void> => {
  plantLock(fixture, ownerSource(suite.deadPid));
  const waiter = await instrumentedWorker(fixture, suite, [
    {
      name: 'renaming',
      operation: 'rename',
      target: 'lock',
      phase: 'before',
      effect: 'pause',
      occurrence: 1,
    },
  ]);
  waiter.send({ command: 'with', id: 9002, behaviour: 'hold' });
  await waiter.waitFor('checkpoint', 'renaming');
  // Past revalidation nothing but the guard protects the lock, and this swap
  // ignores the guard. The module cannot prevent the rename, so the check is
  // that it notices and deletes nothing.
  const replacementSource = ownerSource(suite.livePid);
  replaceLock(fixture, replacementSource);
  waiter.send({ command: 'resume', name: 'renaming' });
  const reply = await waiter.waitFor('reply', 9002);
  assert.equal(reply.ok, false);
  assert.equal(waiter.seen('entered', ''), 0, 'the waiter must not enter');
  const [retained] = quarantinePaths(fixture);
  assert.ok(retained, 'the moved directory must be retained');
  assertIncludes(reply.message ?? '', `It is retained at ${retained}.`);
  assert.equal(
    readFileSync(join(retained, 'owner.json'), 'utf8'),
    replacementSource,
    'the replacement must not be deleted'
  );
  assert.equal(existsSync(fixture.guardPath), false);
};

const blockedTransitionCase = async (
  fixture: Fixture,
  suite: Suite,
  holderRule: HookRule,
  plantStale: boolean
): Promise<void> => {
  if (plantStale) plantLock(fixture, ownerSource(suite.deadPid));
  const sentinel = join(fixture.root, 'critical-section');
  const holder = await instrumentedWorker(fixture, suite, [holderRule]);
  const contender = await instrumentedWorker(fixture, suite, [
    {
      name: 'guard-busy',
      operation: 'mkdir',
      target: 'guard',
      phase: 'failed',
      effect: 'notify',
    },
  ]);
  holder.send({ command: 'with', id: 9003, behaviour: 'hold', sentinel });
  await holder.waitFor('checkpoint', holderRule.name);
  assert.equal(existsSync(fixture.guardPath), true);
  const paused = snapshot(fixture.lockPath);

  contender.send({ command: 'with', id: 9004, behaviour: 'hold', sentinel });
  await contender.waitFor('notice', 'guard-busy');
  await contender.waitFor('notice', 'guard-busy');
  assert.equal(
    snapshot(fixture.lockPath),
    paused,
    'no other transition may proceed while the guard is held'
  );
  assert.equal(contender.seen('entered', ''), 0);

  holder.send({ command: 'resume', name: holderRule.name });
  await holder.waitFor('entered', '');
  const held = snapshot(fixture.lockPath);
  // The contender now retries against a live owner. Let it run several
  // attempts; the exclusive sentinel fails its action if it ever gets in.
  await sleep(500);
  assert.equal(contender.seen('entered', ''), 0);
  assert.equal(snapshot(fixture.lockPath), held);

  holder.send({ command: 'leave' });
  const holderReply = await holder.waitFor('reply', 9003);
  assert.equal(holderReply.ok, true, holderReply.message);
  await contender.waitFor('entered', '');
  contender.send({ command: 'leave' });
  const contenderReply = await contender.waitFor('reply', 9004);
  assert.equal(contenderReply.ok, true, contenderReply.message);
  assertNoCoordinationEntries(fixture);
};

const protectedCase = async (
  fixture: Fixture,
  source: string | undefined,
  ageMs: number
): Promise<void> => {
  plantLock(fixture, source, ageMs);
  const before = snapshot(fixture.lockPath);
  const contender = await realWorker(fixture);
  const reply = await contender.request({ command: 'acquire', handle: 'a' });
  assertTimedOut(reply, lockTimeoutOpening(fixture.lockPath));
  assert.equal(snapshot(fixture.lockPath), before, 'the lock must survive');
  assert.deepEqual(coordinationEntries(fixture), [
    `${CONFIG.registryName}.lock`,
  ]);
};

const recoveredCase = async (
  fixture: Fixture,
  source: string | undefined,
  ageMs: number
): Promise<void> => {
  plantLock(fixture, source, ageMs);
  const before = snapshot(fixture.lockPath);
  const contender = await realWorker(fixture);
  const reply = await contender.request({ command: 'acquire', handle: 'a' });
  assert.equal(reply.ok, true, reply.message);
  assertPrompt(reply);
  assert.notEqual(snapshot(fixture.lockPath), before);
  const owner: unknown = JSON.parse(
    readFileSync(join(fixture.lockPath, 'owner.json'), 'utf8')
  );
  assert.ok(isRecord(owner) && owner.pid === contender.pid);
  assert.deepEqual(coordinationEntries(fixture), [
    `${CONFIG.registryName}.lock`,
  ]);
  const released = await contender.request({
    command: 'release',
    handle: 'a',
    calls: 1,
  });
  assert.equal(released.ok, true, released.message);
  assertNoCoordinationEntries(fixture);
};

const rejectedPathCase = async (
  fixture: Fixture,
  kind: 'symlink' | 'file'
): Promise<void> => {
  const target = join(fixture.root, 'aside', 'link-target');
  if (kind === 'symlink') {
    mkdirSync(target);
    writeFileSync(join(target, 'keep'), 'keep\n');
    symlinkSync(target, fixture.lockPath);
  } else {
    writeFileSync(fixture.lockPath, 'not a lock\n');
  }
  const contender = await realWorker(fixture);
  const reply = await contender.request({ command: 'acquire', handle: 'a' });
  assert.equal(reply.ok, false);
  assertPrompt(reply);
  assertIncludes(
    reply.message,
    `Refusing to use the simulator registry lock path ${fixture.lockPath}: it is ${kind === 'symlink' ? 'a symbolic link' : 'not a directory'}. Nothing was removed.`
  );
  if (kind === 'symlink') {
    assert.equal(lstatSync(fixture.lockPath).isSymbolicLink(), true);
    assert.equal(readFileSync(join(target, 'keep'), 'utf8'), 'keep\n');
  } else {
    assert.equal(readFileSync(fixture.lockPath, 'utf8'), 'not a lock\n');
  }
  assert.equal(existsSync(fixture.guardPath), false);
};

const probeMatrixCase = async (fixture: Fixture): Promise<void> => {
  const probes: Record<string, ProbeOutcome> = {
    '41001': 'alive',
    '41002': 'EPERM',
    '41003': 'ESRCH',
    '41004': 'EIO',
  };
  const lockFor = (name: string): string => {
    const directory = join(fixture.locksDirectory, name);
    mkdirSync(directory);
    return join(directory, `${CONFIG.registryName}.lock`);
  };
  const scenarios: {
    name: string;
    source: string;
    ageMs: number;
    expect: 'timeout' | 'acquired' | 'fail-closed';
  }[] = [
    {
      name: 'alive',
      source: ownerSource(41_001),
      ageMs: DAY_MS,
      expect: 'timeout',
    },
    {
      name: 'eperm',
      source: ownerSource(41_002),
      ageMs: DAY_MS,
      expect: 'timeout',
    },
    {
      name: 'esrch',
      source: ownerSource(41_003),
      ageMs: 0,
      expect: 'acquired',
    },
    {
      name: 'unexpected',
      source: ownerSource(41_004),
      ageMs: DAY_MS,
      expect: 'fail-closed',
    },
    { name: 'pid-zero', source: ownerSource(0), ageMs: 0, expect: 'timeout' },
    {
      name: 'pid-negative',
      source: ownerSource(-1),
      ageMs: 0,
      expect: 'timeout',
    },
    {
      name: 'pid-fraction',
      source: ownerSource(1.5),
      ageMs: 0,
      expect: 'timeout',
    },
    {
      name: 'pid-unsafe',
      source: ownerSource(2 ** 53),
      ageMs: 0,
      expect: 'timeout',
    },
    {
      name: 'pid-string',
      source: ownerSource('41005'),
      ageMs: 0,
      expect: 'timeout',
    },
    {
      name: 'pid-zero-aged',
      source: ownerSource(0),
      ageMs: DAY_MS,
      expect: 'acquired',
    },
    {
      name: 'foreign',
      source: ownerSource(41_006, FOREIGN_HOST),
      ageMs: DAY_MS,
      expect: 'timeout',
    },
  ];
  const planted = scenarios.map((scenario) => {
    const lockPath = lockFor(scenario.name);
    plantLock(fixture, scenario.source, scenario.ageMs, lockPath);
    return { ...scenario, lockPath, before: snapshot(lockPath) };
  });
  const worker = await startWorker(fixture, {
    modulePath: REAL_LOCK_MODULE,
    rules: [],
    probes,
  });
  const replies = await Promise.all(
    planted.map(({ name, lockPath }) =>
      worker.request({ command: 'acquire', handle: name, lockPath })
    )
  );
  planted.forEach((scenario, index) => {
    const reply = replies[index];
    assert.ok(reply);
    const label = `probe scenario ${scenario.name}`;
    if (scenario.expect === 'timeout') {
      assertTimedOut(reply, lockTimeoutOpening(scenario.lockPath));
      assert.equal(snapshot(scenario.lockPath), scenario.before, label);
    } else if (scenario.expect === 'fail-closed') {
      assert.equal(reply.ok, false, label);
      assertPrompt(reply);
      assertIncludes(
        reply.message,
        `Cannot tell whether pid 41004, the owner of the simulator registry lock ${scenario.lockPath}, is still running`
      );
      assertIncludes(reply.message, 'Nothing was removed.');
      assert.equal(snapshot(scenario.lockPath), scenario.before, label);
    } else {
      assert.equal(reply.ok, true, `${label}: ${reply.message}`);
      assertPrompt(reply);
      assert.notEqual(snapshot(scenario.lockPath), scenario.before, label);
    }
    assert.deepEqual(
      readdirSync(dirname(scenario.lockPath)),
      [`${CONFIG.registryName}.lock`],
      `${label}: no guard or quarantine directory may remain`
    );
  });

  const log = await worker.request({ command: 'probe-log' });
  const probed = new Map<number, number>();
  for (const call of log.probes) {
    assert.equal(call.signal, '0', 'a probe must only ever send signal 0');
    probed.set(call.pid, (probed.get(call.pid) ?? 0) + 1);
  }
  assert.deepEqual(
    [...probed.keys()].sort(),
    [41_001, 41_002, 41_003, 41_004],
    'invalid pids and foreign owners must never be probed'
  );
  assert.ok((probed.get(41_001) ?? 0) > 1);
  assert.ok((probed.get(41_002) ?? 0) > 1);
  assert.equal(probed.get(41_004), 1, 'an unknown probe result is final');
};

const releaseCase = async (fixture: Fixture): Promise<void> => {
  const first = await realWorker(fixture);
  const successor = await realWorker(fixture);
  const acquired = await first.request({ command: 'acquire', handle: 'a' });
  assert.equal(acquired.ok, true, acquired.message);

  const concurrent = await first.request({
    command: 'release',
    handle: 'a',
    calls: 3,
  });
  assert.equal(concurrent.results.length, 3);
  assert.ok(concurrent.results.every(({ ok }) => ok));
  assertNoCoordinationEntries(fixture);

  const next = await successor.request({ command: 'acquire', handle: 'b' });
  assert.equal(next.ok, true, next.message);
  const held = snapshot(fixture.lockPath);
  const late = await first.request({
    command: 'release',
    handle: 'a',
    calls: 2,
  });
  assert.ok(late.results.every(({ ok }) => ok));
  assert.equal(
    snapshot(fixture.lockPath),
    held,
    'a repeated release must not touch the successor'
  );
  const released = await successor.request({
    command: 'release',
    handle: 'b',
    calls: 1,
  });
  assert.equal(released.ok, true, released.message);
  assertNoCoordinationEntries(fixture);
};

const releaseAgainstCase = async (
  fixture: Fixture,
  suite: Suite,
  change:
    'other-directory' | 'other-token' | 'garbage' | 'no-metadata' | 'missing'
): Promise<void> => {
  const worker = await realWorker(fixture);
  const acquired = await worker.request({ command: 'acquire', handle: 'a' });
  assert.equal(acquired.ok, true, acquired.message);
  const ownerPath = join(fixture.lockPath, 'owner.json');
  if (change === 'other-directory') {
    replaceLock(fixture, ownerSource(suite.livePid));
  } else if (change === 'other-token') {
    writeFileSync(ownerPath, ownerSource(suite.livePid));
  } else if (change === 'garbage') {
    writeFileSync(ownerPath, '{ not json');
  } else if (change === 'no-metadata') {
    removeFixturePath(fixture, ownerPath);
  } else {
    removeFixturePath(fixture, fixture.lockPath);
  }
  const before = change === 'missing' ? '' : snapshot(fixture.lockPath);
  const released = await worker.request({
    command: 'release',
    handle: 'a',
    calls: 2,
  });
  assert.equal(released.results.length, 2);
  const [firstResult, secondResult] = released.results;
  assert.deepEqual(firstResult, secondResult, 'both calls share one outcome');
  if (change === 'garbage' || change === 'no-metadata') {
    assert.equal(released.ok, false);
    assertIncludes(
      released.message,
      `its owner metadata is missing or malformed, so it was not removed. It is retained at ${fixture.lockPath}.`
    );
  } else {
    assert.equal(released.ok, true, released.message);
  }
  if (change === 'missing') {
    assertNoCoordinationEntries(fixture);
    return;
  }
  assert.equal(snapshot(fixture.lockPath), before, 'the lock must survive');
  assert.deepEqual(coordinationEntries(fixture), [
    `${CONFIG.registryName}.lock`,
  ]);
};

const failRule = (
  name: string,
  operation: FsOperation,
  target: HookTarget,
  code: string,
  occurrence?: number
): HookRule => ({
  name,
  operation,
  target,
  phase: 'before',
  effect: 'fail',
  code,
  occurrence,
});

const publicationFailureCase = async (
  fixture: Fixture,
  suite: Suite,
  variant: 'cleaned' | 'cleanup-fails' | 'replaced'
): Promise<void> => {
  const rules: HookRule[] = [];
  if (variant === 'replaced') {
    rules.push({
      name: 'publishing',
      operation: 'writeFile',
      target: 'lock-owner',
      phase: 'before',
      effect: 'pause',
      occurrence: 1,
    });
  }
  rules.push(failRule('publish', 'writeFile', 'lock-owner', 'EIO', 1));
  if (variant === 'cleanup-fails') {
    rules.push(failRule('quarantine', 'rename', 'lock', 'EACCES'));
  }
  const worker = await instrumentedWorker(fixture, suite, rules);
  worker.send({ command: 'with', id: 9005, behaviour: 'return' });
  let replacement = '';
  if (variant === 'replaced') {
    await worker.waitFor('checkpoint', 'publishing');
    replacement = replaceLock(fixture, ownerSource(suite.livePid));
    worker.send({ command: 'resume', name: 'publishing' });
  }
  const reply = await worker.waitFor('reply', 9005);
  const message = reply.message ?? '';
  assert.equal(reply.ok, false);
  assert.equal(worker.seen('entered', ''), 0, 'the action must not run');
  const publication = `Cannot publish owner metadata for the simulator registry lock ${fixture.lockPath}: EIO: injected publish`;
  assert.ok(message.startsWith(publication), message);
  assert.equal(existsSync(fixture.guardPath), false);
  if (variant === 'cleaned') {
    assert.equal(message, publication);
    assertNoCoordinationEntries(fixture);
    return;
  }
  const cleanupAt = message.indexOf(
    'Removing the lock directory this command created also failed:'
  );
  assert.ok(cleanupAt > publication.length - 1, message);
  if (variant === 'cleanup-fails') {
    assertIncludes(message, 'EACCES: injected quarantine');
    assertIncludes(
      message,
      `Nothing was removed, and ${fixture.lockPath} is retained.`
    );
    assert.equal(existsSync(fixture.lockPath), true);
    assert.equal(existsSync(join(fixture.lockPath, 'owner.json')), false);
  } else {
    assertIncludes(
      message,
      `${fixture.lockPath} is no longer the directory this command created, so it was left untouched.`
    );
    assert.equal(snapshot(fixture.lockPath), replacement);
  }
  assert.deepEqual(coordinationEntries(fixture), [
    `${CONFIG.registryName}.lock`,
  ]);
};

const reclamationFailureCase = async (
  fixture: Fixture,
  suite: Suite,
  variant: 'quarantine-removal' | 'rename'
): Promise<void> => {
  const stale = ownerSource(suite.deadPid);
  plantLock(fixture, stale);
  const before = snapshot(fixture.lockPath);
  const worker = await instrumentedWorker(fixture, suite, [
    variant === 'rename'
      ? failRule('quarantine', 'rename', 'lock', 'EACCES')
      : failRule('remove', 'rm', 'quarantine', 'EIO'),
  ]);
  const reply = await worker.request({
    command: 'with',
    behaviour: 'return',
  });
  assert.equal(reply.ok, false);
  assert.equal(worker.seen('entered', ''), 0, 'the action must not run');
  assert.equal(existsSync(fixture.guardPath), false);
  if (variant === 'rename') {
    assertIncludes(reply.message, 'EACCES: injected quarantine');
    assertIncludes(
      reply.message,
      `Nothing was removed, and ${fixture.lockPath} is retained.`
    );
    assert.equal(snapshot(fixture.lockPath), before);
    assert.deepEqual(coordinationEntries(fixture), [
      `${CONFIG.registryName}.lock`,
    ]);
    return;
  }
  const [retained] = quarantinePaths(fixture);
  assert.ok(retained, 'the quarantine directory must be retained');
  assertIncludes(reply.message, 'EIO: injected remove');
  assertIncludes(reply.message, `It is retained at ${retained}.`);
  assert.equal(readFileSync(join(retained, 'owner.json'), 'utf8'), stale);
  assert.equal(
    existsSync(fixture.lockPath),
    false,
    'the shared pathname must not be recreated or removed as a fallback'
  );
  // The leftover does not block the next command.
  const next = await realWorker(fixture);
  const acquired = await next.request({ command: 'acquire', handle: 'a' });
  assert.equal(acquired.ok, true, acquired.message);
};

const releaseFailureCase = async (
  fixture: Fixture,
  suite: Suite,
  behaviour: 'return' | 'throw'
): Promise<void> => {
  const worker = await instrumentedWorker(fixture, suite, [
    failRule('remove', 'rm', 'quarantine', 'EIO'),
  ]);
  const reply = await worker.request({ command: 'with', behaviour });
  assert.equal(reply.ok, false, 'a failed release must not report success');
  assert.equal(worker.seen('entered', ''), 1);
  const [retained] = quarantinePaths(fixture);
  assert.ok(retained, 'the quarantine directory must be retained');
  const releaseDiagnostic = `Moved the simulator registry lock ${fixture.lockPath} aside but cannot remove it: EIO: injected remove\nIt is retained at ${retained}.`;
  assertIncludes(reply.message, releaseDiagnostic);
  if (behaviour === 'throw') {
    assert.ok(
      reply.message.startsWith(
        'fixture action failed\nReleasing the simulator registry lock also failed: '
      ),
      `the action error must come first:\n${reply.message}`
    );
  } else {
    assert.ok(reply.message.startsWith('Moved the simulator registry lock'));
  }
  assert.deepEqual(coordinationEntries(fixture), [
    retained.slice(fixture.locksDirectory.length + 1),
  ]);
};

const actionFailureCase = async (fixture: Fixture): Promise<void> => {
  const worker = await realWorker(fixture);
  const reply = await worker.request({ command: 'with', behaviour: 'throw' });
  assert.equal(reply.ok, false);
  assert.equal(reply.message, 'fixture action failed');
  assertNoCoordinationEntries(fixture);
  const result = await worker.request({ command: 'with', behaviour: 'return' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.message, 'fixture result');
  assertNoCoordinationEntries(fixture);
};

const guardReleaseFailureCase = async (
  fixture: Fixture,
  suite: Suite
): Promise<void> => {
  const worker = await instrumentedWorker(fixture, suite, [
    failRule('unguard', 'rmdir', 'guard', 'EIO', 1),
  ]);
  const reply = await worker.request({ command: 'with', behaviour: 'return' });
  assert.equal(reply.ok, false);
  assert.equal(worker.seen('entered', ''), 0, 'the action must not run');
  assert.ok(
    reply.message.startsWith(
      `Cannot finish taking the simulator registry lock ${fixture.lockPath}: releasing the transition guard ${fixture.guardPath} failed: EIO: injected unguard`
    ),
    reply.message
  );
  assertIncludes(
    reply.message,
    'The lock this command had just taken was removed again.'
  );
  assertGuardGuidance(fixture, reply.message);
  assert.deepEqual(coordinationEntries(fixture), [
    `${CONFIG.registryName}.lock.guard`,
  ]);
};

const guardCrashCase = async (
  fixture: Fixture,
  suite: Suite,
  rule: HookRule,
  plantStale: boolean,
  expected: 'guard-only' | 'unpublished-lock' | 'stale-lock' | 'quarantine'
): Promise<void> => {
  if (plantStale) plantLock(fixture, ownerSource(suite.deadPid));
  const victim = await instrumentedWorker(fixture, suite, [rule]);
  victim.send({ command: 'with', id: 9006, behaviour: 'return' });
  await victim.waitFor('checkpoint', rule.name);
  await victim.kill();

  const leftBehind = coordinationEntries(fixture);
  assert.ok(leftBehind.includes(`${CONFIG.registryName}.lock.guard`));
  const contender = await realWorker(fixture);
  const reply = await contender.request({ command: 'acquire', handle: 'a' });
  assertTimedOut(reply, guardTimeoutOpening(fixture.guardPath));
  assertGuardGuidance(fixture, reply.message);
  assert.deepEqual(
    coordinationEntries(fixture),
    leftBehind,
    'a contender must not clear anything a crashed transition left'
  );
  const quarantined = quarantinePaths(fixture);
  if (expected === 'guard-only') {
    assert.deepEqual(leftBehind, [`${CONFIG.registryName}.lock.guard`]);
    assertIncludes(reply.message, 'Guard owner: missing or malformed');
  } else {
    assertIncludes(
      reply.message,
      `Guard owner: pid ${victim.pid} on this host`
    );
  }
  if (expected === 'quarantine') {
    const [retained] = quarantined;
    assert.ok(retained, 'the quarantine directory must be left behind');
    assertIncludes(reply.message, `\n  ${retained}\n`);
    assert.equal(existsSync(fixture.lockPath), false);
  } else {
    assert.deepEqual(quarantined, []);
  }

  // Manual recovery as the message describes it: remove the guard and any
  // quarantine directory, leave the lock itself to normal acquisition.
  removeFixturePath(fixture, fixture.guardPath);
  for (const path of quarantined) removeFixturePath(fixture, path);
  if (expected === 'unpublished-lock') {
    assert.equal(existsSync(join(fixture.lockPath, 'owner.json')), false);
    // Stands in for the 60 seconds a lock without metadata is protected.
    const then = new Date(Date.now() - DAY_MS);
    utimesSync(fixture.lockPath, then, then);
  }
  const recovered = await contender.request({
    command: 'acquire',
    handle: 'b',
  });
  assert.equal(recovered.ok, true, recovered.message);
  assertPrompt(recovered);
  const released = await contender.request({
    command: 'release',
    handle: 'b',
    calls: 1,
  });
  assert.equal(released.ok, true, released.message);
  assertNoCoordinationEntries(fixture);
};

const actionCrashCase = async (fixture: Fixture): Promise<void> => {
  const victim = await realWorker(fixture);
  victim.send({ command: 'with', id: 9007, behaviour: 'hold' });
  await victim.waitFor('entered', '');
  await victim.kill();
  assert.deepEqual(
    coordinationEntries(fixture),
    [`${CONFIG.registryName}.lock`],
    'a command inside its action holds the lock but not the guard'
  );
  const contender = await realWorker(fixture);
  const reply = await contender.request({
    command: 'with',
    behaviour: 'return',
  });
  assert.equal(reply.ok, true, reply.message);
  assertPrompt(reply);
  assertNoCoordinationEntries(fixture);
};

const repeatedReclamationCase = async (
  fixture: Fixture,
  suite: Suite
): Promise<void> => {
  plantLock(fixture, ownerSource(suite.deadPid));
  // Every time the worker is about to create the lock, a new dead owner's lock
  // appears in its place, so each attempt ends in another retryable transition.
  const worker = await instrumentedWorker(fixture, suite, [
    {
      name: 'replant',
      operation: 'mkdir',
      target: 'lock',
      phase: 'before',
      effect: 'plant-dead-lock',
    },
    {
      name: 'reclaimed',
      operation: 'rename',
      target: 'lock',
      phase: 'after',
      effect: 'notify',
    },
  ]);
  const reply = await worker.request({ command: 'with', behaviour: 'return' });
  assertTimedOut(reply, lockTimeoutOpening(fixture.lockPath));
  assertIncludes(
    reply.message,
    'It kept being replaced while this command tried to take it.'
  );
  assert.equal(worker.seen('entered', ''), 0);
  assert.ok(
    worker.seen('notice', 'reclaimed') >= 20,
    `expected many reclamations inside one deadline, saw ${worker.seen('notice', 'reclaimed')}`
  );
  assert.equal(existsSync(fixture.guardPath), false);
  assert.deepEqual(quarantinePaths(fixture), []);
};

const shiftingContentionCase = async (
  fixture: Fixture,
  suite: Suite
): Promise<void> => {
  // The wait starts on a guard and continues on a live lock. A deadline that
  // restarted when the guard cleared would run 5 seconds past the limit.
  plantLock(fixture, ownerSource(suite.livePid));
  mkdirSync(fixture.guardPath);
  const worker = await realWorker(fixture);
  const pending = worker.request({ command: 'acquire', handle: 'a' });
  await sleep(5_000);
  removeFixturePath(fixture, fixture.guardPath);
  const reply = await pending;
  assertTimedOut(reply, lockTimeoutOpening(fixture.lockPath));
  assert.deepEqual(coordinationEntries(fixture), [
    `${CONFIG.registryName}.lock`,
  ]);
};

const releaseDeadlineCase = async (fixture: Fixture): Promise<void> => {
  const worker = await realWorker(fixture);
  const acquired = await worker.request({ command: 'acquire', handle: 'a' });
  assert.equal(acquired.ok, true, acquired.message);
  const held = snapshot(fixture.lockPath);
  mkdirSync(fixture.guardPath);
  const released = await worker.request({
    command: 'release',
    handle: 'a',
    calls: 1,
  });
  assertTimedOut(released, guardTimeoutOpening(fixture.guardPath));
  assertGuardGuidance(fixture, released.message);
  assertIncludes(
    released.message,
    `The registry lock this command holds at ${fixture.lockPath} was not released.`
  );
  assert.equal(snapshot(fixture.lockPath), held);
};

const pauseRule = (
  name: string,
  operation: FsOperation,
  target: HookTarget,
  phase: HookPhase
): HookRule => ({
  name,
  operation,
  target,
  phase,
  effect: 'pause',
  occurrence: 1,
});

const CASES: Case[] = [
  {
    name: 'contention: 8 commands, 3 registry updates each, over a stale lock',
    evidence: UNMODIFIED,
    check: contendersCase,
  },
  {
    name: 'stale observation: replacement survives a paused waiter',
    evidence: `${CHECKPOINTS}; the replacement ignores the guard`,
    check: staleObservationCase,
  },
  {
    name: 'stale observation: swap after revalidation is retained, not deleted',
    evidence: `${CHECKPOINTS}; the replacement ignores the guard`,
    check: swapAfterRevalidationCase,
  },
  {
    name: 'guard: owner publication blocks other transitions',
    evidence: CHECKPOINTS,
    check: (fixture, suite) =>
      blockedTransitionCase(
        fixture,
        suite,
        pauseRule('publishing', 'writeFile', 'lock-owner', 'before'),
        false
      ),
  },
  {
    name: 'guard: reclamation blocks other transitions',
    evidence: CHECKPOINTS,
    check: (fixture, suite) =>
      blockedTransitionCase(
        fixture,
        suite,
        pauseRule('reclaiming', 'rename', 'lock', 'before'),
        true
      ),
  },
  {
    name: 'owner: live local owner with old timestamps is protected',
    evidence: UNMODIFIED,
    check: (fixture, suite) =>
      protectedCase(
        fixture,
        ownerSource(suite.livePid, hostname(), '2001-01-01T00:00:00.000Z'),
        DAY_MS
      ),
  },
  {
    name: 'owner: old foreign-host owner with a locally dead pid is protected',
    evidence: UNMODIFIED,
    check: (fixture, suite) =>
      protectedCase(
        fixture,
        ownerSource(suite.deadPid, FOREIGN_HOST, '2001-01-01T00:00:00.000Z'),
        DAY_MS
      ),
  },
  {
    name: 'owner: fresh lock without metadata is protected',
    evidence: UNMODIFIED,
    check: (fixture) => protectedCase(fixture, undefined, 0),
  },
  {
    name: 'owner: fresh lock with unparsable metadata is protected',
    evidence: UNMODIFIED,
    check: (fixture) => protectedCase(fixture, '{ not json', 0),
  },
  {
    name: 'owner: fresh lock with the wrong metadata shape is protected',
    evidence: UNMODIFIED,
    check: (fixture) => protectedCase(fixture, '{"pid":"12"}\n', 0),
  },
  {
    name: 'owner: dead local owner is reclaimed',
    evidence: UNMODIFIED,
    check: (fixture, suite) =>
      recoveredCase(fixture, ownerSource(suite.deadPid), 0),
  },
  {
    name: 'owner: aged lock without metadata is reclaimed',
    evidence: UNMODIFIED,
    check: (fixture) => recoveredCase(fixture, undefined, DAY_MS),
  },
  {
    name: 'owner: aged lock with unparsable metadata is reclaimed',
    evidence: UNMODIFIED,
    check: (fixture) => recoveredCase(fixture, '{ not json', DAY_MS),
  },
  {
    name: 'path: symbolic link at the lock path is refused',
    evidence: UNMODIFIED,
    check: (fixture) => rejectedPathCase(fixture, 'symlink'),
  },
  {
    name: 'path: regular file at the lock path is refused',
    evidence: UNMODIFIED,
    check: (fixture) => rejectedPathCase(fixture, 'file'),
  },
  {
    name: 'probe: success, EPERM, ESRCH, unexpected error, invalid pid, foreign host',
    evidence: PROBES,
    check: probeMatrixCase,
  },
  {
    name: 'release: concurrent calls, and again after a successor acquires',
    evidence: UNMODIFIED,
    check: releaseCase,
  },
  {
    name: 'release: replacement directory is left alone',
    evidence: `${UNMODIFIED}; the replacement ignores the guard`,
    check: (fixture, suite) =>
      releaseAgainstCase(fixture, suite, 'other-directory'),
  },
  {
    name: 'release: same directory with another token is left alone',
    evidence: UNMODIFIED,
    check: (fixture, suite) =>
      releaseAgainstCase(fixture, suite, 'other-token'),
  },
  {
    name: 'release: unparsable metadata on the held directory is an error',
    evidence: UNMODIFIED,
    check: (fixture, suite) => releaseAgainstCase(fixture, suite, 'garbage'),
  },
  {
    name: 'release: missing metadata on the held directory is an error',
    evidence: UNMODIFIED,
    check: (fixture, suite) =>
      releaseAgainstCase(fixture, suite, 'no-metadata'),
  },
  {
    name: 'release: missing lock is left alone',
    evidence: UNMODIFIED,
    check: (fixture, suite) => releaseAgainstCase(fixture, suite, 'missing'),
  },
  {
    name: 'failure: owner publication fails, created directory is removed',
    evidence: FAULTS,
    check: (fixture, suite) =>
      publicationFailureCase(fixture, suite, 'cleaned'),
  },
  {
    name: 'failure: owner publication and its cleanup both fail',
    evidence: FAULTS,
    check: (fixture, suite) =>
      publicationFailureCase(fixture, suite, 'cleanup-fails'),
  },
  {
    name: 'failure: publication cleanup leaves a replacement alone',
    evidence: `${FAULTS}; the replacement ignores the guard`,
    check: (fixture, suite) =>
      publicationFailureCase(fixture, suite, 'replaced'),
  },
  {
    name: 'failure: quarantine removal fails during reclamation',
    evidence: FAULTS,
    check: (fixture, suite) =>
      reclamationFailureCase(fixture, suite, 'quarantine-removal'),
  },
  {
    name: 'failure: quarantine rename fails during reclamation',
    evidence: FAULTS,
    check: (fixture, suite) => reclamationFailureCase(fixture, suite, 'rename'),
  },
  {
    name: 'failure: release fails after a successful action',
    evidence: FAULTS,
    check: (fixture, suite) => releaseFailureCase(fixture, suite, 'return'),
  },
  {
    name: 'failure: action and release both fail',
    evidence: FAULTS,
    check: (fixture, suite) => releaseFailureCase(fixture, suite, 'throw'),
  },
  {
    name: 'failure: action fails and release succeeds',
    evidence: UNMODIFIED,
    check: actionFailureCase,
  },
  {
    name: 'failure: guard release fails after the lock was taken',
    evidence: FAULTS,
    check: guardReleaseFailureCase,
  },
  {
    name: 'crash: after guard creation',
    evidence: CRASH,
    check: (fixture, suite) =>
      guardCrashCase(
        fixture,
        suite,
        pauseRule('guarded', 'mkdir', 'guard', 'after'),
        false,
        'guard-only'
      ),
  },
  {
    name: 'crash: during owner publication',
    evidence: CRASH,
    check: (fixture, suite) =>
      guardCrashCase(
        fixture,
        suite,
        pauseRule('publishing', 'writeFile', 'lock-owner', 'before'),
        false,
        'unpublished-lock'
      ),
  },
  {
    name: 'crash: before the quarantine rename',
    evidence: CRASH,
    check: (fixture, suite) =>
      guardCrashCase(
        fixture,
        suite,
        pauseRule('renaming', 'rename', 'lock', 'before'),
        true,
        'stale-lock'
      ),
  },
  {
    name: 'crash: after the quarantine rename',
    evidence: CRASH,
    check: (fixture, suite) =>
      guardCrashCase(
        fixture,
        suite,
        pauseRule('renamed', 'rename', 'lock', 'after'),
        true,
        'quarantine'
      ),
  },
  {
    name: 'crash: inside the registry action, recovered automatically',
    evidence: UNMODIFIED,
    check: actionCrashCase,
  },
  {
    name: 'deadline: repeated reclamation does not extend the wait',
    evidence: `${CHECKPOINTS}; a replanted lock ignores the guard`,
    check: repeatedReclamationCase,
  },
  {
    name: 'deadline: guard contention followed by lock contention',
    evidence: UNMODIFIED,
    check: shiftingContentionCase,
  },
  {
    name: 'deadline: release waits on the guard for its own bounded time',
    evidence: UNMODIFIED,
    check: releaseDeadlineCase,
  },
];

// The wrapper exports the same names as `node:fs/promises` for every function
// the lock module imports. A name it lacks fails the import, so a new
// filesystem call in the module cannot slip past the instrumentation.
const FS_WRAPPER_SOURCE = `import * as real from 'node:fs/promises';

const KEY = Symbol.for(${JSON.stringify(HOOK_KEY)});
const wrap = (operation) => async (...args) => {
  const hook = globalThis[KEY];
  if (hook) await hook(operation, 'before', args);
  let result;
  try {
    result = await real[operation](...args);
  } catch (error) {
    if (hook) await hook(operation, 'failed', args);
    throw error;
  }
  if (hook) await hook(operation, 'after', args);
  return result;
};

export const lstat = wrap('lstat');
export const mkdir = wrap('mkdir');
export const readdir = wrap('readdir');
export const readFile = wrap('readFile');
export const rename = wrap('rename');
export const rm = wrap('rm');
export const rmdir = wrap('rmdir');
export const writeFile = wrap('writeFile');
`;

const writeInstrumentedModule = (suiteRoot: string): string => {
  const directory = join(suiteRoot, 'instrumented');
  mkdirSync(directory);
  const wrapperPath = join(directory, 'fs-wrapper.mjs');
  writeFileSync(wrapperPath, FS_WRAPPER_SOURCE);
  const source = readFileSync(REAL_LOCK_MODULE, 'utf8');
  const fsImport = "from 'node:fs/promises'";
  assert.equal(
    source.split(fsImport).length,
    2,
    'the lock module must import node:fs/promises exactly once'
  );
  const instrumented = source
    .replace(fsImport, `from ${JSON.stringify(wrapperPath)}`)
    .replace(
      /from '\.\.\/([^']+)'/g,
      (_match, path: string) =>
        `from ${JSON.stringify(join(SOURCE_ROOT, path))}`
    );
  assert.equal(
    /from '\.{1,2}\//.test(instrumented),
    false,
    'every relative import of the lock module must be redirected to src/'
  );
  assert.equal(
    /from 'node:fs'|require\(/.test(instrumented),
    false,
    'the lock module must reach the filesystem only through node:fs/promises'
  );
  const modulePath = join(directory, 'lock.ts');
  writeFileSync(modulePath, instrumented);
  return modulePath;
};

// A pid that belonged to a child of this script and has exited.
const findDeadPid = (): number => {
  const result = spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' });
  if (result.error) throw result.error;
  return result.pid;
};

const verify = async (): Promise<void> => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), ROOT_PREFIX)));
  let failed = 0;
  try {
    const sharedFixture = createFixture(
      { root, instrumentedModule: '', deadPid: 0, livePid: 0 },
      0
    );
    // An idle worker whose pid stands for a running command.
    const idle = await realWorker(sharedFixture);
    const suite: Suite = {
      root,
      instrumentedModule: writeInstrumentedModule(root),
      deadPid: findDeadPid(),
      livePid: idle.pid,
    };
    const outcomes = await Promise.all(
      CASES.map(async ({ check }, index) => {
        try {
          await check(createFixture(suite, index + 1), suite);
          return undefined;
        } catch (error: unknown) {
          return error;
        }
      })
    );
    CASES.forEach(({ name, evidence }, index) => {
      const error = outcomes[index];
      if (error === undefined) {
        console.log(`ok    ${name} [${evidence}]`);
        return;
      }
      failed += 1;
      console.error(`FAIL  ${name} [${evidence}]\n${errorMessage(error)}`);
    });
  } finally {
    for (const child of workers) child.kill('SIGKILL');
    rmSync(root, { recursive: true, force: true });
  }
  const instrumented = CASES.filter(({ evidence }) =>
    evidence.startsWith('instrumented')
  ).length;
  const probed = CASES.filter(({ evidence }) => evidence === PROBES).length;
  console.log(
    `\n${CASES.length - failed} of ${CASES.length} cases passed. ${instrumented} use the instrumented copy, ${probed} replaces process.kill in a child, and ${CASES.length - instrumented - probed} use only the unmodified module.`
  );
  if (failed > 0) process.exitCode = 1;
};

// ---------------------------------------------------------------------------
// Child half: one worker, driven by commands from the parent
// ---------------------------------------------------------------------------

const decodeSetup = (source: string): WorkerSetup => {
  const parsed: unknown = JSON.parse(source);
  if (
    !isRecord(parsed) ||
    typeof parsed.root !== 'string' ||
    typeof parsed.modulePath !== 'string' ||
    typeof parsed.lockPath !== 'string' ||
    !Array.isArray(parsed.rules)
  ) {
    throw new Error('malformed worker setup');
  }
  const probes: Record<string, ProbeOutcome> = {};
  if (isRecord(parsed.probes)) {
    for (const [pid, outcome] of Object.entries(parsed.probes)) {
      if (isOneOf(PROBE_OUTCOMES, outcome)) probes[pid] = outcome;
    }
  }
  const rules = parsed.rules.map((rule: unknown): HookRule => {
    if (
      !isRecord(rule) ||
      typeof rule.name !== 'string' ||
      !isOneOf(FS_OPERATIONS, rule.operation) ||
      !isOneOf(HOOK_TARGETS, rule.target) ||
      !isOneOf(HOOK_PHASES, rule.phase) ||
      !isOneOf(HOOK_EFFECTS, rule.effect)
    ) {
      throw new Error('malformed hook rule');
    }
    return {
      name: rule.name,
      operation: rule.operation,
      target: rule.target,
      phase: rule.phase,
      effect: rule.effect,
      occurrence: optionalNumber(rule.occurrence),
      code: optionalString(rule.code),
    };
  });
  return {
    root: parsed.root,
    modulePath: parsed.modulePath,
    lockPath: parsed.lockPath,
    rules,
    probes: isRecord(parsed.probes) ? probes : undefined,
    deadPid: optionalNumber(parsed.deadPid),
  };
};

const isLockModule = (value: unknown): value is LockModule =>
  isRecord(value) &&
  typeof value.acquireLock === 'function' &&
  typeof value.withRegistryLock === 'function';

const targetOf = (
  setup: WorkerSetup,
  path: unknown
): HookTarget | undefined => {
  if (typeof path !== 'string') return undefined;
  const guardPath = `${setup.lockPath}.guard`;
  if (path === setup.lockPath) return 'lock';
  if (path === join(setup.lockPath, 'owner.json')) return 'lock-owner';
  if (path === guardPath) return 'guard';
  if (path === join(guardPath, 'owner.json')) return 'guard-owner';
  if (path.startsWith(`${setup.lockPath}.`) && path.endsWith('.stale')) {
    return 'quarantine';
  }
  return undefined;
};

const runWorker = async (setup: WorkerSetup): Promise<void> => {
  assertInside(setup.root, setup.lockPath);
  setTimeout(() => process.exit(86), WORKER_LIFETIME_MS);
  process.on('disconnect', () => process.exit(87));
  const emit = (message: WorkerMessage): void => {
    process.send?.(message);
  };

  const resumers = new Map<string, () => void>();
  const ruleCalls = new Map<HookRule, number>();
  const hook = async (
    operation: string,
    phase: string,
    args: unknown[]
  ): Promise<void> => {
    const target = targetOf(setup, args[0]);
    for (const rule of setup.rules) {
      if (
        rule.operation !== operation ||
        rule.phase !== phase ||
        rule.target !== target
      ) {
        continue;
      }
      const call = (ruleCalls.get(rule) ?? 0) + 1;
      ruleCalls.set(rule, call);
      if (rule.occurrence !== undefined && rule.occurrence !== call) continue;
      if (rule.effect === 'notify') {
        emit({ event: 'notice', name: rule.name });
      } else if (rule.effect === 'pause') {
        await new Promise<void>((resume) => {
          resumers.set(rule.name, resume);
          emit({ event: 'checkpoint', name: rule.name });
        });
      } else if (rule.effect === 'plant-dead-lock') {
        if (!existsSync(setup.lockPath)) {
          mkdirSync(setup.lockPath);
          writeFileSync(
            join(setup.lockPath, 'owner.json'),
            ownerSource(setup.deadPid)
          );
        }
      } else {
        throw Object.assign(
          new Error(`${rule.code ?? 'EIO'}: injected ${rule.name}`),
          { code: rule.code ?? 'EIO' }
        );
      }
    }
  };
  if (setup.rules.length > 0) {
    Reflect.set(globalThis, Symbol.for(HOOK_KEY), hook);
  }

  const probeCalls: ProbeCall[] = [];
  const probeTable = setup.probes;
  if (probeTable) {
    // Nothing is signalled: every probe is answered from the table, and a pid
    // outside it is recorded and refused.
    process.kill = (pid: number, signal?: string | number): true => {
      probeCalls.push({ pid, signal: String(signal) });
      const outcome = probeTable[String(pid)];
      if (outcome === 'alive') return true;
      throw Object.assign(
        new Error(`${outcome ?? 'EFIXTURE'}: fixture probe`),
        {
          code: outcome ?? 'EFIXTURE',
        }
      );
    };
  }

  const loaded: unknown = await import(setup.modulePath);
  if (!isLockModule(loaded)) throw new Error('not a lock module');
  const { acquireLock, withRegistryLock } = loaded;
  const context = contextFor(setup.root);
  const handles = new Map<string, () => Promise<void>>();
  let leave: (() => void) | undefined;

  const timed = async (
    id: number | undefined,
    work: () => Promise<Partial<WorkerMessage>>
  ): Promise<void> => {
    const startedAt = Date.now();
    try {
      const extra = await work();
      emit({
        event: 'reply',
        id,
        ok: true,
        elapsedMs: Date.now() - startedAt,
        ...extra,
      });
    } catch (error: unknown) {
      emit({
        event: 'reply',
        id,
        ok: false,
        message: errorMessage(error),
        elapsedMs: Date.now() - startedAt,
      });
    }
  };

  const contend = async (command: WorkerCommand): Promise<void> => {
    const sentinel = command.sentinel ?? '';
    assertInside(setup.root, sentinel);
    for (let round = 0; round < (command.rounds ?? 0); round += 1) {
      await withRegistryLock(setup.lockPath, async () => {
        // Exclusive: a second action inside the lock fails on this mkdir.
        mkdirSync(sentinel);
        appendFileSync(
          join(setup.root, 'journal.log'),
          `enter ${command.worker}\n`
        );
        const state = await readState(context);
        const usedPorts = new Set(state.assignments.map(({ port }) => port));
        let port = CONFIG.ports.start;
        while (usedPorts.has(port)) port += 1;
        const udid = `FIXTURE-${command.worker}-${round}`;
        await sleep(5);
        await writeState(context.statePath, {
          version: STATE_VERSION,
          assignments: [
            ...state.assignments,
            {
              worktree: join(setup.root, `worktree-${command.worker}-${round}`),
              simulatorUdid: udid,
              port,
            },
          ],
          simulators: [...state.simulators, { udid, name: `Fixture ${udid}` }],
        });
        appendFileSync(
          join(setup.root, 'journal.log'),
          `leave ${command.worker}\n`
        );
        rmdirSync(sentinel);
      });
    }
  };

  const handle = async (command: WorkerCommand): Promise<void> => {
    const lockPath = command.lockPath ?? setup.lockPath;
    assertInside(setup.root, lockPath);
    if (command.command === 'resume') {
      resumers.get(command.name ?? '')?.();
      return;
    }
    if (command.command === 'leave') {
      leave?.();
      return;
    }
    if (command.command === 'acquire') {
      await timed(command.id, async () => {
        handles.set(command.handle ?? '', await acquireLock(lockPath));
        return {};
      });
      return;
    }
    if (command.command === 'release') {
      const release = handles.get(command.handle ?? '');
      const startedAt = Date.now();
      const results = await Promise.all(
        Array.from({ length: command.calls ?? 1 }, async () => {
          try {
            if (!release) throw new Error('no such handle');
            await release();
            return { ok: true, message: '' };
          } catch (error: unknown) {
            return { ok: false, message: errorMessage(error) };
          }
        })
      );
      const failure = results.find(({ ok }) => !ok);
      emit({
        event: 'reply',
        id: command.id,
        ok: failure === undefined,
        message: failure?.message ?? '',
        elapsedMs: Date.now() - startedAt,
        results,
      });
      return;
    }
    if (command.command === 'with') {
      await timed(command.id, async () => {
        const value = await withRegistryLock(lockPath, async () => {
          if (command.sentinel) {
            assertInside(setup.root, command.sentinel);
            mkdirSync(command.sentinel);
          }
          emit({ event: 'entered', name: '' });
          if (command.behaviour === 'throw') {
            throw new Error('fixture action failed');
          }
          if (command.behaviour === 'hold') {
            await new Promise<void>((resolveLeave) => {
              leave = resolveLeave;
            });
          }
          if (command.sentinel) rmdirSync(command.sentinel);
          return 'fixture result';
        });
        return { message: value };
      });
      return;
    }
    if (command.command === 'contend') {
      await timed(command.id, async () => {
        await contend(command);
        return {};
      });
      return;
    }
    if (command.command === 'probe-log') {
      emit({ event: 'reply', id: command.id, ok: true, probes: probeCalls });
    }
  };

  process.on('message', (raw: unknown) => {
    if (!isRecord(raw) || typeof raw.command !== 'string') return;
    void handle({
      command: raw.command,
      id: optionalNumber(raw.id),
      name: optionalString(raw.name),
      handle: optionalString(raw.handle),
      lockPath: optionalString(raw.lockPath),
      calls: optionalNumber(raw.calls),
      behaviour: optionalString(raw.behaviour),
      sentinel: optionalString(raw.sentinel),
      rounds: optionalNumber(raw.rounds),
      worker: optionalNumber(raw.worker),
    });
  });
  emit({ event: 'ready', name: '' });
};

const [mode, childSetup] = process.argv.slice(2);
if (mode === CHILD_FLAG && childSetup) {
  runWorker(decodeSetup(childSetup)).catch((error: unknown) => {
    console.error(`fixture worker failed: ${errorMessage(error)}`);
    process.exit(1);
  });
} else {
  verify().catch((error: unknown) => {
    console.error(`verify-lock failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
