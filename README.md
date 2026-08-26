# Hipefit

Hipefit is an iOS-only fitness app in a Bun workspace. The mobile app uses React Native, Expo SDK
57 in the bare workflow, Expo Router, `@expo/ui`, Zustand, Firebase Auth, and Firestore.

## Workspace layout

| Path           | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `apps/mobile/` | Expo app, application source, assets, and native iOS project |
| `packages/`    | Shared schemas, Firebase bindings, UI, and native modules    |
| `firebase/`    | Firebase configuration, rules, seed data, and migrations     |
| `scripts/`     | Repository CLI wrappers and CI helpers                       |
| `docs/`        | Current architecture, product flows, plans, and templates    |
| `e2e/`         | Reserved empty scaffold for future end-to-end tests          |

The root `package.json` owns workspace scripts. Run commands from the repository root unless a
document says otherwise.

## Setup

```bash
bun install
```

## Run iOS

Each command copies the matching root environment file into the mobile app and launches the
corresponding Xcode scheme:

```bash
bun run ios:development
bun run ios:staging
bun run ios:production
```

Start Metro without launching a simulator, or open the native project directly:

```bash
bun run start
bun run open:xcode
```

The committed project under `apps/mobile/ios/` is authoritative for native configuration. After
adding or removing a native dependency, update CocoaPods from that directory:

```bash
cd apps/mobile/ios
pod install
```

## Checks

```bash
bun run type-check
bun run lint
bun run format:check
```

The repository has no automated test runner. Pull requests run these three checks in CI.

## Firebase tooling

Firebase assets live under `firebase/`. Root scripts keep environment selection explicit:

```bash
bun run db:seed --seed exercises --env development
bun run db:migrate --env development --dry-run
bun run db:wipe --env development
bun run firebase -- deploy --only firestore:rules --dry-run --project development
```

The Firebase deployment wrapper accepts only `development` and `staging`. It resolves that
environment to a fixed project ID, refuses production, and does not expose other Firebase CLI
commands.

Read [`docs/README.md`](docs/README.md) for the documentation index and feature workflow.
