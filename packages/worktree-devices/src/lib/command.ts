import { spawnSync } from 'node:child_process';

// `simctl list --json` already prints six figures of bytes on a machine with a
// few runtimes installed, so the buffer sits well above Node's 1 MB default.
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const commandOutput = (
  executable: string,
  args: readonly string[],
  cwd: string
): string => {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw new Error(`Cannot run ${executable}: ${errorMessage(result.error)}`);
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(
      `${executable} ${args.join(' ')} failed${detail ? `: ${detail}` : '.'}`
    );
  }
  return result.stdout.trim();
};

export const commandSucceeds = (
  executable: string,
  args: readonly string[],
  cwd: string
): boolean => {
  const result = spawnSync(executable, args, { cwd, stdio: 'ignore' });
  return !result.error && result.status === 0;
};
