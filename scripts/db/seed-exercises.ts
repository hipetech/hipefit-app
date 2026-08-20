import type { LocalizedTextSeed, SeedOptions } from './types';

import { equipment } from './data/equipment';
import { exerciseCategories } from './data/exercise-categories';
import { exercises } from './data/exercises';
import { chunkedBatch, deleteCollection } from './utils';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXERCISE_TYPES = new Set(['strength', 'cardio', 'bodyweight']);

function validateKeys(
  value: object,
  path: string,
  expectedKeys: readonly string[]
): void {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actualKeys.length !== expected.length ||
    actualKeys.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${path} must contain exactly: ${expected.join(', ')}.`);
  }
}

function validateLocalizedText(
  value: LocalizedTextSeed,
  path: string,
  maxLength: number
): void {
  validateKeys(value, path, ['en', 'uk']);
  for (const locale of ['en', 'uk'] as const) {
    const text = value[locale];
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error(`${path}.${locale} must be a non-empty string.`);
    }
    if (text.length > maxLength) {
      throw new Error(
        `${path}.${locale} must be at most ${maxLength} characters.`
      );
    }
  }
}

function validateSlugs(
  items: readonly { slug: string }[],
  collection: string
): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item.slug !== 'string' || !SLUG_PATTERN.test(item.slug)) {
      throw new Error(`${collection}/${item.slug} has an invalid slug.`);
    }
    if (seen.has(item.slug)) {
      throw new Error(`${collection}/${item.slug} is duplicated.`);
    }
    seen.add(item.slug);
  }
}

export function validateExerciseSeedData(): void {
  validateSlugs(exerciseCategories, 'exerciseCategories');
  validateSlugs(equipment, 'equipment');
  validateSlugs(exercises, 'exercises');

  const categorySlugs = new Set(exerciseCategories.map(({ slug }) => slug));
  const equipmentSlugs = new Set(equipment.map(({ slug }) => slug));

  for (const category of exerciseCategories) {
    validateKeys(category, `exerciseCategories/${category.slug}`, [
      'slug',
      'name',
      'order',
      'icon',
      'isRetired',
    ]);
    validateLocalizedText(
      category.name,
      `exerciseCategories/${category.slug}.name`,
      100
    );
    if (!Number.isInteger(category.order) || category.order < 0) {
      throw new Error(
        `exerciseCategories/${category.slug}.order must be a non-negative integer.`
      );
    }
    if (
      typeof category.icon !== 'string' ||
      category.icon.length === 0 ||
      category.icon.length > 100
    ) {
      throw new Error(
        `exerciseCategories/${category.slug}.icon must be a 1-100 character string.`
      );
    }
    if (typeof category.isRetired !== 'boolean') {
      throw new Error(
        `exerciseCategories/${category.slug}.isRetired must be a boolean.`
      );
    }
  }

  for (const item of equipment) {
    validateKeys(item, `equipment/${item.slug}`, [
      'slug',
      'name',
      'icon',
      'isRetired',
    ]);
    validateLocalizedText(item.name, `equipment/${item.slug}.name`, 100);
    if (
      item.icon !== null &&
      (typeof item.icon !== 'string' || item.icon.length > 100)
    ) {
      throw new Error(
        `equipment/${item.slug}.icon must be null or at most 100 characters.`
      );
    }
    if (typeof item.isRetired !== 'boolean') {
      throw new Error(`equipment/${item.slug}.isRetired must be a boolean.`);
    }
  }

  for (const exercise of exercises) {
    validateKeys(exercise, `exercises/${exercise.slug}`, [
      'slug',
      'name',
      'description',
      'type',
      'categoryRef',
      'equipment',
      'imageURL',
      'isRetired',
    ]);
    validateLocalizedText(
      exercise.name,
      `exercises/${exercise.slug}.name`,
      100
    );
    validateLocalizedText(
      exercise.description,
      `exercises/${exercise.slug}.description`,
      2000
    );

    const categorySlug = exercise.categoryRef.replace(/^global:/, '');
    if (
      exercise.categoryRef !== `global:${categorySlug}` ||
      !categorySlugs.has(categorySlug)
    ) {
      throw new Error(
        `exercises/${exercise.slug}.categoryRef does not resolve: ${exercise.categoryRef}`
      );
    }

    const seenEquipment = new Set<string>();
    for (const equipmentRef of exercise.equipment) {
      const equipmentSlug = equipmentRef.replace(/^global:/, '');
      if (
        equipmentRef !== `global:${equipmentSlug}` ||
        !equipmentSlugs.has(equipmentSlug)
      ) {
        throw new Error(
          `exercises/${exercise.slug}.equipment does not resolve: ${equipmentRef}`
        );
      }
      if (seenEquipment.has(equipmentRef)) {
        throw new Error(
          `exercises/${exercise.slug}.equipment contains duplicate ref: ${equipmentRef}`
        );
      }
      seenEquipment.add(equipmentRef);
    }
    if (!EXERCISE_TYPES.has(exercise.type)) {
      throw new Error(`exercises/${exercise.slug}.type is invalid.`);
    }
    if (exercise.equipment.length > 20) {
      throw new Error(
        `exercises/${exercise.slug}.equipment must contain at most 20 refs.`
      );
    }
    if (
      exercise.imageURL !== null &&
      (typeof exercise.imageURL !== 'string' || exercise.imageURL.length > 2048)
    ) {
      throw new Error(
        `exercises/${exercise.slug}.imageURL must be null or at most 2048 characters.`
      );
    }
    if (typeof exercise.isRetired !== 'boolean') {
      throw new Error(
        `exercises/${exercise.slug}.isRetired must be a boolean.`
      );
    }
  }
}

function withoutSlug<T extends { slug: string }>({ slug: _slug, ...data }: T) {
  return data;
}

export async function seedExercises(
  db: FirebaseFirestore.Firestore | null,
  opts: SeedOptions
): Promise<void> {
  // Validation always completes before a dry run returns or a clean/write starts.
  validateExerciseSeedData();

  console.log(`\nSeeding global exercise library`);
  console.log(`   Environment: ${opts.env}`);
  console.log(`   Categories: ${exerciseCategories.length}`);
  console.log(`   Equipment:  ${equipment.length}`);
  console.log(`   Exercises: ${exercises.length}`);
  console.log(`   Clean:     ${opts.clean ? 'yes' : 'no'}`);
  console.log(`   Mode:      ${opts.dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  if (opts.dryRun) {
    if (opts.clean) {
      console.log(
        'Would recursively delete: exerciseCategories, equipment, exercises\n'
      );
    }
    for (const [collection, items] of [
      ['exerciseCategories', exerciseCategories],
      ['equipment', equipment],
      ['exercises', exercises],
    ] as const) {
      console.log(`Would write ${collection}:`);
      for (const { slug } of items) console.log(`   ${collection}/${slug}`);
      console.log('');
    }
    return;
  }

  if (!db) throw new Error('Firestore was not initialized for a write run.');

  if (opts.clean) {
    console.log('Cleaning existing global datasets...');
    await deleteCollection(db, 'exerciseCategories');
    await deleteCollection(db, 'equipment');
    await deleteCollection(db, 'exercises');
    console.log('   Existing global datasets deleted.\n');
  }

  await chunkedBatch(
    db,
    exerciseCategories,
    (db, category) => db.collection('exerciseCategories').doc(category.slug),
    withoutSlug
  );
  await chunkedBatch(
    db,
    equipment,
    (db, item) => db.collection('equipment').doc(item.slug),
    withoutSlug
  );
  await chunkedBatch(
    db,
    exercises,
    (db, exercise) => db.collection('exercises').doc(exercise.slug),
    withoutSlug
  );
  console.log('Global datasets written.\n');
}
