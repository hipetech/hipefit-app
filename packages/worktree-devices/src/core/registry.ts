import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import type { PortRange } from '../config';
import type {
  Assignment,
  GitContext,
  ManagedSimulator,
  RegistryState,
  RunnerLease,
  SimulatorInventory,
} from '../types';

import { errorMessage } from '../lib/command';
import { isRecord } from '../lib/guards';
import { STATE_VERSION } from '../types';
import { existingDeviceMap } from './inventory';

export const emptyState = (): RegistryState => ({
  version: STATE_VERSION,
  assignments: [],
  simulators: [],
});

// A lease only says that a runner may be active, so a malformed one is dropped
// instead of making the whole registry unreadable. The pid has to be a positive
// safe integer because it is later probed with a signal, and 0 or a negative
// number would address a process group.
const decodeRunnerLease = (value: unknown): RunnerLease | undefined => {
  if (
    !isRecord(value) ||
    typeof value.pid !== 'number' ||
    !Number.isSafeInteger(value.pid) ||
    value.pid <= 0 ||
    typeof value.hostname !== 'string' ||
    value.hostname.length === 0 ||
    typeof value.startedAt !== 'string' ||
    Number.isNaN(Date.parse(value.startedAt))
  ) {
    return undefined;
  }
  return {
    pid: value.pid,
    hostname: value.hostname,
    startedAt: value.startedAt,
  };
};

const decodeAssignment = (
  value: unknown,
  index: number,
  ports: PortRange
): Assignment => {
  if (
    !isRecord(value) ||
    typeof value.worktree !== 'string' ||
    typeof value.simulatorUdid !== 'string' ||
    typeof value.port !== 'number' ||
    !Number.isInteger(value.port) ||
    value.port < ports.start ||
    value.port > ports.end
  ) {
    throw new Error(`Registry assignment ${index} is malformed.`);
  }
  const assignment: Assignment = {
    worktree: value.worktree,
    simulatorUdid: value.simulatorUdid,
    port: value.port,
  };
  // The key is added only for a valid lease, so an assignment without a runner
  // has no `runner` property and compares equal to one built without it.
  const runner = decodeRunnerLease(value.runner);
  if (runner) assignment.runner = runner;
  return assignment;
};

const decodeManagedSimulator = (
  value: unknown,
  index: number
): ManagedSimulator => {
  if (
    !isRecord(value) ||
    typeof value.udid !== 'string' ||
    typeof value.name !== 'string'
  ) {
    throw new Error(`Registry simulator ${index} is malformed.`);
  }
  return { udid: value.udid, name: value.name };
};

const assertUnique = (values: string[], label: string): void => {
  if (new Set(values).size !== values.length) {
    throw new Error(`Registry contains duplicate ${label}.`);
  }
};

export const decodeState = (
  value: unknown,
  ports: PortRange
): RegistryState => {
  if (
    !isRecord(value) ||
    value.version !== STATE_VERSION ||
    !Array.isArray(value.assignments) ||
    !Array.isArray(value.simulators)
  ) {
    throw new Error(
      `Registry is malformed or uses an unsupported version. Expected version ${STATE_VERSION}.`
    );
  }
  const assignments = value.assignments.map((entry: unknown, index: number) =>
    decodeAssignment(entry, index, ports)
  );
  const simulators = value.simulators.map(decodeManagedSimulator);
  assertUnique(
    assignments.map(({ worktree }) => worktree),
    'worktree assignments'
  );
  assertUnique(
    assignments.map(({ simulatorUdid }) => simulatorUdid),
    'simulator assignments'
  );
  assertUnique(
    assignments.map(({ port }) => String(port)),
    'Metro port assignments'
  );
  assertUnique(
    simulators.map(({ udid }) => udid),
    'managed simulators'
  );
  const managedUdids = new Set(simulators.map(({ udid }) => udid));
  if (
    assignments.some(({ simulatorUdid }) => !managedUdids.has(simulatorUdid))
  ) {
    throw new Error('Registry assignment references an unmanaged simulator.');
  }
  return { version: STATE_VERSION, assignments, simulators };
};

export const readState = async (
  context: GitContext
): Promise<RegistryState> => {
  const statePath = context.statePath;
  let source: string;
  try {
    source = await readFile(statePath, 'utf8');
  } catch (error: unknown) {
    if (isRecord(error) && error.code === 'ENOENT') return emptyState();
    throw error;
  }
  try {
    const parsed: unknown = JSON.parse(source);
    return decodeState(parsed, context.config.ports);
  } catch (error: unknown) {
    throw new Error(
      `Cannot read simulator registry ${statePath}: ${errorMessage(error)}\nDelete that file to reset every assignment; the simulators themselves are kept.`
    );
  }
};

export const serializeState = (state: RegistryState): string =>
  `${JSON.stringify(state, null, 2)}\n`;

export const writeState = async (
  statePath: string,
  state: RegistryState
): Promise<void> => {
  const temporaryPath = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, serializeState(state), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, statePath);
  } catch (error: unknown) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
};

export const persistIfChanged = async (
  statePath: string,
  state: RegistryState,
  baseline: string
): Promise<void> => {
  if (serializeState(state) === baseline) return;
  await writeState(statePath, state);
};

export const reconcileState = (
  state: RegistryState,
  worktrees: Set<string>,
  inventory: SimulatorInventory
): RegistryState => {
  const devices = existingDeviceMap(inventory);
  // The device is the authority on its own name, so a rename the registry
  // never recorded cannot leave a name that no simulator answers to.
  const simulators = state.simulators.flatMap(({ udid }) => {
    const device = devices.get(udid);
    return device ? [{ udid, name: device.name }] : [];
  });
  const managedUdids = new Set(simulators.map(({ udid }) => udid));
  const assignments = state.assignments.filter(
    ({ worktree, simulatorUdid }) =>
      worktrees.has(worktree) && managedUdids.has(simulatorUdid)
  );
  return { version: STATE_VERSION, assignments, simulators };
};
