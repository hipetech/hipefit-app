import type { CliOptions, GitContext } from '../types';

import { shutdownReleasedSimulators, shutdownSimulator } from '../core/devices';
import { checkSimctlPrerequisite } from '../core/expo';
import { existingDeviceMap, getSimulatorInventory } from '../core/inventory';
import { withRegistryLock } from '../core/lock';
import { portAcceptsConnections } from '../core/ports';
import {
  persistIfChanged,
  readState,
  reconcileState,
  serializeState,
  writeState,
} from '../core/registry';
import { describeRunner, dropDeadRunnerLeases } from '../core/runner';
import { getCanonicalWorktrees } from '../lib/git';

export const detach = async (
  context: GitContext,
  options: CliOptions
): Promise<void> => {
  const { dryRun, force } = options;
  const initialState = await readState(context);
  const initialAssignment = initialState.assignments.find(
    ({ worktree }) => worktree === context.worktree
  );
  if (!initialAssignment) {
    console.log(`No simulator is assigned to ${context.worktree}.`);
    return;
  }
  checkSimctlPrerequisite(context);

  const action = async (): Promise<void> => {
    const inventory = getSimulatorInventory(context);
    const worktrees = await getCanonicalWorktrees(context.worktree);
    const stored = await readState(context);
    const baseline = serializeState(stored);
    const state = reconcileState(stored, worktrees, inventory);
    if (!dryRun) shutdownReleasedSimulators(context, stored, state, inventory);
    // Whatever lease is left after this belongs to a live runner.
    dropDeadRunnerLeases(state);
    const assignment = state.assignments.find(
      ({ worktree }) => worktree === context.worktree
    );
    if (!assignment) {
      if (!dryRun) await persistIfChanged(context.statePath, state, baseline);
      console.log(`No simulator is assigned to ${context.worktree}.`);
      return;
    }
    // The lease is checked as well as the port because Metro does not listen
    // during the native build, and releasing the simulator then would let
    // another worktree take it from under the build.
    const runner = assignment.runner;
    if (runner && !force && !dryRun) {
      throw new Error(
        `A runner for this worktree is still active (${describeRunner(runner)}). Stop it before detaching: interrupt it in its terminal, or run "bun run ios:worktree:stop" once Metro is serving. Pass --force to release the assignment anyway.`
      );
    }
    const portIsBusy = await portAcceptsConnections(assignment.port);
    if (portIsBusy && !force && !dryRun) {
      throw new Error(
        `Metro port ${assignment.port} is still active. Stop the worktree runner before detaching, or pass --force to release the assignment anyway.`
      );
    }
    const simulator = state.simulators.find(
      ({ udid }) => udid === assignment.simulatorUdid
    );
    const device = existingDeviceMap(inventory).get(assignment.simulatorUdid);
    if (!simulator || !device) {
      throw new Error(
        `Assigned simulator ${assignment.simulatorUdid} disappeared during reconciliation.`
      );
    }
    console.log(
      `${dryRun ? 'Would detach' : 'Detaching'}: ${context.worktree}`
    );
    console.log(`Simulator: ${simulator.name} (${simulator.udid})`);
    console.log(
      `Metro port: ${assignment.port}${portIsBusy ? ' (in use)' : ''}`
    );
    if (runner) console.log(`Runner: ${describeRunner(runner)}`);
    if (dryRun) {
      if (runner && !force) {
        console.log(
          `Detach would refuse while the runner (pid ${runner.pid}) is active. Stop the runner, or pass --force.`
        );
      }
      if (portIsBusy && !force) {
        console.log(
          `Detach would refuse while port ${assignment.port} is in use. Stop the runner, or pass --force.`
        );
      }
      return;
    }

    const wasShutDown = shutdownSimulator(context, device);
    state.assignments = state.assignments.filter(
      ({ worktree }) => worktree !== context.worktree
    );
    await writeState(context.statePath, state);
    console.log(
      wasShutDown
        ? 'Simulator returned to the managed pool.'
        : 'Assignment released. The simulator stays in the managed pool and is still shutting down.'
    );
  };

  if (dryRun) await action();
  else await withRegistryLock(context.lockPath, action);
};
