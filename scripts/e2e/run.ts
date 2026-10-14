import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

// Paths handed to Maestro are relative to the repository root, which is the
// child's working directory.
const WORKSPACE_PATH = 'e2e';
const OUTPUT_PATH = 'e2e/output';

// The development row of the Environments table in docs/app/architecture.md.
// The flows run against the development build only: they sign in with Quick
// Login, which creates an anonymous account in that build's Firebase project.
const DEVELOPMENT_BUNDLE_IDENTIFIER = 'com.kyrylokorota.hipefitapp.development';

// Names the simulator to test when more than one is booted.
const DEVICE_VARIABLE = 'E2E_DEVICE';

// `ios:development` serves Metro on the React Native default. `ios:worktree`
// reserves another port per worktree, and RCT_METRO_PORT names it when set.
const DEFAULT_METRO_PORT = 8081;
const METRO_RUNNING_RESPONSE = 'packager-status:running';
const METRO_TIMEOUT_MS = 2000;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const assertMaestroInstalled = (): void => {
  const result = spawnSync('maestro', ['--version'], { stdio: 'ignore' });
  if (result.error || result.status !== 0) {
    throw new Error(
      'Preflight 1 of 4 failed: the Maestro CLI did not run. Install it ' +
        '(https://docs.maestro.dev/getting-started/installing-maestro) and ' +
        'check that `maestro --version` works in this shell.'
    );
  }
};

interface BootedDevice {
  name: string;
  udid: string;
}

const readBootedDevices = (listing: string): BootedDevice[] => {
  const parsed: unknown = JSON.parse(listing);
  if (!isRecord(parsed) || !isRecord(parsed.devices)) return [];
  return Object.values(parsed.devices).flatMap((runtimeDevices) =>
    Array.isArray(runtimeDevices)
      ? runtimeDevices.flatMap((device: unknown) =>
          isRecord(device) &&
          typeof device.name === 'string' &&
          typeof device.udid === 'string'
            ? [{ name: device.name, udid: device.udid }]
            : []
        )
      : []
  );
};

const describeDevices = (devices: BootedDevice[]): string =>
  devices.map((device) => `  ${device.name} (${device.udid})`).join('\n');

// Every flow starts by clearing the app's state and the simulator keychain, so
// the run must never land on a simulator it was not aimed at. With one booted
// simulator the choice is unambiguous. With several, which is the normal state
// when worktrees run side by side, the device has to be named.
const resolveTargetDevice = (): BootedDevice => {
  const result = spawnSync(
    'xcrun',
    ['simctl', 'list', 'devices', 'booted', '-j'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  if (result.error || result.status !== 0) {
    const detail = result.error
      ? errorMessage(result.error)
      : result.stderr.trim();
    throw new Error(
      'Preflight 2 of 4 failed: `xcrun simctl list devices booted -j` did ' +
        `not run${detail ? ` (${detail})` : ''}. Install Xcode and its ` +
        'command line tools.'
    );
  }

  let bootedDevices: BootedDevice[];
  try {
    bootedDevices = readBootedDevices(result.stdout);
  } catch (error) {
    throw new Error(
      'Preflight 2 of 4 failed: could not read the simulator list ' +
        `(${errorMessage(error)}).`
    );
  }
  if (bootedDevices.length === 0) {
    throw new Error(
      'Preflight 2 of 4 failed: no iOS Simulator is booted. Boot one from ' +
        'Simulator.app or with `xcrun simctl boot <device>`.'
    );
  }

  const requestedUdid = process.env[DEVICE_VARIABLE]?.trim();
  if (requestedUdid) {
    const requested = bootedDevices.find(
      (device) => device.udid === requestedUdid
    );
    if (!requested) {
      throw new Error(
        `Preflight 2 of 4 failed: ${DEVICE_VARIABLE} names ${requestedUdid}, ` +
          'which is not a booted simulator. Booted simulators:\n' +
          describeDevices(bootedDevices)
      );
    }
    return requested;
  }

  const [onlyDevice] = bootedDevices;
  if (bootedDevices.length > 1 || !onlyDevice) {
    throw new Error(
      `Preflight 2 of 4 failed: ${bootedDevices.length} simulators are ` +
        `booted. Set ${DEVICE_VARIABLE} to the UDID of the one to test, in ` +
        '`e2e/.env` or the shell. `bun run ios:worktree:list` shows the ' +
        'simulator assigned to each worktree. Booted simulators:\n' +
        describeDevices(bootedDevices)
    );
  }
  return onlyDevice;
};

const assertDevelopmentAppInstalled = (device: BootedDevice): void => {
  const result = spawnSync(
    'xcrun',
    ['simctl', 'get_app_container', device.udid, DEVELOPMENT_BUNDLE_IDENTIFIER],
    { stdio: 'ignore' }
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      'Preflight 3 of 4 failed: the development build ' +
        `(${DEVELOPMENT_BUNDLE_IDENTIFIER}) is not installed on ` +
        `${device.name} (${device.udid}). Run \`bun run ios:development\` ` +
        'or, in a worktree, `bun run ios:worktree` first.'
    );
  }
};

const resolveMetroPort = (): number => {
  const configured = Number(process.env.RCT_METRO_PORT);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_METRO_PORT;
};

const isMetroRunning = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${port}/status`, {
      signal: AbortSignal.timeout(METRO_TIMEOUT_MS),
    });
    return (await response.text()).trim() === METRO_RUNNING_RESPONSE;
  } catch {
    return false;
  }
};

// Warns instead of failing: a Release build runs without Metro, while a Debug
// build cannot load its bundle without it.
const warnWhenMetroIsDown = async (): Promise<void> => {
  const port = resolveMetroPort();
  if (await isMetroRunning(port)) return;
  console.warn(
    `Preflight 4 of 4 warning: Metro did not answer on port ${port}. A ` +
      'Debug build cannot load without it, so start it with ' +
      '`bun run ios:development` or `bun run ios:worktree`. A worktree run ' +
      'serves Metro on its own port; set RCT_METRO_PORT to it. A Release ' +
      'build runs without Metro.'
  );
};

// An argument that names an existing flow file or folder replaces the default
// workspace target. Anything else is appended after it.
const buildMaestroArguments = (
  device: BootedDevice,
  extraArguments: string[]
): string[] => {
  const replacesTarget = extraArguments.some(
    (argument) =>
      !argument.startsWith('-') && existsSync(resolve(repositoryRoot, argument))
  );
  return [
    '--device',
    device.udid,
    'test',
    ...(replacesTarget ? [] : [WORKSPACE_PATH]),
    '--test-output-dir',
    OUTPUT_PATH,
    ...extraArguments,
  ];
};

const run = async (): Promise<number> => {
  assertMaestroInstalled();
  const device = resolveTargetDevice();
  assertDevelopmentAppInstalled(device);
  await warnWhenMetroIsDown();

  const extraArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== '--');
  console.log(`Running on ${device.name} (${device.udid}).`);
  const result = spawnSync(
    'maestro',
    buildMaestroArguments(device, extraArguments),
    { cwd: repositoryRoot, stdio: 'inherit' }
  );

  if (result.error) throw result.error;
  return result.status ?? 1;
};

run().then(
  (status) => process.exit(status),
  (error: unknown) => {
    console.error(errorMessage(error));
    process.exit(1);
  }
);
