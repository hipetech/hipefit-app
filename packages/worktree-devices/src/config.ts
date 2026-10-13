import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CONFIG_FILENAME = 'worktree-devices.json';

export interface PortRange {
  start: number;
  end: number;
}

export interface WorktreeDevicesConfig {
  appDirectory: string;
  scheme: string;
  bundleIdentifier: string;
  environmentFile: string;
  environmentLocalName: string;
  simulatorNamePrefix: string;
  registryName: string;
  ports: PortRange;
  reservedPorts: readonly number[];
}

// Everything the tool can infer stays out of the config file, so a repository
// only has to name the things that are genuinely its own.
const DEFAULTS = {
  environmentFile: '.env.development',
  environmentLocalName: '.env.local',
  simulatorNamePrefix: 'Worktree',
  registryName: 'worktree-devices',
  ports: { start: 18_081, end: 18_180 },
  // Metro's default port belongs to whichever command runs without this tool.
  reservedPorts: [8081],
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireString = (
  source: Record<string, unknown>,
  key: string,
  path: string
): string => {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must set "${key}" to a non-empty string.`);
  }
  return value;
};

const optionalString = (
  source: Record<string, unknown>,
  key: string,
  path: string,
  fallback: string
): string => {
  const value = source[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} sets "${key}" to something other than a name.`);
  }
  return value;
};

const optionalPorts = (
  source: Record<string, unknown>,
  path: string
): PortRange => {
  const value = source.ports;
  if (value === undefined) return { ...DEFAULTS.ports };
  if (!isRecord(value))
    throw new Error(`${path} must set "ports" to an object.`);
  const { start, end } = value;
  if (
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1024 ||
    end > 65_535 ||
    start > end
  ) {
    throw new Error(
      `${path} must set "ports" to whole numbers between 1024 and 65535 with "start" no higher than "end".`
    );
  }
  return { start, end };
};

const optionalReservedPorts = (
  source: Record<string, unknown>,
  path: string
): readonly number[] => {
  const value = source.reservedPorts;
  if (value === undefined) return [...DEFAULTS.reservedPorts];
  if (
    !Array.isArray(value) ||
    value.some((entry) => !Number.isInteger(entry))
  ) {
    throw new Error(
      `${path} must set "reservedPorts" to a list of whole numbers.`
    );
  }
  return value as number[];
};

export const decodeConfig = (
  value: unknown,
  path: string
): WorktreeDevicesConfig => {
  if (!isRecord(value)) {
    throw new Error(`${path} must contain a JSON object.`);
  }
  return {
    appDirectory: requireString(value, 'appDirectory', path),
    scheme: requireString(value, 'scheme', path),
    bundleIdentifier: requireString(value, 'bundleIdentifier', path),
    environmentFile: optionalString(
      value,
      'environmentFile',
      path,
      DEFAULTS.environmentFile
    ),
    environmentLocalName: optionalString(
      value,
      'environmentLocalName',
      path,
      DEFAULTS.environmentLocalName
    ),
    simulatorNamePrefix: optionalString(
      value,
      'simulatorNamePrefix',
      path,
      DEFAULTS.simulatorNamePrefix
    ),
    registryName: optionalString(
      value,
      'registryName',
      path,
      DEFAULTS.registryName
    ),
    ports: optionalPorts(value, path),
    reservedPorts: optionalReservedPorts(value, path),
  };
};

const EXAMPLE = `{
  "appDirectory": "apps/mobile",
  "scheme": "MyApp-dev",
  "bundleIdentifier": "com.example.myapp.development"
}`;

export const readConfig = async (
  worktree: string
): Promise<WorktreeDevicesConfig> => {
  const path = join(worktree, CONFIG_FILENAME);
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error: unknown) {
    if (isRecord(error) && error.code === 'ENOENT') {
      throw new Error(
        `Missing ${path}. Create it with at least the app directory, scheme, and bundle identifier:\n${EXAMPLE}`
      );
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error: unknown) {
    throw new Error(
      `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return decodeConfig(parsed, path);
};
