import type { GitContext } from '../types';

import { checkSimctlPrerequisite } from '../core/expo';
import { getSimulatorInventory } from '../core/inventory';
import { readState, reconcileState } from '../core/registry';
import { buildChoices, resolveChoice } from '../core/selector';
import { killSimulatorApp } from '../core/simulator-app';
import { commandOutput } from '../lib/command';
import { getCanonicalWorktrees } from '../lib/git';

// Simulator attaches to devices the CoreSimulator daemon already runs, so
// opening a window neither restarts the device nor disturbs the app inside it.
// It ignores -CurrentDeviceUDID while running, so bringing a specific simulator
// to the front means replacing the process. Killing it is safe: only a normal
// quit shuts the devices down.
export const show = async (
  context: GitContext,
  target?: string
): Promise<void> => {
  checkSimctlPrerequisite(context);
  const inventory = getSimulatorInventory(context);
  const worktrees = await getCanonicalWorktrees(context.worktree);
  const state = reconcileState(await readState(context), worktrees, inventory);
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
  if (device.state !== 'Booted') {
    commandOutput('xcrun', ['simctl', 'boot', device.udid], context.worktree);
    commandOutput(
      'xcrun',
      ['simctl', 'bootstatus', device.udid, '-b'],
      context.worktree
    );
  }
  await killSimulatorApp(context);
  commandOutput(
    'open',
    ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', device.udid],
    context.worktree
  );
  console.log(`Showing ${choice.simulator.name} (${device.udid}).`);
  console.log(
    'Simulator draws a window for every booted device, so other worktrees stay visible too.'
  );
};
