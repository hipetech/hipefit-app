import { createInterface } from 'node:readline/promises';
import type { Environment } from './types';

import { initFirebase } from './utils';

const VALID_ENVIRONMENTS: Environment[] = [
  'development',
  'staging',
  'production',
];

function parseEnvironment(): Environment {
  const args = process.argv.slice(2);
  const envIndex = args.indexOf('--env');
  if (envIndex === -1 || !args[envIndex + 1]) {
    throw new Error('Missing required flag: --env <environment>.');
  }

  const environment = args[envIndex + 1];
  if (!VALID_ENVIRONMENTS.includes(environment as Environment)) {
    throw new Error(
      `Invalid --env value: "${environment}". Must be one of: ${VALID_ENVIRONMENTS.join(', ')}.`
    );
  }
  if (environment === 'production') {
    throw new Error('Wipe refuses to run against production.');
  }
  return environment as Environment;
}

async function confirmWipe(environment: Environment): Promise<void> {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(
    `This recursively deletes all Firestore documents and Auth users in ${environment}. Type "${environment}" to continue: `
  );
  prompt.close();

  if (answer !== environment) {
    throw new Error('Environment confirmation did not match; no changes made.');
  }
}

async function countCollection(
  collection: FirebaseFirestore.CollectionReference
): Promise<number> {
  let count = 0;
  const documents = await collection.listDocuments();
  for (const document of documents) {
    if ((await document.get()).exists) count += 1;
    const subcollections = await document.listCollections();
    for (const subcollection of subcollections) {
      count += await countCollection(subcollection);
    }
  }
  return count;
}

async function countFirestoreDocuments(
  db: FirebaseFirestore.Firestore
): Promise<number> {
  let count = 0;
  const collections = await db.listCollections();
  for (const collection of collections)
    count += await countCollection(collection);
  return count;
}

async function countAuthUsers(auth: ReturnType<typeof initFirebase>['auth']) {
  let count = 0;
  let pageToken: string | undefined;
  do {
    const result = await auth.listUsers(1000, pageToken);
    count += result.users.length;
    pageToken = result.pageToken;
  } while (pageToken);
  return count;
}

async function deleteAllAuthUsers(
  auth: ReturnType<typeof initFirebase>['auth']
): Promise<void> {
  while (true) {
    const result = await auth.listUsers(1000);
    if (result.users.length === 0) return;

    const deletion = await auth.deleteUsers(result.users.map(({ uid }) => uid));
    if (deletion.failureCount > 0) {
      const failures = deletion.errors
        .map(
          ({ index, error }) => `${result.users[index]?.uid}: ${error.message}`
        )
        .join(', ');
      throw new Error(
        `Failed to delete ${deletion.failureCount} Auth users: ${failures}`
      );
    }
  }
}

async function main(): Promise<void> {
  const environment = parseEnvironment();
  await confirmWipe(environment);

  const { auth, db } = initFirebase(environment);
  const [documentCount, userCount] = await Promise.all([
    countFirestoreDocuments(db),
    countAuthUsers(auth),
  ]);
  console.log(
    `Deleting ${documentCount} Firestore documents, then ${userCount} Auth users from ${environment}.`
  );

  const collections = await db.listCollections();
  for (const collection of collections) await db.recursiveDelete(collection);
  await deleteAllAuthUsers(auth);

  const [remainingDocuments, remainingUsers] = await Promise.all([
    countFirestoreDocuments(db),
    countAuthUsers(auth),
  ]);
  if (remainingDocuments !== 0 || remainingUsers !== 0) {
    throw new Error(
      `Post-wipe verification failed: ${remainingDocuments} Firestore documents and ${remainingUsers} Auth users remain.`
    );
  }

  console.log(
    'Post-wipe verification passed: 0 Firestore documents, 0 Auth users.'
  );
}

main().catch((error: unknown) => {
  console.error('Wipe failed:', error);
  process.exit(1);
});
