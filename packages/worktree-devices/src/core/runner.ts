import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import type {
  Assignment,
  GitContext,
  RegistryState,
  RunnerLease,
} from '../types';

import { errorMessage } from '../lib/command';
import { isRecord } from '../lib/guards';
import { withRegistryLock } from './lock';
import { readState, writeState } from './registry';

// A runner lease marks a worktree's assignment as in use by a `run` command for
// as long as that command lives, which covers the native build, when nothing
// listens on the Metro port yet. `run` takes it in the same registry write that
// allocates, and releases it when Expo exits. A runner that is killed outright
// leaves its lease behind, so a lease counts only while its process is alive.

// The genuine runner started before it wrote `startedAt`, and `ps` reports the
// start truncated to the second, so a process that started later than the lease
// is a different one that received the same pid. The margin absorbs a clock
// that was stepped back between the two readings.
const PID_REUSE_MARGIN_MS = 5_000;

export const newRunnerLease = (): RunnerLease => ({
  pid: process.pid,
  hostname: hostname(),
  startedAt: new Date().toISOString(),
});

export const isSameRunnerLease = (
  left: RunnerLease | undefined,
  right: RunnerLease
): boolean =>
  left !== undefined &&
  left.pid === right.pid &&
  left.hostname === right.hostname &&
  left.startedAt === right.startedAt;

export const describeRunner = (lease: RunnerLease): string =>
  lease.hostname === hostname()
    ? `pid ${lease.pid} on this host, started ${lease.startedAt}`
    : `pid ${lease.pid} on host ${lease.hostname}, started ${lease.startedAt}`;

// Only ESRCH establishes that the process is gone. EPERM means it exists under
// another user. Any other failure leaves the question open, and an open
// question keeps the lease, because dropping it is what lets another worktree
// take the simulator.
const processExists = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return !(isRecord(error) && error.code === 'ESRCH');
  }
};

// `ps` is asked for the start time in the C locale so the text parses the same
// way on every machine. If `ps` cannot run or prints something unreadable, the
// pid is taken at face value and the lease stays live.
const pidWasReused = (lease: RunnerLease): boolean => {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(lease.pid)], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) return false;
  const processStartedAt = Date.parse(result.stdout.trim());
  const leaseStartedAt = Date.parse(lease.startedAt);
  if (Number.isNaN(processStartedAt) || Number.isNaN(leaseStartedAt)) {
    return false;
  }
  return processStartedAt > leaseStartedAt + PID_REUSE_MARGIN_MS;
};

// A lease from another host is live whatever its age, because its pid means
// nothing here and is never probed. On this host only a positive safe integer
// is probed: signalling 0 or a negative number addresses a process group.
export const runnerIsLive = (lease: RunnerLease | undefined): boolean => {
  if (!lease) return false;
  if (lease.hostname !== hostname()) return true;
  if (!Number.isSafeInteger(lease.pid) || lease.pid <= 0) return false;
  return processExists(lease.pid) && !pidWasReused(lease);
};

// Called by the commands that are about to write the registry anyway, so the
// lease of a runner that died does not outlive that write.
export const dropDeadRunnerLeases = (state: RegistryState): void => {
  for (const assignment of state.assignments) {
    if (assignment.runner && !runnerIsLive(assignment.runner)) {
      delete assignment.runner;
    }
  }
};

// Leaves a lease that is already on the assignment alone and reports whether
// this process now holds it. Call it after `dropDeadRunnerLeases`, so that a
// lease still present belongs to a live runner.
export const takeRunnerLease = (
  assignment: Assignment,
  lease: RunnerLease
): boolean => {
  assignment.runner ??= lease;
  return isSameRunnerLease(assignment.runner, lease);
};

// Removes only the lease this process took. A lease another runner holds for
// the same worktree, or an assignment that was detached and reassigned while
// Expo ran, is left as it is. A failure is a warning: the command is ending,
// and the lease it leaves stops counting once this process is gone.
export const releaseRunnerLease = async (
  context: GitContext,
  lease: RunnerLease
): Promise<void> => {
  try {
    await withRegistryLock(context.lockPath, async () => {
      const state = await readState(context);
      const assignment = state.assignments.find(({ runner }) =>
        isSameRunnerLease(runner, lease)
      );
      if (!assignment) return;
      delete assignment.runner;
      await writeState(context.statePath, state);
    });
  } catch (error: unknown) {
    console.warn(
      `Warning: could not release the runner lease of pid ${lease.pid} in ${context.statePath}: ${errorMessage(error)}\nThe lease stops counting when this command exits, and the next run or detach removes it.`
    );
  }
};
