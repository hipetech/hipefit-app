import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { join } from 'node:path';
import type { WorktreeDevicesConfig } from '../config';
import type {
  Allocation,
  AllocationSource,
  Assignment,
  GitContext,
  PlannedAllocation,
  RunPrerequisites,
} from '../types';

import { commandSucceeds } from '../lib/command';
import { pathIsAccessible } from '../lib/fs';

const findExpoExecutable = async (
  context: GitContext
): Promise<string | undefined> => {
  const candidates = [
    join(context.mobileDirectory, 'node_modules', '.bin', 'expo'),
    join(context.worktree, 'node_modules', '.bin', 'expo'),
  ];
  for (const candidate of candidates) {
    if (await pathIsAccessible(candidate, fsConstants.X_OK)) return candidate;
  }
  return undefined;
};

export const checkSimctlPrerequisite = (context: GitContext): void => {
  if (!commandSucceeds('xcrun', ['--find', 'simctl'], context.worktree)) {
    throw new Error(
      'Xcode Simulator tools are unavailable. Install Xcode and select it with xcode-select.'
    );
  }
};

// A dry run only reports the selection, so a missing build prerequisite is a
// warning there and an error on a real run.
export const checkRunPrerequisites = async (
  context: GitContext,
  strict: boolean
): Promise<RunPrerequisites> => {
  checkSimctlPrerequisite(context);
  const warnings: string[] = [];
  const check = (satisfied: boolean, message: string): void => {
    if (satisfied) return;
    if (strict) throw new Error(message);
    warnings.push(message);
  };

  check(
    await pathIsAccessible(context.environmentSource, fsConstants.R_OK),
    `Missing ${context.environmentSource}. Run "bun run env:sync" to copy it from the primary worktree, or create it yourself.`
  );
  check(
    await pathIsAccessible(context.mobileDirectory),
    `Missing mobile workspace at ${context.mobileDirectory}.`
  );
  const expoExecutable = await findExpoExecutable(context);
  check(
    expoExecutable !== undefined,
    `Expo is not installed in this worktree. Run "bun install" from ${context.worktree}.`
  );
  check(
    commandSucceeds('pod', ['--version'], context.mobileDirectory),
    'CocoaPods is unavailable. Install CocoaPods before running an iOS build.'
  );
  const podsDirectory = join(context.iosDirectory, 'Pods');
  const podfileLock = join(context.iosDirectory, 'Podfile.lock');
  check(
    (await pathIsAccessible(podsDirectory)) &&
      (await pathIsAccessible(podfileLock, fsConstants.R_OK)),
    `CocoaPods dependencies are missing. Run "pod install" from ${context.iosDirectory}.`
  );
  return {
    expoExecutable:
      expoExecutable ?? join(context.worktree, 'node_modules', '.bin', 'expo'),
    warnings,
  };
};

export const ignoredTemplateWarning = (
  source: AllocationSource
): string | undefined => {
  if (source === 'existing') {
    return '--template was ignored because this worktree already has a simulator.';
  }
  if (source === 'pooled') {
    return '--template was ignored because a pooled simulator was available.';
  }
  return undefined;
};

const shellArgument = (value: string): string =>
  /^[A-Za-z0-9_./:-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", `'\\''`)}'`;

export const expoArguments = (
  assignment: Assignment,
  config: WorktreeDevicesConfig
): string[] => [
  'run:ios',
  '--scheme',
  config.scheme,
  '--device',
  assignment.simulatorUdid,
  '--port',
  String(assignment.port),
];

export const printRunSelection = (
  context: GitContext,
  allocation: PlannedAllocation | Allocation,
  expoExecutable: string,
  dryRun: boolean
): void => {
  const assignment = allocation.assignment;
  if (!assignment) throw new Error('Run allocation is incomplete.');
  console.log(`${dryRun ? 'Dry run for' : 'Worktree'}: ${context.worktree}`);
  console.log(
    `Simulator: ${allocation.simulatorName} (${assignment.simulatorUdid})`
  );
  if ('template' in allocation && allocation.template) {
    console.log(
      `Would create it from: ${allocation.template.deviceTypeName}, ${allocation.template.runtimeName} (${allocation.template.sourceUdid})`
    );
  }
  console.log(`Metro port: ${assignment.port}`);
  console.log(
    `Environment: ${context.environmentSource} -> ${context.environmentDestination}`
  );
  console.log(
    `Expo: ${[expoExecutable, ...expoArguments(assignment, context.config)].map(shellArgument).join(' ')}`
  );
};

export const launchExpo = async (
  context: GitContext,
  expoExecutable: string,
  assignment: Assignment
): Promise<number | NodeJS.Signals> =>
  new Promise<number | NodeJS.Signals>((resolveChild, reject) => {
    const child = spawn(
      expoExecutable,
      expoArguments(assignment, context.config),
      {
        cwd: context.mobileDirectory,
        stdio: 'inherit',
      }
    );
    const signals: NodeJS.Signals[] = [
      'SIGINT',
      'SIGTERM',
      'SIGHUP',
      'SIGQUIT',
    ];
    const forwardSignal = (signal: NodeJS.Signals): void => {
      try {
        child.kill(signal);
      } catch {
        // The child already exited; its close handler resolves the promise.
      }
    };
    const handlers = new Map<NodeJS.Signals, () => void>();
    const cleanup = (): void => {
      handlers.forEach((handler, signal) => {
        process.off(signal, handler);
      });
    };
    signals.forEach((signal) => {
      const handler = (): void => forwardSignal(signal);
      handlers.set(signal, handler);
      process.on(signal, handler);
    });
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('close', (code, signal) => {
      cleanup();
      resolveChild(signal ?? code ?? 1);
    });
  });
