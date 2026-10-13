import type {
  CliOptions,
  GitContext,
  ManagedSimulator,
  SimulatorChoice,
} from '../types';

import { deleteSimulator, shutdownSimulator } from '../core/devices';
import { checkSimctlPrerequisite } from '../core/expo';
import { getSimulatorInventory } from '../core/inventory';
import { withRegistryLock } from '../core/lock';
import { readState, reconcileState, writeState } from '../core/registry';
import {
  buildChoices,
  confirm,
  describeChoice,
  resolveChoice,
} from '../core/selector';
import { errorMessage } from '../lib/command';
import { getCanonicalWorktrees } from '../lib/git';

const listSimulators = (simulators: ManagedSimulator[]): string =>
  simulators.map(({ udid, name }) => `  ${name} (${udid})`).join('\n');

const deletionFailureMessage = (failures: string[]): string =>
  [
    failures.length === 1
      ? 'One simulator could not be deleted:'
      : `${failures.length} simulators could not be deleted:`,
    ...failures.map((failure) => `  ${failure}`),
    'They are still managed. Check them in Simulator, then run this command again.',
  ].join('\n');

// The registry is the only record that a deleted device ever existed, so a
// failed write has to name what is already gone instead of reporting a saved
// partial result. writeState replaces the file atomically, which is why the
// previous contents are still readable after this.
const writeFailureMessage = (
  statePath: string,
  error: unknown,
  deleted: ManagedSimulator[],
  failures: string[]
): string => {
  const lines = [
    `Could not update the simulator registry ${statePath}: ${errorMessage(error)}`,
    'Nothing was saved. The registry still holds its previous contents.',
  ];
  if (deleted.length > 0) {
    lines.push(
      'These simulators are already deleted and the registry still lists them:',
      listSimulators(deleted),
      'The next command that writes the registry drops them.'
    );
  }
  if (failures.length > 0) {
    lines.push(deletionFailureMessage(failures));
  }
  return lines.join('\n');
};

// Deleting a simulator throws away whatever it had installed, so it is the one
// command that asks first and never touches a simulator a worktree still holds.
export const remove = async (
  context: GitContext,
  options: CliOptions
): Promise<void> => {
  checkSimctlPrerequisite(context);
  await withRegistryLock(context.lockPath, async () => {
    const inventory = getSimulatorInventory(context);
    const worktrees = await getCanonicalWorktrees(context.worktree);
    const stored = await readState(context);
    const state = reconcileState(stored, worktrees, inventory);
    const choices = buildChoices(state, inventory);
    const free = choices.filter(({ worktree }) => worktree === undefined);

    let doomed: SimulatorChoice[];
    if (options.all) {
      doomed = options.force ? choices : free;
      if (doomed.length === 0) {
        console.log(
          'No managed simulator is free. Detach a worktree first, or pass --force to include assigned ones.'
        );
        return;
      }
    } else {
      const pool = options.force ? choices : free;
      const choice = await resolveChoice(
        context,
        pool,
        options.target,
        options.force
          ? 'No managed simulator exists.'
          : 'Every managed simulator is assigned to a worktree. Detach one first, or pass --force.'
      );
      doomed = [choice];
    }

    const assigned = doomed.filter(({ worktree }) => worktree !== undefined);
    if (assigned.length > 0 && !options.force) {
      throw new Error(
        `${assigned[0]?.simulator.name} is assigned to ${assigned[0]?.worktree}. Detach it first, or pass --force.`
      );
    }

    console.log('Deleting permanently:');
    doomed.forEach((choice) => {
      console.log(`  ${describeChoice(choice, context.worktree)}`);
    });
    if (!options.confirmed) {
      if (!process.stdin.isTTY) {
        throw new Error(
          'Deleting needs a confirmation. Re-run with --yes when there is no terminal to ask.'
        );
      }
      if (!(await confirm('Delete them and everything installed on them?'))) {
        console.log('Nothing was deleted.');
        return;
      }
    }

    // One failure must not abandon the rest of the batch, and only the devices
    // that are actually gone may lose their registry record.
    const deleted: ManagedSimulator[] = [];
    const failures: string[] = [];
    for (const choice of doomed) {
      const { udid, name } = choice.simulator;
      const device = choice.device;
      if (device && device.state !== 'Shutdown') {
        shutdownSimulator(context, device);
      }
      try {
        deleteSimulator(context, udid);
      } catch (error: unknown) {
        failures.push(errorMessage(error));
        continue;
      }
      deleted.push(choice.simulator);
      console.log(`Deleted ${name} (${udid}).`);
    }

    const gone = new Set(deleted.map(({ udid }) => udid));
    state.simulators = state.simulators.filter(({ udid }) => !gone.has(udid));
    state.assignments = state.assignments.filter(
      ({ simulatorUdid }) => !gone.has(simulatorUdid)
    );
    try {
      await writeState(context.statePath, state);
    } catch (error: unknown) {
      throw new Error(
        writeFailureMessage(context.statePath, error, deleted, failures)
      );
    }
    if (failures.length > 0) {
      throw new Error(deletionFailureMessage(failures));
    }
  });
};
