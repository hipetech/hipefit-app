import { spawnSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, copyFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';

// Git does not track these, so every linked worktree starts without the copies
// the primary worktree holds.
const ENVIRONMENT_FILENAMES = [
  '.env.development',
  '.env.staging',
  '.env.production',
] as const;

const WORKTREE_FIELD_PREFIX = 'worktree ';

interface CliOptions {
  dryRun: boolean;
  force: boolean;
  help: boolean;
}

type CopyStatus = 'copied' | 'kept' | 'unavailable';

interface CopyResult {
  filename: string;
  status: CopyStatus;
}

const HELP = `Usage:
  bun run scripts/env/sync.ts [--dry-run] [--force]

Copy the untracked environment files from the primary worktree into this
worktree. Existing files are kept unless --force replaces them.

Options:
  --dry-run   Report what would be copied without writing anything.
  --force     Overwrite this worktree's existing environment files.
  -h, --help  Show this help.
`;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const gitOutput = (args: readonly string[], cwd: string): string => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw new Error(`Cannot run git: ${errorMessage(result.error)}`);
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(
      `git ${args.join(' ')} failed${detail ? `: ${detail}` : '.'}`
    );
  }
  return result.stdout.trim();
};

const pathIsAccessible = async (
  path: string,
  mode: number = fsConstants.F_OK
): Promise<boolean> => {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
};

const parseOptions = (args: string[]): CliOptions => {
  let dryRun = false;
  let force = false;
  let help = false;
  for (const argument of args) {
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument === '--force') {
      force = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { dryRun, force, help };
};

const describe = (result: CopyResult, dryRun: boolean): string => {
  if (result.status === 'copied') {
    return `${dryRun ? 'Would copy' : 'Copied'} ${result.filename}`;
  }
  if (result.status === 'kept') {
    return `Kept this worktree's ${result.filename}`;
  }
  return `Not in the primary worktree: ${result.filename}`;
};

const main = async (): Promise<void> => {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  const cwd = process.cwd();
  const worktree = await realpath(
    gitOutput(['rev-parse', '--show-toplevel'], cwd)
  );
  // git worktree list always reports the main worktree first, and that is the
  // one holding the untracked files.
  const [primaryField] = gitOutput(
    ['worktree', 'list', '--porcelain', '-z'],
    cwd
  )
    .split('\0')
    .filter((field) => field.startsWith(WORKTREE_FIELD_PREFIX))
    .map((field) => field.slice(WORKTREE_FIELD_PREFIX.length));
  if (!primaryField) throw new Error('git worktree list reported no worktree.');
  const primary = await realpath(primaryField);

  if (worktree === primary) {
    console.log(
      `${worktree} is the primary worktree. Its environment files are the source other worktrees copy from.`
    );
    return;
  }

  console.log(`Primary worktree: ${primary}`);
  const results: CopyResult[] = [];
  for (const filename of ENVIRONMENT_FILENAMES) {
    const from = join(primary, filename);
    const to = join(worktree, filename);
    if (!(await pathIsAccessible(from, fsConstants.R_OK))) {
      results.push({ filename, status: 'unavailable' });
      continue;
    }
    if (!options.force && (await pathIsAccessible(to))) {
      results.push({ filename, status: 'kept' });
      continue;
    }
    if (!options.dryRun) await copyFile(from, to);
    results.push({ filename, status: 'copied' });
  }
  results.forEach((result) => {
    console.log(`  ${describe(result, options.dryRun)}`);
  });
  if (!options.force && results.some(({ status }) => status === 'kept')) {
    console.log('Pass --force to replace the files this worktree already has.');
  }
};

main().catch((error: unknown) => {
  console.error(`Environment sync failed: ${errorMessage(error)}`);
  process.exitCode = 1;
});
