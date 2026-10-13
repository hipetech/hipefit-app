import type { WorktreeDevicesConfig } from './config';

export const STATE_VERSION = 1;

export type Command =
  'run' | 'detach' | 'list' | 'show' | 'hide' | 'stop' | 'remove';

export interface CliOptions {
  command?: Command;
  dryRun: boolean;
  force: boolean;
  help: boolean;
  templateUdid?: string;
  target?: string;
  all: boolean;
  confirmed: boolean;
}

export interface GitContext {
  config: WorktreeDevicesConfig;
  worktree: string;
  commonGitDirectory: string;
  statePath: string;
  lockPath: string;
  mobileDirectory: string;
  environmentSource: string;
  environmentDestination: string;
  iosDirectory: string;
}

// Names the `run` command process that is building or serving a worktree's
// app. The pid is that command's own, which is the parent of the Expo process.
export interface RunnerLease {
  pid: number;
  hostname: string;
  startedAt: string;
}

export interface Assignment {
  worktree: string;
  simulatorUdid: string;
  port: number;
  runner?: RunnerLease;
}

export interface ManagedSimulator {
  udid: string;
  name: string;
}

export interface RegistryState {
  version: typeof STATE_VERSION;
  assignments: Assignment[];
  simulators: ManagedSimulator[];
}

export interface SimctlDevice {
  udid: string;
  name: string;
  state: string;
  isAvailable: boolean;
  deviceTypeIdentifier: string;
  runtimeIdentifier: string;
  lastBootedAt?: string;
}

export interface SimctlDeviceType {
  identifier: string;
  name: string;
  productFamily?: string;
}

export interface SimctlRuntime {
  identifier: string;
  name: string;
  version: string;
  isAvailable: boolean;
  platform?: string;
}

export interface SimulatorInventory {
  devices: SimctlDevice[];
  deviceTypes: SimctlDeviceType[];
  runtimes: SimctlRuntime[];
}

export interface SimulatorTemplate {
  deviceTypeIdentifier: string;
  deviceTypeName: string;
  runtimeIdentifier: string;
  runtimeName: string;
  sourceUdid: string;
}

export interface RunPrerequisites {
  expoExecutable: string;
  warnings: string[];
}

export type AllocationSource = 'existing' | 'pooled' | 'created';

export interface Allocation {
  assignment: Assignment;
  simulatorName: string;
  source: AllocationSource;
}

export interface PlannedAllocation {
  assignment?: Assignment;
  simulatorName: string;
  source: AllocationSource;
  template?: SimulatorTemplate;
}

export interface LockOwner {
  pid: number;
  hostname: string;
  createdAt: string;
  token: string;
}

export interface SimulatorChoice {
  simulator: ManagedSimulator;
  device?: SimctlDevice;
  worktree?: string;
  port?: number;
  serving?: boolean;
}
