import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import type { WorktreeDevicesConfig } from '../config';
import type { Assignment } from '../types';

// A reserved port proves nothing about who listens on it, so a listener is only
// ever signalled after it is verified as the Expo dev server of the assignment
// the port belongs to. Verified means both of these hold:
//
// 1. Metro identity. The command line runs the Expo executable with `run:ios`
//    and carries the assignment's `--device <udid>` and `--port <port>`, the
//    arguments `launchExpo` passes.
// 2. Worktree ownership. The working directory is the assigned worktree's app
//    directory, where `launchExpo` starts Expo, or the process is the recorded
//    runner of the assignment or one of its descendants.
//
// The runner lease can only stand in for the working directory. It never
// replaces the command line check, so a reused runner PID cannot make an
// unrelated process verified. Anything that cannot be read, or reads
// ambiguously, counts as not verified.

export interface ListenerTarget {
  worktree: string;
  appDirectory: string;
  simulatorUdid: string;
  port: number;
  /** PID of the `run` command that started Expo, when one is recorded for this host. */
  runnerPid?: number;
}

export interface PortListener {
  pid: number;
  /** Command line as `ps` printed it. Absent when it could not be read. */
  command?: string;
  verified: boolean;
  /** Why the listener is not verified. Empty when it is. */
  reasons: string[];
}

interface ProcessFacts {
  parentPid: number;
  command: string;
}

const MAX_ANCESTOR_HOPS = 64;
const MAX_DESCRIBED_COMMAND_LENGTH = 240;

// A lease from another host names a process this machine cannot inspect.
const runnerPidOf = ({ runner }: Assignment): number | undefined =>
  runner !== undefined &&
  Number.isInteger(runner.pid) &&
  runner.pid > 1 &&
  runner.hostname === hostname()
    ? runner.pid
    : undefined;

export const listenerTarget = (
  config: WorktreeDevicesConfig,
  assignment: Assignment
): ListenerTarget => ({
  worktree: assignment.worktree,
  appDirectory: join(assignment.worktree, config.appDirectory),
  simulatorUdid: assignment.simulatorUdid,
  port: assignment.port,
  runnerPid: runnerPidOf(assignment),
});

const toolOutput = (
  executable: string,
  args: string[],
  cwd: string
): string | undefined => {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) return undefined;
  return typeof result.stdout === 'string' ? result.stdout : undefined;
};

// lsof exits with 1 when nothing matches, which is an empty result here too.
const listeningPids = (cwd: string, port: number): number[] => {
  const result = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || typeof result.stdout !== 'string') return [];
  const pids = result.stdout
    .split('\n')
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isInteger(pid) && pid > 1);
  return [...new Set(pids)];
};

const readProcess = (cwd: string, pid: number): ProcessFacts | undefined => {
  const output = toolOutput(
    'ps',
    ['-ww', '-o', 'ppid=,command=', '-p', String(pid)],
    cwd
  );
  const lines = (output ?? '').split('\n').filter((line) => line.trim());
  if (lines.length !== 1) return undefined;
  const match = /^\s*(\d+)\s+(\S.*)$/.exec(lines[0] ?? '');
  if (!match) return undefined;
  return {
    parentPid: Number.parseInt(match[1] ?? '', 10),
    command: (match[2] ?? '').trim(),
  };
};

const canonicalDirectory = (path: string): string | undefined => {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
};

// `lsof -Fn` prints one field per line: `p<pid>`, `fcwd`, then `n<path>`.
const readWorkingDirectory = (cwd: string, pid: number): string | undefined => {
  const output = toolOutput(
    'lsof',
    ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
    cwd
  );
  const lines = (output ?? '').split('\n').filter((line) => line !== '');
  const paths = lines.filter((line) => line.startsWith('n'));
  if (!lines.includes(`p${pid}`) || paths.length !== 1) return undefined;
  return canonicalDirectory((paths[0] ?? '').slice(1));
};

const escapePattern = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const carriesOption = (command: string, flag: string, value: string): boolean =>
  new RegExp(`\\s${flag}\\s+${escapePattern(value)}(\\s|$)`).test(command);

// `node_modules/.bin/expo` is a script, so the command line is its interpreter
// followed by the script path. The path may also be the script's real
// location, `expo/bin/cli`.
const EXPO_RUN_IOS = /(^|[\s/])expo(\/bin\/cli)?\s+run:ios(\s|$)/;

const isAssignedExpo = (command: string, target: ListenerTarget): boolean =>
  EXPO_RUN_IOS.test(command) &&
  carriesOption(command, '--device', target.simulatorUdid) &&
  carriesOption(command, '--port', String(target.port));

const descendsFrom = (
  cwd: string,
  pid: number,
  facts: ProcessFacts,
  ancestorPid: number
): boolean => {
  if (pid === ancestorPid) return true;
  let parentPid = facts.parentPid;
  for (let hop = 0; hop < MAX_ANCESTOR_HOPS; hop += 1) {
    if (parentPid === ancestorPid) return true;
    if (!Number.isInteger(parentPid) || parentPid <= 1) return false;
    const parent = readProcess(cwd, parentPid);
    if (!parent) return false;
    parentPid = parent.parentPid;
  }
  return false;
};

const ownershipFailure = (
  cwd: string,
  pid: number,
  facts: ProcessFacts,
  target: ListenerTarget
): string | undefined => {
  const expected = canonicalDirectory(target.appDirectory);
  const actual = readWorkingDirectory(cwd, pid);
  if (expected !== undefined && actual === expected) return undefined;
  if (
    target.runnerPid !== undefined &&
    descendsFrom(cwd, pid, facts, target.runnerPid)
  ) {
    return undefined;
  }
  const directory =
    actual === undefined
      ? 'its working directory could not be read'
      : `its working directory is ${actual}, not ${expected ?? target.appDirectory}`;
  return target.runnerPid === undefined
    ? directory
    : `${directory}, and it was not started by the recorded runner (PID ${target.runnerPid})`;
};

const inspectListener = (
  cwd: string,
  pid: number,
  target: ListenerTarget
): PortListener => {
  const facts = readProcess(cwd, pid);
  if (!facts) {
    return {
      pid,
      verified: false,
      reasons: ['its command line could not be read'],
    };
  }
  const reasons: string[] = [];
  if (!isAssignedExpo(facts.command, target)) {
    reasons.push(
      `its command line is not "expo run:ios" with --device ${target.simulatorUdid} and --port ${target.port}`
    );
  }
  const ownership = ownershipFailure(cwd, pid, facts, target);
  if (ownership) reasons.push(ownership);
  return {
    pid,
    command: facts.command,
    verified: reasons.length === 0,
    reasons,
  };
};

// Every call inspects afresh. A PID can exit and be reused between two looks,
// so a caller that signals more than once asks again before each signal.
export const inspectPortListeners = (
  cwd: string,
  target: ListenerTarget
): PortListener[] =>
  listeningPids(cwd, target.port).map((pid) =>
    inspectListener(cwd, pid, target)
  );

export const describeListener = ({ pid, command }: PortListener): string => {
  if (command === undefined) return `PID ${pid} (command line unreadable)`;
  const shown =
    command.length > MAX_DESCRIBED_COMMAND_LENGTH
      ? `${command.slice(0, MAX_DESCRIBED_COMMAND_LENGTH)}...`
      : command;
  return `PID ${pid} (${shown})`;
};
