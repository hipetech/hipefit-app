import { spawnSync } from 'node:child_process';
import type {
  Assignment,
  GitContext,
  ManagedSimulator,
  RegistryState,
  SimctlDevice,
  SimulatorInventory,
  SimulatorTemplate,
} from '../types';

import { commandOutput, errorMessage } from '../lib/command';
import {
  existingDeviceMap,
  getSimulatorInventory,
  isIosRuntime,
  usableDeviceMap,
} from './inventory';

// simctl refuses to shut down a device that is already shutting down. That
// refusal must not fail the command that merely tried to tidy up, so the caller
// gets the outcome instead of an exception.
export const shutdownSimulator = (
  context: GitContext,
  device: SimctlDevice
): boolean => {
  if (device.state === 'Shutdown') return true;
  try {
    commandOutput(
      'xcrun',
      ['simctl', 'shutdown', device.udid],
      context.worktree
    );
    return true;
  } catch (error: unknown) {
    console.warn(
      `Warning: could not shut down ${device.name} (${device.udid}): ${errorMessage(error)}`
    );
    return false;
  }
};

// Removing a worktree without detaching it leaves its simulator running, so a
// writing command shuts down whatever reconciliation just released.
export const shutdownReleasedSimulators = (
  context: GitContext,
  stored: RegistryState,
  reconciled: RegistryState,
  inventory: SimulatorInventory
): void => {
  const stillAssigned = new Set(
    reconciled.assignments.map(({ simulatorUdid }) => simulatorUdid)
  );
  const devices = existingDeviceMap(inventory);
  const names = new Map(
    reconciled.simulators.map(({ udid, name }) => [udid, name])
  );
  for (const { simulatorUdid } of stored.assignments) {
    if (stillAssigned.has(simulatorUdid)) continue;
    const device = devices.get(simulatorUdid);
    if (!device || device.state === 'Shutdown') continue;
    if (!shutdownSimulator(context, device)) continue;
    console.log(
      `Shut down ${names.get(simulatorUdid) ?? device.name} (${simulatorUdid}), released by a removed worktree.`
    );
  }
};

const versionParts = (version: string): number[] =>
  version.split('.').map((part) => Number.parseInt(part, 10) || 0);

const compareVersionsDescending = (left: string, right: string): number => {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

export const selectSimulatorTemplate = (
  inventory: SimulatorInventory,
  templateUdid?: string
): SimulatorTemplate => {
  const typeById = new Map(
    inventory.deviceTypes.map((deviceType) => [
      deviceType.identifier,
      deviceType,
    ])
  );
  const runtimeById = new Map(
    inventory.runtimes.map((runtime) => [runtime.identifier, runtime])
  );
  const candidates = inventory.devices.filter((device) => {
    const deviceType = typeById.get(device.deviceTypeIdentifier);
    const runtime = runtimeById.get(device.runtimeIdentifier);
    const isIphone =
      deviceType?.productFamily === 'iPhone' ||
      (deviceType?.productFamily === undefined &&
        device.name.startsWith('iPhone'));
    return (
      device.isAvailable &&
      isIphone &&
      runtime?.isAvailable === true &&
      isIosRuntime(runtime)
    );
  });

  let selected: SimctlDevice | undefined;
  if (templateUdid) {
    selected = candidates.find(({ udid }) => udid === templateUdid);
    if (!selected) {
      throw new Error(
        `Template simulator ${templateUdid} is not an available iPhone simulator on an installed iOS runtime.`
      );
    }
  } else {
    candidates.sort((left, right) => {
      const bootDifference =
        Number(right.state === 'Booted') - Number(left.state === 'Booted');
      if (bootDifference !== 0) return bootDifference;
      if (left.state === 'Booted' && right.state === 'Booted') {
        const bootTimeDifference = (right.lastBootedAt ?? '').localeCompare(
          left.lastBootedAt ?? ''
        );
        if (bootTimeDifference !== 0) return bootTimeDifference;
      }
      const leftRuntime = runtimeById.get(left.runtimeIdentifier);
      const rightRuntime = runtimeById.get(right.runtimeIdentifier);
      return compareVersionsDescending(
        leftRuntime?.version ?? '0',
        rightRuntime?.version ?? '0'
      );
    });
    selected = candidates[0];
  }

  if (!selected) {
    throw new Error(
      'No available iPhone simulator exists on an installed iOS runtime. Install an iOS Simulator runtime in Xcode.'
    );
  }
  const deviceType = typeById.get(selected.deviceTypeIdentifier);
  const runtime = runtimeById.get(selected.runtimeIdentifier);
  if (!deviceType || !runtime) {
    throw new Error(
      `Simulator ${selected.udid} has incomplete simctl metadata.`
    );
  }
  return {
    deviceTypeIdentifier: deviceType.identifier,
    deviceTypeName: deviceType.name,
    runtimeIdentifier: runtime.identifier,
    runtimeName: runtime.name,
    sourceUdid: selected.udid,
  };
};

const namesOfOtherDevices = (
  inventory: SimulatorInventory,
  udid?: string
): Set<string> =>
  new Set(
    inventory.devices
      .filter((device) => device.udid !== udid)
      .map(({ name }) => name)
  );

// The name of a simulator no worktree holds. `udid` is the simulator being
// named, whose current name does not count as taken.
export const nextSimulatorName = (
  inventory: SimulatorInventory,
  prefix: string,
  udid?: string
): string => {
  const names = namesOfOtherDevices(inventory, udid);
  for (let suffix = 1; ; suffix += 1) {
    const name = `${prefix} ${suffix}`;
    if (!names.has(name)) return name;
  }
};

const isPoolName = (name: string, prefix: string): boolean =>
  name.startsWith(`${prefix} `) && /^\d+$/.test(name.slice(prefix.length + 1));

// The name of a simulator while a worktree holds it. Two worktrees can share a
// label, for example the same directory name on two detached HEADs, so a taken
// name gets a number.
export const worktreeSimulatorName = (
  inventory: SimulatorInventory,
  prefix: string,
  label: string,
  udid?: string
): string => {
  const names = namesOfOtherDevices(inventory, udid);
  const base = `${prefix} ${label}`;
  if (!names.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const name = `${base} ${suffix}`;
    if (!names.has(name)) return name;
  }
};

// A name is a label, so failing to change it must not fail the command. The
// inventory is updated as well, because later names in the same command are
// chosen against it.
export const renameSimulator = (
  context: GitContext,
  inventory: SimulatorInventory,
  simulator: ManagedSimulator,
  name: string
): void => {
  if (simulator.name === name) return;
  try {
    commandOutput(
      'xcrun',
      ['simctl', 'rename', simulator.udid, name],
      context.worktree
    );
  } catch (error: unknown) {
    console.warn(
      `Warning: could not rename ${simulator.name} (${simulator.udid}) to ${name}: ${errorMessage(error)}`
    );
    return;
  }
  const device = inventory.devices.find(({ udid }) => udid === simulator.udid);
  if (device) device.name = name;
  simulator.name = name;
};

// A simulator keeps its worktree's name when the worktree is removed without a
// detach, or when a detach could not write the registry. A writing command
// gives every free simulator a pool name again before it saves.
export const renameFreeSimulators = (
  context: GitContext,
  state: RegistryState,
  inventory: SimulatorInventory
): void => {
  const prefix = context.config.simulatorNamePrefix;
  const assigned = new Set(
    state.assignments.map(({ simulatorUdid }) => simulatorUdid)
  );
  for (const simulator of state.simulators) {
    if (assigned.has(simulator.udid) || isPoolName(simulator.name, prefix)) {
      continue;
    }
    renameSimulator(
      context,
      inventory,
      simulator,
      nextSimulatorName(inventory, prefix, simulator.udid)
    );
  }
};

export const createSimulator = (
  context: GitContext,
  template: SimulatorTemplate,
  name: string
): ManagedSimulator => {
  const udid = commandOutput(
    'xcrun',
    [
      'simctl',
      'create',
      name,
      template.deviceTypeIdentifier,
      template.runtimeIdentifier,
    ],
    context.worktree
  );
  if (!udid) throw new Error('simctl create did not return a simulator UDID.');
  return { udid, name };
};

// Deleting is the one irreversible thing this tool does, and the registry record
// is the only way back to a device that survived the attempt. A failure has to
// reach the caller, tagged with the UDID that the spawn-error message omits.
export const deleteSimulator = (context: GitContext, udid: string): void => {
  try {
    commandOutput('xcrun', ['simctl', 'delete', udid], context.worktree);
  } catch (error: unknown) {
    throw new Error(`Could not delete ${udid}: ${errorMessage(error)}`);
  }
};

export const getFreeManagedSimulator = (
  state: RegistryState,
  usable: Map<string, SimctlDevice>
): ManagedSimulator | undefined => {
  const assigned = new Set(
    state.assignments.map(({ simulatorUdid }) => simulatorUdid)
  );
  return state.simulators.find(
    ({ udid }) => !assigned.has(udid) && usable.has(udid)
  );
};

export const bootSimulator = (
  context: GitContext,
  assignment: Assignment
): void => {
  const inventory = getSimulatorInventory(context);
  const device = usableDeviceMap(inventory).get(assignment.simulatorUdid);
  if (!device) {
    throw new Error(
      `Assigned simulator ${assignment.simulatorUdid} is no longer available. Run "bun run ios:worktree:detach --force" to release it, then run this command again.`
    );
  }
  if (device.state !== 'Booted') {
    commandOutput(
      'xcrun',
      ['simctl', 'boot', assignment.simulatorUdid],
      context.worktree
    );
  }
  commandOutput(
    'xcrun',
    ['simctl', 'bootstatus', assignment.simulatorUdid, '-b'],
    context.worktree
  );
};

// React Native ships a prebuilt core with the default Metro port compiled in, so
// --port moves the server without moving the app. RCT_jsLocation is the setting
// React Native's own "Configure Bundler" dev menu writes, and it points the app
// at this worktree's port. It has to be written before Expo installs and
// launches the app, which is why it does not wait for the build.
export const setMetroLocation = (
  context: GitContext,
  assignment: Assignment
): void => {
  const result = spawnSync(
    'xcrun',
    [
      'simctl',
      'spawn',
      assignment.simulatorUdid,
      'defaults',
      'write',
      context.config.bundleIdentifier,
      'RCT_jsLocation',
      `localhost:${assignment.port}`,
    ],
    { cwd: context.worktree, stdio: 'ignore' }
  );
  if (result.error || result.status !== 0) {
    console.warn(
      `Warning: could not point ${context.config.bundleIdentifier} at localhost:${assignment.port}. The app may look for Metro on the default port instead.`
    );
  }
};
