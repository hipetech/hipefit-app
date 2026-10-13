import type { GitContext, SimctlDevice } from '../types';

import { checkSimctlPrerequisite } from '../core/expo';
import { existingDeviceMap, getSimulatorInventory } from '../core/inventory';
import { portAcceptsConnections } from '../core/ports';
import { readState, reconcileState } from '../core/registry';
import { describeRunner, runnerIsLive } from '../core/runner';
import { getCanonicalWorktrees } from '../lib/git';

const describeSimulator = (
  udid: string,
  name: string | undefined,
  device: SimctlDevice | undefined
): string =>
  `${name ?? device?.name ?? 'unknown'} (${udid}) ${device?.state ?? 'missing'}`;

// Read-only: list never takes the lock and never writes, so it is safe to run
// while another worktree is allocating.
export const list = async (context: GitContext): Promise<void> => {
  checkSimctlPrerequisite(context);
  const inventory = getSimulatorInventory(context);
  const worktrees = await getCanonicalWorktrees(context.worktree);
  const stored = await readState(context);
  const state = reconcileState(stored, worktrees, inventory);
  const devices = existingDeviceMap(inventory);
  const names = new Map(
    stored.simulators.map(({ udid, name }) => [udid, name])
  );

  const assignments = [...state.assignments].sort(
    (left, right) => left.port - right.port
  );
  if (assignments.length === 0) {
    console.log('No worktree has a simulator assigned.');
  }
  for (const assignment of assignments) {
    const here =
      assignment.worktree === context.worktree ? ' (this worktree)' : '';
    console.log(`${assignment.worktree}${here}`);
    console.log(
      `  Simulator: ${describeSimulator(assignment.simulatorUdid, names.get(assignment.simulatorUdid), devices.get(assignment.simulatorUdid))}`
    );
    const metroIsUp = await portAcceptsConnections(assignment.port);
    console.log(
      `  Metro port: ${assignment.port}${metroIsUp ? ' (serving)' : ' (idle)'}`
    );
    // Detach refuses on an active runner even while the port is idle, which is
    // the state of a worktree whose app is still building.
    const runner = assignment.runner;
    console.log(
      `  Runner: ${runner && runnerIsLive(runner) ? `active (${describeRunner(runner)})` : 'none'}`
    );
  }

  const assigned = new Set(
    state.assignments.map(({ simulatorUdid }) => simulatorUdid)
  );
  const free = state.simulators.filter(({ udid }) => !assigned.has(udid));
  if (free.length > 0) {
    console.log('\nFree pool:');
    free.forEach(({ udid, name }) => {
      console.log(`  ${describeSimulator(udid, name, devices.get(udid))}`);
    });
  }

  const keptWorktrees = new Set(
    state.assignments.map(({ worktree }) => worktree)
  );
  const stale = stored.assignments.filter(
    ({ worktree }) => !keptWorktrees.has(worktree)
  );
  if (stale.length > 0) {
    console.log('\nStale, cleared by the next run or detach:');
    stale.forEach(({ worktree, simulatorUdid, port }) => {
      console.log(`  ${worktree} (${simulatorUdid}, port ${port})`);
    });
  }
};
