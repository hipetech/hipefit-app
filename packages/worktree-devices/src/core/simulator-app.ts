import { spawnSync } from 'node:child_process';
import type { GitContext } from '../types';

import { sleep } from '../lib/async';
import { commandSucceeds } from '../lib/command';

export const SIMULATOR_APP_PROCESS = 'Simulator.app/Contents/MacOS/Simulator';

// Only a normal quit makes Simulator shut down the devices it draws, so killing
// it is what keeps them running. Launch Services still needs the process to be
// reaped before it will start again, and reopening too early fails with -600.
export const killSimulatorApp = async (
  context: GitContext
): Promise<boolean> => {
  const isRunning = (): boolean =>
    commandSucceeds('pgrep', ['-f', SIMULATOR_APP_PROCESS], context.worktree);
  if (!isRunning()) return false;
  spawnSync('pkill', ['-9', '-f', SIMULATOR_APP_PROCESS], {
    cwd: context.worktree,
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!isRunning()) break;
    await sleep(100);
  }
  await sleep(300);
  return true;
};
