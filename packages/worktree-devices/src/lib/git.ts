import { isAbsolute, resolve } from 'node:path';

import { commandOutput } from './command';
import { canonicalPath, pathIsAccessible } from './fs';

const WORKTREE_FIELD_PREFIX = 'worktree ';

const worktreeFields = (cwd: string): string[] =>
  commandOutput('git', ['worktree', 'list', '--porcelain', '-z'], cwd)
    .split('\0')
    .filter((field) => field.startsWith(WORKTREE_FIELD_PREFIX))
    .map((field) => field.slice(WORKTREE_FIELD_PREFIX.length));

export const getWorktreeRoot = async (cwd: string): Promise<string> =>
  canonicalPath(commandOutput('git', ['rev-parse', '--show-toplevel'], cwd));

export const getCommonGitDirectory = async (cwd: string): Promise<string> => {
  const output = commandOutput(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    cwd
  );
  return canonicalPath(isAbsolute(output) ? output : resolve(cwd, output));
};

export const getCanonicalWorktrees = async (
  cwd: string
): Promise<Set<string>> => {
  const worktrees = new Set<string>();
  for (const path of worktreeFields(cwd)) {
    if (!(await pathIsAccessible(path))) continue;
    worktrees.add(await canonicalPath(path));
  }
  return worktrees;
};
