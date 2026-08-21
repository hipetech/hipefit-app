import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const firebaseDirectory = fileURLToPath(
  new URL('../../firebase/', import.meta.url)
);
const firebaseExecutable = fileURLToPath(
  new URL('../../node_modules/.bin/firebase', import.meta.url)
);
const projectIds = {
  development: 'hipefit-app-dev',
  staging: 'hipefit-app-stage',
} as const;

const normalizeArguments = (args: string[]): string[] => {
  if (args[0] !== 'deploy') {
    throw new Error('Firebase CLI wrapper permits only the deploy command.');
  }
  if (args.includes('--')) {
    throw new Error(
      'Firebase CLI wrapper does not accept an argument delimiter.'
    );
  }
  if (
    args.some(
      (argument) =>
        argument === '--config' ||
        argument === '-c' ||
        argument.startsWith('--config=') ||
        /^-c.+/.test(argument)
    )
  ) {
    throw new Error('Firebase CLI wrapper uses only the repository config.');
  }

  let environment: keyof typeof projectIds | undefined;
  const normalized: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--project' || argument === '-P') {
      const value = args[index + 1];
      if (!value) throw new Error(`${argument} requires an environment.`);
      if (environment) throw new Error('Pass exactly one Firebase project.');
      environment = value as keyof typeof projectIds;
      index += 1;
      continue;
    }

    const projectAssignment = argument?.match(/^(?:--project=|-P=?)(.+)$/);
    if (projectAssignment) {
      if (environment) throw new Error('Pass exactly one Firebase project.');
      environment = projectAssignment[1] as keyof typeof projectIds;
      continue;
    }
    if (argument !== undefined) normalized.push(argument);
  }

  if (!environment || !(environment in projectIds)) {
    throw new Error(
      'Firebase CLI commands require --project development or --project staging.'
    );
  }

  return [...normalized, '--project', projectIds[environment]];
};

const args = normalizeArguments(process.argv.slice(2));
const result = spawnSync(firebaseExecutable, args, {
  cwd: firebaseDirectory,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
