/**
 * Hipefit DB CLI
 *
 * Usage:
 *   bun run db:seed --seed exercises
 *   bun run db:seed --seed exercises --dry-run
 *   bun run db:seed --seed exercises --clean --env staging
 *
 * See scripts/db/docs/instructions.md for full documentation.
 */

import type { SeedOptions } from './types';

import { seedExercises } from './seed-exercises';
import { initFirebase } from './utils';

// ─── Seeders registry ────────────────────────────────────────────────────────

type Seeder = (
  db: FirebaseFirestore.Firestore,
  opts: SeedOptions
) => Promise<void>;

const SEEDERS: Record<string, Seeder> = {
  exercises: seedExercises,
};

// ─── CLI arg parsing ─────────────────────────────────────────────────────────

function parseArgs(): { seed: string; opts: SeedOptions } {
  const args = process.argv.slice(2);

  const seedIndex = args.indexOf('--seed');
  if (seedIndex === -1 || !args[seedIndex + 1]) {
    console.error('❌ Missing required flag: --seed <name>');
    console.error(`   Available seeders: ${Object.keys(SEEDERS).join(', ')}`);
    process.exit(1);
  }

  // Safe: guarded by the `!args[seedIndex + 1]` check above
  const seed = args[seedIndex + 1]!;

  const envIndex = args.indexOf('--env');
  const rawEnv = envIndex !== -1 ? args[envIndex + 1] : 'production';
  const validEnvs: SeedOptions['env'][] = [
    'development',
    'staging',
    'production',
  ];
  if (!validEnvs.includes(rawEnv as SeedOptions['env'])) {
    console.error(
      `❌ Invalid --env value: "${rawEnv}". Must be one of: ${validEnvs.join(', ')}`
    );
    process.exit(1);
  }

  return {
    seed,
    opts: {
      dryRun: args.includes('--dry-run'),
      clean: args.includes('--clean'),
      env: rawEnv as SeedOptions['env'],
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { seed, opts } = parseArgs();

  const seeder = SEEDERS[seed];
  if (!seeder) {
    console.error(
      `❌ Unknown seeder: "${seed}". Available: ${Object.keys(SEEDERS).join(', ')}`
    );
    process.exit(1);
  }

  if (opts.dryRun) {
    await seeder(null as unknown as FirebaseFirestore.Firestore, opts);
    console.log('🎉 Dry run complete!\n');
    process.exit(0);
  }

  const db = initFirebase(opts.env);
  await seeder(db, opts);
  console.log('🎉 Done!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
