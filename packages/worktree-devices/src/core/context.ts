import { join } from 'node:path';
import type { GitContext } from '../types';

import { readConfig } from '../config';
import { getCommonGitDirectory, getWorktreeRoot } from '../lib/git';

export const getGitContext = async (): Promise<GitContext> => {
  const cwd = process.cwd();
  const worktree = await getWorktreeRoot(cwd);
  const config = await readConfig(worktree);
  const commonGitDirectory = await getCommonGitDirectory(cwd);
  const mobileDirectory = join(worktree, config.appDirectory);

  return {
    config,
    worktree,
    commonGitDirectory,
    statePath: join(commonGitDirectory, `${config.registryName}.json`),
    lockPath: join(commonGitDirectory, `${config.registryName}.lock`),
    mobileDirectory,
    environmentSource: join(worktree, config.environmentFile),
    environmentDestination: join(mobileDirectory, config.environmentLocalName),
    iosDirectory: join(mobileDirectory, 'ios'),
  };
};
