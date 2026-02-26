# Hipefit DB Scripts

Scripts for seeding and manipulating Firestore data. All commands use the `bun run db:seed` shorthand defined in `package.json`.

## Prerequisites

Download a service account key for each environment you want to target:

1. Go to **Firebase Console → Project Settings → Service Accounts → Generate New Private Key**
2. Save the file in `scripts/` using the filename matching the environment:

| Environment   | Expected filename                          |
| ------------- | ------------------------------------------ |
| `production`  | `scripts/service-account.json`             |
| `staging`     | `scripts/service-account.staging.json`     |
| `development` | `scripts/service-account.development.json` |

> All service account files are gitignored. Never commit them.

## Usage

```bash
# Basic seed (targets production by default)
bun run db:seed --seed exercises

# Dry run — prints what would be written, no Firebase connection needed
bun run db:seed --seed exercises --dry-run

# Target a specific environment
bun run db:seed --seed exercises --env staging
bun run db:seed --seed exercises --env development

# Delete existing data before seeding
bun run db:seed --seed exercises --clean

# Combine flags
bun run db:seed --seed exercises --clean --env staging
```

## Flags

| Flag        | Default      | Description                                                |
| ----------- | ------------ | ---------------------------------------------------------- |
| `--seed`    | _(required)_ | Name of the seeder to run (see available below)            |
| `--env`     | `production` | Target environment: `development`, `staging`, `production` |
| `--dry-run` | `false`      | Print what would be written without connecting to Firebase |
| `--clean`   | `false`      | Delete existing collection data before seeding             |

## Available Seeders

| Name        | Collections written           | Source files                                   |
| ----------- | ----------------------------- | ---------------------------------------------- |
| `exercises` | `exerciseGroups`, `exercises` | `data/exercise-groups.ts`, `data/exercises.ts` |

## Adding a New Seeder

1. Add dataset files in `data/` (e.g. `data/routines.ts`)
2. Create `seed-routines.ts` exporting `async function seedRoutines(db, opts)`
3. Register it in `index.ts` under `SEEDERS`:
   ```ts
   const SEEDERS = {
     exercises: seedExercises,
     routines: seedRoutines, // add here
   };
   ```

## File Structure

```
scripts/db/
├── data/
│   ├── exercise-groups.ts   # ExerciseGroup dataset
│   └── exercises.ts         # Exercise dataset
├── docs/
│   └── instructions.md      # This file
├── types.ts                 # Shared interfaces (ExerciseSeed, SeedOptions, …)
├── utils.ts                 # initFirebase(), deleteCollection(), chunkedBatch()
├── seed-exercises.ts        # exercises seeder function
└── index.ts                 # CLI entry point
```
