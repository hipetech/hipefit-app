import type { GitContext, RegistryState } from '../types';

import { shutdownSimulator } from '../core/devices';
import { checkSimctlPrerequisite } from '../core/expo';
import { existingDeviceMap, getSimulatorInventory } from '../core/inventory';
import { readState, reconcileState } from '../core/registry';
import { buildChoices, resolveChoice } from '../core/selector';
import { killSimulatorApp } from '../core/simulator-app';
import { commandOutput } from '../lib/command';
import { getCanonicalWorktrees } from '../lib/git';

// Simulator draws a window for every booted device and offers no way to close
// one of them, so hiding a single simulator means shutting it down. Hiding all
// of them is different: closing the application removes every window at once,
// and the devices survive because only a normal quit stops them.
const ownSimulatorUdid = (
  state: RegistryState,
  context: GitContext
): string | undefined =>
  state.assignments.find(({ worktree }) => worktree === context.worktree)
    ?.simulatorUdid;

export const hide = async (
  context: GitContext,
  target?: string,
  all = false
): Promise<void> => {
  checkSimctlPrerequisite(context);
  const inventory = getSimulatorInventory(context);
  const worktrees = await getCanonicalWorktrees(context.worktree);
  const state = reconcileState(await readState(context), worktrees, inventory);
  const devices = existingDeviceMap(inventory);

  if (all) {
    if (!(await killSimulatorApp(context))) {
      console.log(
        'Simulator is not running. Every booted simulator is headless.'
      );
      return;
    }
    console.log(
      'Closed Simulator. Booted simulators and their apps keep running.'
    );
    state.simulators
      .filter(({ udid }) => devices.get(udid)?.state === 'Booted')
      .forEach(({ udid, name }) => {
        console.log(`  ${name} (${udid}) still running`);
      });
    return;
  }

  const choice = await resolveChoice(
    context,
    buildChoices(state, inventory),
    target
  );
  const device = choice.device;
  if (!device) {
    throw new Error(
      `Simulator ${choice.simulator.name} (${choice.simulator.udid}) no longer exists.`
    );
  }
  if (device.state === 'Shutdown') {
    console.log(
      `${choice.simulator.name} (${device.udid}) is already shut down.`
    );
    return;
  }
  if (!shutdownSimulator(context, device)) return;
  // Simulator keeps a window for a device it has already opened even after that
  // device stops, and only decides which windows to draw when it starts. So the
  // dead window goes away by restarting the application, which the devices that
  // are still booted survive.
  if (await killSimulatorApp(context)) {
    const remaining = getSimulatorInventory(context).devices.filter(
      ({ state: deviceState }) => deviceState === 'Booted'
    );
    const focus =
      remaining.find(({ udid }) => udid === ownSimulatorUdid(state, context)) ??
      remaining[0];
    if (focus) {
      commandOutput(
        'open',
        ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', focus.udid],
        context.worktree
      );
    }
  }
  console.log(
    `Shut down ${choice.simulator.name} (${device.udid}). Its window and its app are gone.`
  );
  const owner = choice.worktree;
  console.log(
    owner
      ? `The assignment is kept, so "bun run ios:worktree" in ${owner} starts it again.`
      : 'It stays in the free pool for the next worktree that runs.'
  );
  console.log(
    'Pass --all instead to close every window without stopping anything.'
  );
};
