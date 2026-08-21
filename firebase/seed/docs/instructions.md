# Hipefit DB Scripts

Admin-only Bun scripts for seeding global Firestore reference data and wiping disposable
environments. Neither command has a default environment.

## Prerequisites

Download a service account key for each environment you intend to target from
**Firebase Console > Project Settings > Service Accounts > Generate New Private Key**.

| Environment   | Expected filename                          |
| ------------- | ------------------------------------------ |
| `development` | `scripts/service-account.development.json` |
| `staging`     | `scripts/service-account.staging.json`     |
| `production`  | `scripts/service-account.json`             |

Service account files are gitignored. Never commit them.

Firebase deployments use the pinned workspace dependency and require an explicit non-production
project:

```bash
bun run firebase -- deploy --only firestore:rules --dry-run --project development
```

The wrapper permits only `deploy`. It accepts `development` and `staging`, resolves the name to a
fixed project ID, refuses alternate config files, and never relies on firebase-tools' persisted
active project. Commands with other targeting models, including app-scoped commands, are not exposed
through this wrapper.

## Destructive Runs

Before any migration, `--clean` seed, or wipe against an environment containing data worth
preserving, export Firestore and Auth data and verify that the export can be restored. This is
mandatory from the first real user onward. A clean seed recursively deletes only the three global
datasets; a wipe recursively deletes every Firestore document and then every Auth user.

`db:wipe` refuses production under all circumstances. A production seed requires an interactive
confirmation. A production clean additionally requires `--allow-production-clean`.

## Seed

The `exercises` seeder validates all slugs, localized fields, category references, and equipment
references before opening a destructive phase. It writes deterministic document IDs to
`exerciseCategories`, `equipment`, and `exercises`.

```bash
# Validate everything and report every planned delete/write without connecting to Firebase
bun run db:seed --seed exercises --env development --dry-run

# Idempotently overwrite deterministic documents
bun run db:seed --seed exercises --env development

# Recursively delete the three datasets, then recreate them
bun run db:seed --seed exercises --env staging --clean

# Production requires typing "production" at the prompt
bun run db:seed --seed exercises --env production

# Production clean requires both the flag and the typed confirmation
bun run db:seed --seed exercises --env production --clean --allow-production-clean
```

| Flag                       | Default      | Description                                                |
| -------------------------- | ------------ | ---------------------------------------------------------- |
| `--seed`                   | _(required)_ | Seeder name; currently only `exercises`                    |
| `--env`                    | _(required)_ | `development`, `staging`, or `production`                  |
| `--dry-run`                | `false`      | Fully validate and print planned changes without Firebase  |
| `--clean`                  | `false`      | Delete all three global datasets before writing            |
| `--allow-production-clean` | `false`      | Second explicit production-clean guard; confirmation stays |

## Migrate

The user-profile migration reads legacy documents as raw data, treats a missing `schemaVersion` as
version `0`, and validates each complete migrated profile. Writes replace the document in a
transaction so removed fields do not survive and concurrent profile changes cause a retry. The
runner examines every user and exits unsuccessfully after reporting any documents it could not
migrate.

```bash
bun run db:migrate --env development --dry-run
bun run db:migrate --env development
bun run db:migrate --env staging
bun run db:migrate --env production
```

Production writes require an interactive confirmation. A dry run does not write or prompt.
Unknown and duplicate flags are rejected before Firebase initialization.

## Wipe

The wipe requires an explicit non-production environment and an interactive confirmation that
exactly names it. It inventories Firestore and Auth, recursively deletes all top-level Firestore
collections (including every subcollection), deletes all Auth users, and verifies both counts are
zero. Without an interactive terminal, it exits unsuccessfully before connecting to Firebase.

```bash
bun run db:wipe --env development
bun run db:wipe --env staging
```

There is intentionally no dry-run wipe and no production override.

## Rules Limitation

Firestore rules enforce owner isolation, top-level document shape, enums, scalar bounds, string
limits, and list sizes. Rules cannot iterate `exercises[]`, `sets[]`, equipment refs, or hidden-ref
lists, so they cannot validate each nested map or string. Those contents require runtime validation at
the application boundary; a list-size rule must not be treated as item validation.

## Files

```text
firebase/seed/
|-- data/
|   |-- exercise-categories.ts
|   |-- equipment.ts
|   `-- exercises.ts
|-- docs/instructions.md
|-- index.ts
|-- seed-exercises.ts
|-- types.ts
|-- utils.ts
`-- wipe.ts
```
