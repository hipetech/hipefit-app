import { createInterface } from 'node:readline/promises';
import type { Environment } from '../seed/types';
import type { UserProfile } from '@hipefit/schemas';
import { decodeUserProfile } from '@hipefit/schemas';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { initFirebase } from '../seed/utils';
import { INITIAL_SCHEMA_VERSION, migrateInitialData } from './001-initial-data';

const VALID_ENVIRONMENTS: Environment[] = [
  'development',
  'staging',
  'production',
];

interface MigrationOptions {
  environment: Environment;
  dryRun: boolean;
}

const parseOptions = (): MigrationOptions => {
  const args = process.argv.slice(2);
  let environment: Environment | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--env') {
      if (environment) throw new Error('Pass --env exactly once.');
      const value = args[index + 1];
      if (!VALID_ENVIRONMENTS.includes(value as Environment)) {
        throw new Error(
          `Missing or invalid --env. Expected one of: ${VALID_ENVIRONMENTS.join(', ')}.`
        );
      }
      environment = value as Environment;
      index += 1;
      continue;
    }
    if (argument === '--dry-run') {
      if (dryRun) throw new Error('Pass --dry-run at most once.');
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown migration argument: ${argument}`);
  }

  if (!environment) {
    throw new Error(
      `Missing or invalid --env. Expected one of: ${VALID_ENVIRONMENTS.join(', ')}.`
    );
  }
  return { environment, dryRun };
};

const confirmProduction = async ({
  environment,
  dryRun,
}: MigrationOptions): Promise<void> => {
  if (environment !== 'production' || dryRun) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Production migration requires an interactive terminal.');
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let answer: string;
  try {
    answer = await prompt.question(
      'Production migration requested. Type "production" to continue: '
    );
  } finally {
    prompt.close();
  }
  if (answer !== 'production') {
    throw new Error('Production confirmation did not match; no changes made.');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readSchemaVersion = (profile: Record<string, unknown>): number => {
  if (profile.schemaVersion === undefined) return 0;
  if (
    typeof profile.schemaVersion !== 'number' ||
    !Number.isInteger(profile.schemaVersion) ||
    profile.schemaVersion < 0
  ) {
    throw new Error('schemaVersion must be a non-negative integer.');
  }
  return profile.schemaVersion;
};

interface PreparedMigration {
  profile: UserProfile;
  schemaVersion: number;
}

// The document is written with a server timestamp, but it has to clear
// `assertTimestampOrder` before it can be written. Validate against a placeholder that
// is never earlier than `createdAt` so an operator clock lagging the server cannot fail
// an otherwise sound document.
const validationTimestamp = (createdAt: unknown): Timestamp => {
  const now = Timestamp.now();
  return createdAt instanceof Timestamp && createdAt.toMillis() > now.toMillis()
    ? createdAt
    : now;
};

const prepareMigration = (rawProfile: unknown): PreparedMigration | null => {
  if (!isRecord(rawProfile)) throw new Error('Profile must be an object.');

  const schemaVersion = readSchemaVersion(rawProfile);
  if (schemaVersion > INITIAL_SCHEMA_VERSION) {
    throw new Error(
      `Schema ${schemaVersion} is newer than supported schema ${INITIAL_SCHEMA_VERSION}.`
    );
  }
  if (schemaVersion === INITIAL_SCHEMA_VERSION) {
    if (!decodeUserProfile(rawProfile)) {
      throw new Error('Current-schema profile is malformed.');
    }
    return null;
  }

  const migrated = migrateInitialData(rawProfile);
  const profile = decodeUserProfile({
    ...migrated,
    updatedAt: validationTimestamp(migrated.createdAt),
  });
  if (!profile) {
    throw new Error('Migrated profile does not match the current schema.');
  }
  return { profile, schemaVersion };
};

const main = async (): Promise<void> => {
  const options = parseOptions();
  await confirmProduction(options);

  const { db } = initFirebase(options.environment);
  const users = await db.collection('users').get();
  let migrated = 0;
  let failed = 0;

  for (const document of users.docs) {
    try {
      const prepared = options.dryRun
        ? prepareMigration(document.data())
        : await db.runTransaction(async (transaction) => {
            const currentDocument = await transaction.get(document.ref);
            if (!currentDocument.exists) {
              throw new Error('Profile was deleted during migration.');
            }
            const current = prepareMigration(currentDocument.data());
            if (current) {
              // `current.profile.updatedAt` is only the validation placeholder.
              // Firestore rules require a client's next write to satisfy
              // `updatedAt == request.time`, so persisting this host's clock would
              // reject the user's own writes until the server caught up to it.
              transaction.set(document.ref, {
                ...current.profile,
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
            return current;
          });
      if (!prepared) continue;

      console.log(
        `${options.dryRun ? 'Would migrate' : 'Migrated'} users/${document.id} from schema ${prepared.schemaVersion} to ${INITIAL_SCHEMA_VERSION}.`
      );
      migrated += 1;
    } catch (error: unknown) {
      failed += 1;
      console.error(`Cannot migrate users/${document.id}:`, error);
    }
  }

  console.log(
    `${options.dryRun ? 'Found' : 'Migrated'} ${migrated} user documents.`
  );
  if (failed > 0) {
    throw new Error(`${failed} user documents could not be migrated.`);
  }
};

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
