import { resolve } from 'path';
import type { SeedOptions } from './types';
import type { App } from 'firebase-admin/app';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SERVICE_ACCOUNT_PATHS: Record<SeedOptions['env'], string> = {
  development: resolve(__dirname, '../service-account.development.json'),
  staging: resolve(__dirname, '../service-account.staging.json'),
  production: resolve(__dirname, '../service-account.json'),
};

export function initFirebase(
  env: SeedOptions['env']
): FirebaseFirestore.Firestore {
  const serviceAccountPath = SERVICE_ACCOUNT_PATHS[env];
  const app: App = initializeApp({ credential: cert(serviceAccountPath) });
  return getFirestore(app);
}

export async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collectionPath: string
): Promise<void> {
  const BATCH_LIMIT = 499;
  const snapshot = await db.collection(collectionPath).get();
  if (snapshot.empty) return;

  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

// Firestore batch limit is 500 ops — splits any set of refs+data into safe chunks
export async function chunkedBatch<T>(
  db: FirebaseFirestore.Firestore,
  items: T[],
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
