import type { PortListener } from '../core/listeners';
import type { GitContext, SimulatorChoice } from '../types';

import { checkSimctlPrerequisite } from '../core/expo';
import { getSimulatorInventory } from '../core/inventory';
import {
  describeListener,
  inspectPortListeners,
  listenerTarget,
} from '../core/listeners';
import { portAcceptsConnections } from '../core/ports';
import { readState, reconcileState } from '../core/registry';
import { describeRunner, runnerIsLive } from '../core/runner';
import { buildChoices, resolveChoice } from '../core/selector';
import { sleep } from '../lib/async';
import { getCanonicalWorktrees } from '../lib/git';

// Stop only signals a listener that `core/listeners.ts` verified as the Expo
// dev server of the selected assignment. Any other process on the port gets no
// signal and is reported, and the command then fails.

const INTERRUPT_WAIT_ATTEMPTS = 100;
const KILL_WAIT_ATTEMPTS = 30;
const WAIT_INTERVAL_MS = 100;
const ADVICE =
  'Stop that process yourself, or detach with --force if the port is held by something else.';

const signalPids = (pids: number[], signal: NodeJS.Signals): void => {
  pids.forEach((pid) => {
    try {
      process.kill(pid, signal);
    } catch {
      // The process already exited, or belongs to another user.
    }
  });
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM';
  }
};

// Resolves to whether the port stopped answering. Once every signalled process
// is gone, whatever still answers is another process, and waiting longer would
// not change that.
const waitForRelease = async (
  port: number,
  signalled: number[],
  attempts: number
): Promise<boolean> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!(await portAcceptsConnections(port))) return true;
    if (!signalled.some(isAlive)) break;
    await sleep(WAIT_INTERVAL_MS);
  }
  return !(await portAcceptsConnections(port));
};

const pidList = (pids: number[]): string =>
  pids.map((pid) => `PID ${pid}`).join(', ');

const unverifiedLine = (listener: PortListener): string =>
  `  ${describeListener(listener)}: ${listener.reasons.join('; ')}.`;

const heldLine = (
  listener: PortListener,
  interrupted: Set<number>,
  killed: Set<number>
): string => {
  if (!listener.verified) return unverifiedLine(listener);
  if (killed.has(listener.pid)) {
    return `  ${describeListener(listener)}: it did not exit after being killed.`;
  }
  if (interrupted.has(listener.pid)) {
    return `  ${describeListener(listener)}: it was not recognized when the kill was decided, so it was not killed. Run stop again to stop it.`;
  }
  return `  ${describeListener(listener)}: it started listening after the interrupt was sent, so it was not killed. Run stop again to stop it.`;
};

export const stop = async (
  context: GitContext,
  target?: string
): Promise<void> => {
  checkSimctlPrerequisite(context);
  const inventory = getSimulatorInventory(context);
  const worktrees = await getCanonicalWorktrees(context.worktree);
  const state = reconcileState(await readState(context), worktrees, inventory);
  const assigned = buildChoices(state, inventory).filter(
    ({ port }) => port !== undefined
  );
  // The list is for choosing what to stop, so it says which ports answer.
  const choices: SimulatorChoice[] = [];
  for (const choice of assigned) {
    choices.push({
      ...choice,
      serving: await portAcceptsConnections(choice.port as number),
    });
  }
  const choice = await resolveChoice(
    context,
    choices,
    target,
    'No worktree has a reserved Metro port. Run "bun run ios:worktree" first.'
  );
  const assignment = state.assignments.find(
    ({ simulatorUdid }) => simulatorUdid === choice.simulator.udid
  );
  if (!assignment) {
    throw new Error(`${choice.simulator.name} has no reserved Metro port.`);
  }
  const { port, worktree } = assignment;
  if (!(await portAcceptsConnections(port))) {
    console.log(`Nothing is serving on port ${port}.`);
    // A runner that is still building has no Metro to stop yet, and this
    // command signals nothing but a verified Metro listener.
    const { runner } = assignment;
    if (runner && runnerIsLive(runner)) {
      console.log(
        `A runner for ${worktree} is still active (${describeRunner(runner)}) and has not started Metro. Interrupt it in its terminal to end it.`
      );
    }
    return;
  }
  // The assignment may belong to another worktree than the one this command
  // runs in, so listeners are checked against the assignment's own worktree.
  const expected = listenerTarget(context.config, assignment);
  const listeners = inspectPortListeners(context.worktree, expected);
  if (listeners.length === 0) {
    throw new Error(
      `Port ${port} answers but no local process owns it. Stop that runner yourself, or detach with --force.`
    );
  }
  const unverified = listeners.filter(({ verified }) => !verified);
  const interrupted = listeners
    .filter(({ verified }) => verified)
    .map(({ pid }) => pid);
  if (interrupted.length === 0) {
    throw new Error(
      [
        `Port ${port} answers, but no process listening on it was recognized as the Metro server of ${worktree}, so nothing was signalled:`,
        ...unverified.map(unverifiedLine),
        ADVICE,
      ].join('\n')
    );
  }
  const simulatorNote = `${choice.simulator.name} keeps running. Detach releases it, and "bun run ios:worktree" starts Metro again.`;
  const reportLeftAlone = (): void => {
    if (unverified.length === 0) return;
    console.log(
      'Other processes listened on that port, were not recognized as that Metro server, and were not signalled:'
    );
    unverified.forEach((listener) => console.log(unverifiedLine(listener)));
  };
  // Metro forwards an interrupt to its own children and exits cleanly, so the
  // runner gets the same chance it would from the keyboard.
  signalPids(interrupted, 'SIGINT');
  if (await waitForRelease(port, interrupted, INTERRUPT_WAIT_ATTEMPTS)) {
    console.log(`Stopped Metro on port ${port} for ${worktree}.`);
    console.log(simulatorNote);
    reportLeftAlone();
    return;
  }
  // The listeners may have changed during the wait, so the kill goes only to a
  // process that was interrupted and still passes verification now.
  const wasInterrupted = new Set(interrupted);
  const remaining = inspectPortListeners(context.worktree, expected);
  const killed = remaining
    .filter(({ pid, verified }) => verified && wasInterrupted.has(pid))
    .map(({ pid }) => pid);
  if (killed.length > 0) {
    signalPids(killed, 'SIGKILL');
    if (await waitForRelease(port, killed, KILL_WAIT_ATTEMPTS)) {
      console.log(
        `Metro on port ${port} ignored an interrupt, so it was killed outright.`
      );
      console.log(simulatorNote);
      reportLeftAlone();
      return;
    }
  }
  const holders =
    killed.length > 0
      ? inspectPortListeners(context.worktree, expected)
      : remaining;
  const actions = [
    `Metro for ${worktree} (${pidList(interrupted)}) was interrupted`,
    ...(killed.length > 0 ? [`${pidList(killed)} was then killed`] : []),
  ].join(', and ');
  throw new Error(
    [
      `Port ${port} still answers. ${actions}, but the port is held by:`,
      ...(holders.length > 0
        ? holders.map((listener) =>
            heldLine(listener, wasInterrupted, new Set(killed))
          )
        : ['  no local process that could be found.']),
      ADVICE,
    ].join('\n')
  );
};
