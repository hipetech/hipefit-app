import { copyFile } from 'node:fs/promises';
import type {
  Allocation,
  Assignment,
  CliOptions,
  GitContext,
  PlannedAllocation,
  RegistryState,
  RunnerLease,
  SimulatorInventory,
} from '../types';

import {
  bootSimulator,
  createSimulator,
  deleteSimulator,
  getFreeManagedSimulator,
  renameFreeSimulators,
  renameSimulator,
  selectSimulatorTemplate,
  setMetroLocation,
  shutdownReleasedSimulators,
  worktreeSimulatorName,
} from '../core/devices';
import {
  checkRunPrerequisites,
  ignoredTemplateWarning,
  launchExpo,
  printRunSelection,
} from '../core/expo';
import { getSimulatorInventory, usableDeviceMap } from '../core/inventory';
import { withRegistryLock } from '../core/lock';
import { allocatePort, portIsAvailable } from '../core/ports';
import {
  persistIfChanged,
  readState,
  reconcileState,
  serializeState,
  writeState,
} from '../core/registry';
import {
  describeRunner,
  dropDeadRunnerLeases,
  isSameRunnerLease,
  newRunnerLease,
  releaseRunnerLease,
  takeRunnerLease,
} from '../core/runner';
import { errorMessage } from '../lib/command';
import { getWorktreeBranches, worktreeLabel } from '../lib/git';

const warn = (message: string): void => {
  console.warn(`Warning: ${message}`);
};

// A simulator carries its worktree's branch for as long as the worktree holds
// it. `udid` is the simulator being named, so that its current name is free
// for it to keep.
const simulatorNameFor = (
  context: GitContext,
  inventory: SimulatorInventory,
  branches: Map<string, string | undefined>,
  udid?: string
): string =>
  worktreeSimulatorName(
    inventory,
    context.config.simulatorNamePrefix,
    worktreeLabel(context.worktree, branches.get(context.worktree)),
    udid
  );

// Expo offers another port when the one it was given is taken, and nothing
// would carry that choice back to the registry or to RCT_jsLocation. So the
// port is settled here, under the registry lock and in the same write as the
// lease, and Expo is only ever started on a port this worktree can bind or
// that this worktree's own runner already serves. The returned text is the
// warning to print once the registry write has succeeded.
const settlePort = async (
  context: GitContext,
  state: RegistryState,
  assignment: Assignment,
  holdsLease: boolean
): Promise<string | undefined> => {
  if (await portIsAvailable(assignment.port)) return undefined;
  if (!holdsLease && assignment.runner) {
    return `Metro port ${assignment.port} is already in use, and a runner for this worktree is already active on it (${describeRunner(assignment.runner)}). Expo attaches to that dev server. Stop that runner if this run does not attach to it.`;
  }
  const occupied = assignment.port;
  assignment.port = await allocatePort(state, context.config);
  return `Metro port ${occupied} is held by a process that is not this worktree's runner, so this worktree moved to port ${assignment.port}. The registry, the app's Metro location, and Expo all use ${assignment.port}.`;
};

// The lease is taken in the allocation write, so no moment exists in which the
// assignment is recorded and another worktree's detach or run can see it as
// idle.
const allocateRun = async (
  context: GitContext,
  lease: RunnerLease,
  templateUdid?: string
): Promise<Allocation> =>
  withRegistryLock(context.lockPath, async () => {
    const inventory = getSimulatorInventory(context);
    const branches = await getWorktreeBranches(context.worktree);
    const stored = await readState(context);
    const baseline = serializeState(stored);
    const state = reconcileState(stored, new Set(branches.keys()), inventory);
    shutdownReleasedSimulators(context, stored, state, inventory);
    dropDeadRunnerLeases(state);
    // Validate an explicit template even when this run will not create a
    // simulator, so a mistyped UDID fails instead of being ignored.
    const requested = templateUdid
      ? selectSimulatorTemplate(inventory, templateUdid)
      : undefined;
    const existing = state.assignments.find(
      ({ worktree }) => worktree === context.worktree
    );
    if (existing) {
      const simulator = state.simulators.find(
        ({ udid }) => udid === existing.simulatorUdid
      );
      if (!simulator) {
        throw new Error(
          `Registry lost managed simulator ${existing.simulatorUdid} during reconciliation.`
        );
      }
      const holdsLease = takeRunnerLease(existing, lease);
      const portWarning = await settlePort(
        context,
        state,
        existing,
        holdsLease
      );
      // The branch may have changed since the last run. Renaming waits until
      // nothing before the write can still fail.
      renameSimulator(
        context,
        inventory,
        simulator,
        simulatorNameFor(context, inventory, branches, simulator.udid)
      );
      renameFreeSimulators(context, state, inventory);
      await persistIfChanged(context.statePath, state, baseline);
      if (portWarning) warn(portWarning);
      return {
        assignment: existing,
        simulatorName: simulator.name,
        source: 'existing',
      };
    }

    // Reserve the port first: creating a simulator that the registry never
    // records would leave an unreclaimable device behind.
    const port = await allocatePort(state, context.config);
    let simulator = getFreeManagedSimulator(state, usableDeviceMap(inventory));
    let created = false;
    if (simulator) {
      renameSimulator(
        context,
        inventory,
        simulator,
        simulatorNameFor(context, inventory, branches, simulator.udid)
      );
    } else {
      const template = requested ?? selectSimulatorTemplate(inventory);
      simulator = createSimulator(
        context,
        template,
        simulatorNameFor(context, inventory, branches)
      );
      state.simulators.push(simulator);
      created = true;
    }
    const assignment: Assignment = {
      worktree: context.worktree,
      simulatorUdid: simulator.udid,
      port,
      runner: lease,
    };
    state.assignments.push(assignment);
    renameFreeSimulators(context, state, inventory);
    try {
      await writeState(context.statePath, state);
    } catch (error: unknown) {
      // Only a simulator this allocation created is safe to remove. A pooled one
      // predates this run and still belongs to the registry that was just read.
      if (!created) throw error;
      try {
        deleteSimulator(context, simulator.udid);
      } catch (cleanupError: unknown) {
        // The CLI prints .message, so both failures and the surviving device
        // have to be in the text itself.
        throw new Error(
          `${errorMessage(error)}\nCleaning up after that failure also failed: ${errorMessage(cleanupError)}\n${simulator.name} (${simulator.udid}) was created by this run and is not in the registry. Delete it with "xcrun simctl delete ${simulator.udid}".`
        );
      }
      throw error;
    }
    return {
      assignment,
      simulatorName: simulator.name,
      source: created ? 'created' : 'pooled',
    };
  });

const planRun = async (
  context: GitContext,
  templateUdid?: string
): Promise<PlannedAllocation> => {
  const inventory = getSimulatorInventory(context);
  const branches = await getWorktreeBranches(context.worktree);
  const state = reconcileState(
    await readState(context),
    new Set(branches.keys()),
    inventory
  );
  const requested = templateUdid
    ? selectSimulatorTemplate(inventory, templateUdid)
    : undefined;
  const existing = state.assignments.find(
    ({ worktree }) => worktree === context.worktree
  );
  if (existing) {
    const simulator = state.simulators.find(
      ({ udid }) => udid === existing.simulatorUdid
    );
    if (!simulator) {
      throw new Error(
        `Managed simulator ${existing.simulatorUdid} is missing.`
      );
    }
    return {
      assignment: existing,
      simulatorName: simulatorNameFor(
        context,
        inventory,
        branches,
        simulator.udid
      ),
      source: 'existing',
    };
  }
  const simulator = getFreeManagedSimulator(state, usableDeviceMap(inventory));
  const port = await allocatePort(state, context.config);
  if (simulator) {
    return {
      assignment: {
        worktree: context.worktree,
        simulatorUdid: simulator.udid,
        port,
      },
      simulatorName: simulatorNameFor(
        context,
        inventory,
        branches,
        simulator.udid
      ),
      source: 'pooled',
    };
  }
  const template = requested ?? selectSimulatorTemplate(inventory);
  return {
    simulatorName: simulatorNameFor(context, inventory, branches),
    source: 'created',
    template,
    assignment: {
      worktree: context.worktree,
      simulatorUdid: '<new simulator UDID>',
      port,
    },
  };
};

export const run = async (
  context: GitContext,
  options: CliOptions
): Promise<number | NodeJS.Signals> => {
  const prerequisites = await checkRunPrerequisites(context, !options.dryRun);
  if (options.dryRun) {
    const allocation = await planRun(context, options.templateUdid);
    printRunSelection(context, allocation, prerequisites.expoExecutable, true);
    const ignored = options.templateUdid
      ? ignoredTemplateWarning(allocation.source)
      : undefined;
    if (ignored) warn(ignored);
    prerequisites.warnings.forEach(warn);
    return 0;
  }

  const lease = newRunnerLease();
  const allocation = await allocateRun(context, lease, options.templateUdid);
  const { assignment } = allocation;
  // A second run in a worktree whose runner is still active leaves that
  // runner's lease in place, and then there is nothing for this run to release.
  const holdsLease = isSameRunnerLease(assignment.runner, lease);
  try {
    printRunSelection(context, allocation, prerequisites.expoExecutable, false);
    const ignored = options.templateUdid
      ? ignoredTemplateWarning(allocation.source)
      : undefined;
    if (ignored) warn(ignored);
    await copyFile(context.environmentSource, context.environmentDestination);
    bootSimulator(context, assignment);
    setMetroLocation(context, assignment);
    // Awaited here so that the lease outlives Expo. A forwarded signal ends
    // Expo and resolves this call, which is why the release below also runs
    // when the runner is interrupted.
    return await launchExpo(context, prerequisites.expoExecutable, assignment);
  } finally {
    if (holdsLease) await releaseRunnerLease(context, lease);
  }
};
