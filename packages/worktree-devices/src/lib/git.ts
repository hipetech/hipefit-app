import { basename, isAbsolute, resolve } from 'node:path';

import { commandOutput } from './command';
import { canonicalPath, pathIsAccessible } from './fs';

const WORKTREE_FIELD_PREFIX = 'worktree ';
const BRANCH_FIELD_PREFIX = 'branch refs/heads/';

interface WorktreeRecord {
  path: string;
  branch?: string;
}

// A record is a run of fields that starts with the worktree's path. A detached
// worktree has no branch field.
const worktreeRecords = (cwd: string): WorktreeRecord[] => {
  const records: WorktreeRecord[] = [];
  const fields = commandOutput(
    'git',
    ['worktree', 'list', '--porcelain', '-z'],
    cwd
  ).split('\0');
  for (const field of fields) {
    if (field.startsWith(WORKTREE_FIELD_PREFIX)) {
      records.push({ path: field.slice(WORKTREE_FIELD_PREFIX.length) });
      continue;
    }
    const current = records.at(-1);
    if (current && field.startsWith(BRANCH_FIELD_PREFIX)) {
      current.branch = field.slice(BRANCH_FIELD_PREFIX.length);
    }
  }
  return records;
};

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

// Maps every accessible worktree to its checked-out branch, which is undefined
// for a detached HEAD.
export const getWorktreeBranches = async (
  cwd: string
): Promise<Map<string, string | undefined>> => {
  const worktrees = new Map<string, string | undefined>();
  for (const { path, branch } of worktreeRecords(cwd)) {
    if (!(await pathIsAccessible(path))) continue;
    worktrees.set(await canonicalPath(path), branch);
  }
  return worktrees;
};

export const getCanonicalWorktrees = async (
  cwd: string
): Promise<Set<string>> => new Set((await getWorktreeBranches(cwd)).keys());

// Branches are usually namespaced by owner or kind, and the last segment is the
// part that tells one worktree from another. The directory stands in when
// there is no branch.
export const worktreeLabel = (worktree: string, branch?: string): string =>
  branch?.split('/').at(-1) || basename(worktree);
