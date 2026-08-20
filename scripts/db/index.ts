/**
 * Hipefit DB CLI
 *
 * Usage:
 *   bun run db:seed --seed exercises --env development
 *   bun run db:seed --seed exercises --env development --dry-run
 *   bun run db:seed --seed exercises --clean --env staging
 *
 * See scripts/db/docs/instructions.md for full documentation.
 */

import { createInterface } from 'node:readline/promises';
import type { Environment, SeedOptions } from './types';

import { seedExercises } from './seed-exercises';
import { initFirebase } from './utils';

// ─── Seeders registry ────────────────────────────────────────────────────────

type Seeder = (
  db: FirebaseFirestore.Firestore | null,
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
  if (envIndex === -1 || !args[envIndex + 1]) {
    console.error('Missing required flag: --env <environment>');
    process.exit(1);
  }

  const rawEnv = args[envIndex + 1];
  const validEnvs: Environment[] = ['development', 'staging', 'production'];
  if (!validEnvs.includes(rawEnv as SeedOptions['env'])) {
    console.error(
      `Invalid --env value: "${rawEnv}". Must be one of: ${validEnvs.join(', ')}`
    );
    process.exit(1);
  }

  return {
    seed,
    opts: {
      dryRun: args.includes('--dry-run'),
      clean: args.includes('--clean'),
      env: rawEnv as Environment,
      allowProductionClean: args.includes('--allow-production-clean'),
    },
  };
}

async function confirmProduction(opts: SeedOptions): Promise<void> {
  if (opts.env !== 'production' || opts.dryRun) return;

  if (opts.clean && !opts.allowProductionClean) {
    throw new Error(
      'Production clean requires the second explicit flag --allow-production-clean.'
    );
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(
    'Production seed requested. Type "production" to continue: '
  );
  prompt.close();

  if (answer !== 'production') {
    throw new Error('Production confirmation did not match; no changes made.');
  }
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

  await confirmProduction(opts);

  const db = opts.dryRun ? null : initFirebase(opts.env).db;
  await seeder(db, opts);
  console.log(opts.dryRun ? 'Dry run complete.\n' : 'Done.\n');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
