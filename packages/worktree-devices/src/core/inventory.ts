import type {
  GitContext,
  SimctlDevice,
  SimctlDeviceType,
  SimctlRuntime,
  SimulatorInventory,
} from '../types';

import { commandOutput, errorMessage } from '../lib/command';
import { isRecord } from '../lib/guards';

const parseSimctlInventory = (value: unknown): SimulatorInventory => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.devicetypes) ||
    !Array.isArray(value.runtimes) ||
    !isRecord(value.devices)
  ) {
    throw new Error('simctl returned an unexpected simulator inventory.');
  }

  const deviceTypes: SimctlDeviceType[] = value.devicetypes.map(
    (entry: unknown, index: number) => {
      if (
        !isRecord(entry) ||
        typeof entry.identifier !== 'string' ||
        typeof entry.name !== 'string' ||
        (entry.productFamily !== undefined &&
          typeof entry.productFamily !== 'string')
      ) {
        throw new Error(`simctl device type ${index} is malformed.`);
      }
      return {
        identifier: entry.identifier,
        name: entry.name,
        productFamily: entry.productFamily,
      };
    }
  );
  const runtimes: SimctlRuntime[] = value.runtimes.map(
    (entry: unknown, index: number) => {
      if (
        !isRecord(entry) ||
        typeof entry.identifier !== 'string' ||
        typeof entry.name !== 'string' ||
        typeof entry.version !== 'string' ||
        (entry.isAvailable !== undefined &&
          typeof entry.isAvailable !== 'boolean') ||
        (entry.platform !== undefined && typeof entry.platform !== 'string')
      ) {
        throw new Error(`simctl runtime ${index} is malformed.`);
      }
      return {
        identifier: entry.identifier,
        name: entry.name,
        version: entry.version,
        isAvailable: entry.isAvailable !== false,
        platform: entry.platform,
      };
    }
  );
  const devices: SimctlDevice[] = [];
  for (const [runtimeIdentifier, entries] of Object.entries(value.devices)) {
    if (!Array.isArray(entries)) {
      throw new Error(`simctl devices for ${runtimeIdentifier} are malformed.`);
    }
    entries.forEach((entry: unknown, index: number) => {
      if (
        !isRecord(entry) ||
        typeof entry.udid !== 'string' ||
        typeof entry.name !== 'string' ||
        typeof entry.state !== 'string' ||
        typeof entry.deviceTypeIdentifier !== 'string' ||
        (entry.isAvailable !== undefined &&
          typeof entry.isAvailable !== 'boolean') ||
        (entry.lastBootedAt !== undefined &&
          typeof entry.lastBootedAt !== 'string')
      ) {
        throw new Error(
          `simctl device ${index} for ${runtimeIdentifier} is malformed.`
        );
      }
      devices.push({
        udid: entry.udid,
        name: entry.name,
        state: entry.state,
        isAvailable: entry.isAvailable !== false,
        deviceTypeIdentifier: entry.deviceTypeIdentifier,
        runtimeIdentifier,
        lastBootedAt: entry.lastBootedAt,
      });
    });
  }
  return { devices, deviceTypes, runtimes };
};

export const getSimulatorInventory = (
  context: GitContext
): SimulatorInventory => {
  const output = commandOutput(
    'xcrun',
    ['simctl', 'list', '--json'],
    context.worktree
  );
  try {
    const parsed: unknown = JSON.parse(output);
    return parseSimctlInventory(parsed);
  } catch (error: unknown) {
    throw new Error(`Cannot parse simctl inventory: ${errorMessage(error)}`);
  }
};

export const isIosRuntime = (runtime: SimctlRuntime): boolean =>
  runtime.platform === 'iOS' || runtime.identifier.includes('.SimRuntime.iOS-');

export const usableDeviceMap = (
  inventory: SimulatorInventory
): Map<string, SimctlDevice> => {
  const availableRuntimeIds = new Set(
    inventory.runtimes
      .filter((runtime) => runtime.isAvailable && isIosRuntime(runtime))
      .map(({ identifier }) => identifier)
  );
  return new Map(
    inventory.devices
      .filter(
        (device) =>
          device.isAvailable &&
          availableRuntimeIds.has(device.runtimeIdentifier)
      )
      .map((device) => [device.udid, device])
  );
};

export const existingDeviceMap = (
  inventory: SimulatorInventory
): Map<string, SimctlDevice> =>
  new Map(inventory.devices.map((device) => [device.udid, device]));
