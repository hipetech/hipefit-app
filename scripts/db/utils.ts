import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Environment } from './types';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const SERVICE_ACCOUNT_PATHS: Record<Environment, string> = {
  development: resolve(__dirname, '../service-account.development.json'),
  staging: resolve(__dirname, '../service-account.staging.json'),
  production: resolve(__dirname, '../service-account.json'),
};

const FIREBASE_PROJECT_IDS: Record<Environment, string> = {
  development: 'hipefit-app-dev',
  staging: 'hipefit-app-stage',
  production: 'hipefit-app',
};

export interface FirebaseAdminServices {
  app: App;
  auth: Auth;
  db: FirebaseFirestore.Firestore;
}

const readServiceAccountProjectId = (serviceAccountPath: string): string => {
  const serviceAccount: unknown = JSON.parse(
    readFileSync(serviceAccountPath, 'utf8')
  );
  if (
    typeof serviceAccount !== 'object' ||
    serviceAccount === null ||
    Array.isArray(serviceAccount)
  ) {
    throw new Error('Service account JSON must contain an object');
  }

  const projectId = (serviceAccount as Record<string, unknown>).project_id;
  if (typeof projectId !== 'string' || projectId.length === 0) {
    throw new Error('Service account JSON is missing project_id');
  }
  return projectId;
};

export function initFirebase(env: Environment): FirebaseAdminServices {
  const serviceAccountPath = SERVICE_ACCOUNT_PATHS[env];
  const expectedProjectId = FIREBASE_PROJECT_IDS[env];
  const projectId = readServiceAccountProjectId(serviceAccountPath);
  if (projectId !== expectedProjectId) {
    throw new Error(
      `Service account project_id ${projectId} does not match ${env} project ${expectedProjectId}`
    );
  }

  const app: App = initializeApp({
    credential: cert(serviceAccountPath),
    projectId: expectedProjectId,
  });
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

export async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collectionPath: string
): Promise<void> {
  await db.recursiveDelete(db.collection(collectionPath));
}

// Firestore batch limit is 500 ops — splits any set of refs+data into safe chunks
export async function chunkedBatch<T>(
  db: FirebaseFirestore.Firestore,
  items: readonly T[],
  getRef: (
    db: FirebaseFirestore.Firestore,
    item: T
  ) => FirebaseFirestore.DocumentReference,
  getData: (item: T) => Record<string, unknown>
): Promise<void> {
  const BATCH_LIMIT = 499;

  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const chunk = items.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const item of chunk) {
      batch.set(getRef(db, item), getData(item));
    }
    await batch.commit();
  }
}
