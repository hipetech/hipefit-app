import type { SeedOptions } from './types';
import { FieldValue } from 'firebase-admin/firestore';

import { exerciseGroups } from './data/exercise-groups';
import { exercises } from './data/exercises';
import { chunkedBatch, deleteCollection } from './utils';

export async function seedExercises(
  db: FirebaseFirestore.Firestore,
  opts: SeedOptions
): Promise<void> {
  const groupCount = Object.keys(exerciseGroups).length;

  console.log(`\n🏋️  Seeding exercises`);
  console.log(`   Groups:    ${groupCount}`);
  console.log(`   Exercises: ${exercises.length}`);
  if (opts.dryRun) console.log('   Mode:      DRY RUN\n');
  else console.log(`   Env:       ${opts.env}\n`);

  if (opts.dryRun) {
    console.log('📂 Exercise groups:');
    for (const [id, group] of Object.entries(exerciseGroups)) {
      console.log(
        `   exerciseGroups/${id} → ${group.name} (order: ${group.order})`
      );
    }

    console.log('\n💪 Exercises:');
    for (const exercise of exercises) {
      console.log(
        `   exercises/<auto-id> → ${exercise.name} (${exercise.groupKey}, ${exercise.type})`
      );
    }
    console.log('');
    return;
  }

  if (opts.clean) {
    console.log('🗑️  Cleaning existing data...');
    await deleteCollection(db, 'exercises');
    await deleteCollection(db, 'exerciseGroups');
    console.log('   Done.\n');
  }

  // Validate groupKeys before writing anything
  const validGroupKeys = new Set(Object.keys(exerciseGroups));
  const invalid = exercises.filter((e) => !validGroupKeys.has(e.groupKey));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid groupKey(s): ${invalid.map((e) => `"${e.groupKey}" (${e.name})`).join(', ')}`
    );
  }

  console.log('📂 Seeding exercise groups...');
  await chunkedBatch(
    db,
    Object.entries(exerciseGroups),
    (db, [id]) => db.collection('exerciseGroups').doc(id),
    ([, group]) => ({ ...group })
  );
  console.log(`   ✅ ${groupCount} groups written.\n`);

  console.log('💪 Seeding exercises...');
  await chunkedBatch(
    db,
    exercises,
    (db) => db.collection('exercises').doc(),
    (exercise) => ({ ...exercise, createdAt: FieldValue.serverTimestamp() })
  );
  console.log(`   ✅ ${exercises.length} exercises written.\n`);
}
