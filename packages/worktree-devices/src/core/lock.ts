import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { LockOwner } from '../types';

import { sleep } from '../lib/async';
import { errorMessage } from '../lib/command';
import { isRecord } from '../lib/guards';

// The registry lock is the directory at `lockPath`, held for a whole registry
// action. Every change to that directory (creating it, publishing its owner,
// reclaiming a stale one, releasing it, cleaning up a failed acquisition)
// happens while holding a second directory, the transition guard at
// `${lockPath}.guard`.
//
// The guard exists because checking a lock and then renaming its pathname are
// two operations. Without it a waiter could judge the old lock stale, be
// delayed, and then rename the lock its successor had just taken. Rereading the
// owner token before the rename leaves the same gap, and a claim taken only by
// reclaimers would leave owner publication and release outside the protocol.
//
// The guard is held only for those short transitions, never during the registry
// action, a retry sleep, a simulator command, or a prompt. It is never
// reclaimed automatically: reclaiming it would need the same stale check this
// module exists to make safe. A command killed inside a transition therefore
// leaves a guard that someone has to remove by hand.

const LOCK_TIMEOUT_MS = 15_000;
const LOCK_RETRY_MS = 100;
const MALFORMED_LOCK_STALE_MS = 60_000;
const OWNER_FILE = 'owner.json';
const GUARD_SUFFIX = '.guard';
const QUARANTINE_SUFFIX = '.stale';

interface DirectoryIdentity {
  device: bigint;
  inode: bigint;
}

type PathEntry =
  | { kind: 'absent' }
  | { kind: 'directory'; identity: DirectoryIdentity; modifiedAtMs: number }
  | { kind: 'other'; description: string };

type LockObservation =
  | { kind: 'absent' }
  | { kind: 'held'; holder: string }
  | {
      kind: 'reclaimable';
      identity: DirectoryIdentity;
      ownerSource: string | undefined;
    };

type AcquisitionAttempt =
  | { kind: 'acquired'; identity: DirectoryIdentity }
  | { kind: 'held'; holder: string }
  | { kind: 'changed' };

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

interface TransitionGuard {
  path: string;
  release: () => Promise<void>;
  isHeld: () => Promise<boolean>;
}

const errorCode = (error: unknown): unknown =>
  isRecord(error) ? error.code : undefined;

const settle = async <T>(work: () => Promise<T>): Promise<Settled<T>> => {
  try {
    return { ok: true, value: await work() };
  } catch (error: unknown) {
    return { ok: false, error };
  }
};

const sameIdentity = (
  left: DirectoryIdentity,
  right: DirectoryIdentity
): boolean => left.device === right.device && left.inode === right.inode;

const newOwner = (): LockOwner => ({
  pid: process.pid,
  hostname: hostname(),
  createdAt: new Date().toISOString(),
  token: randomUUID(),
});

const serializeOwner = (owner: LockOwner): string =>
  `${JSON.stringify(owner)}\n`;

// A pid that is not a positive safe integer is never a valid owner. Signalling
// 0 or a negative number addresses a process group or every process, so such a
// record is treated as malformed metadata and never reaches the probe.
const decodeLockOwner = (value: unknown): LockOwner | undefined => {
  if (
    !isRecord(value) ||
    typeof value.pid !== 'number' ||
    !Number.isSafeInteger(value.pid) ||
    value.pid <= 0 ||
    typeof value.hostname !== 'string' ||
    value.hostname.length === 0 ||
    typeof value.createdAt !== 'string' ||
    typeof value.token !== 'string' ||
    value.token.length === 0
  ) {
    return undefined;
  }
  return {
    pid: value.pid,
    hostname: value.hostname,
    createdAt: value.createdAt,
    token: value.token,
  };
};

const parseOwner = (source: string | undefined): LockOwner | undefined => {
  if (source === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(source);
    return decodeLockOwner(parsed);
  } catch {
    return undefined;
  }
};

const readOwnerSource = async (
  directory: string
): Promise<string | undefined> => {
  try {
    return await readFile(join(directory, OWNER_FILE), 'utf8');
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
};

// `lstat`, not `stat`: a symbolic link at a coordination path is reported as
// something other than a directory instead of being followed.
const inspectPath = async (path: string): Promise<PathEntry> => {
  try {
    const entry = await lstat(path, { bigint: true });
    if (entry.isSymbolicLink()) {
      return { kind: 'other', description: 'a symbolic link' };
    }
    if (!entry.isDirectory()) {
      return { kind: 'other', description: 'not a directory' };
    }
    return {
      kind: 'directory',
      identity: { device: entry.dev, inode: entry.ino },
      modifiedAtMs: Number(entry.mtimeMs),
    };
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return { kind: 'absent' };
    throw error;
  }
};

// Only ESRCH establishes that the owner is gone. EPERM means the process exists
// under another user. Anything else is unknown, so it fails without removing
// the lock.
const localOwnerIsAlive = (lockPath: string, pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    const code = errorCode(error);
    if (code === 'EPERM') return true;
    if (code === 'ESRCH') return false;
    throw new Error(
      `Cannot tell whether pid ${pid}, the owner of the simulator registry lock ${lockPath}, is still running: ${errorMessage(error)}\nNothing was removed.`
    );
  }
};

const describeOwner = (owner: LockOwner): string =>
  owner.hostname === hostname()
    ? `pid ${owner.pid} on this host, created ${owner.createdAt}`
    : `pid ${owner.pid} on host ${owner.hostname}, created ${owner.createdAt}`;

const describeOwnerAt = async (directory: string): Promise<string> => {
  const source = await settle(() => readOwnerSource(directory));
  if (!source.ok) return `unreadable (${errorMessage(source.error)})`;
  const owner = parseOwner(source.value);
  return owner ? describeOwner(owner) : 'missing or malformed metadata';
};

const describeLockAt = async (lockPath: string): Promise<string> => {
  const entry = await settle(() => inspectPath(lockPath));
  if (!entry.ok) return `unreadable (${errorMessage(entry.error)})`;
  if (entry.value.kind === 'absent') return 'absent';
  if (entry.value.kind === 'other') return entry.value.description;
  return `owner ${await describeOwnerAt(lockPath)}`;
};

const findQuarantinePaths = async (lockPath: string): Promise<string[]> => {
  const directory = dirname(lockPath);
  const prefix = `${basename(lockPath)}.`;
  const names = await settle(() => readdir(directory));
  if (!names.ok) return [];
  return names.value
    .filter(
      (name) => name.startsWith(prefix) && name.endsWith(QUARANTINE_SUFFIX)
    )
    .sort()
    .map((name) => join(directory, name));
};

const guardRecoveryGuidance = (guardPath: string): string =>
  `Other commands wait on ${guardPath} and never clear it automatically. Before removing it, account for every command that shares this registry, including commands on other hosts and in older worktrees, and confirm that its owner is not a stopped process that could resume. Its age alone does not show that it is abandoned. Leave the registry JSON file and the simulators as they are.`;

const guardTimeoutMessage = async (lockPath: string): Promise<string> => {
  const guardPath = `${lockPath}${GUARD_SUFFIX}`;
  const quarantinePaths = await findQuarantinePaths(lockPath);
  return [
    `Timed out after ${LOCK_TIMEOUT_MS / 1000} seconds waiting for the simulator registry transition guard at ${guardPath}.`,
    `Guard owner: ${await describeOwnerAt(guardPath)}.`,
    'A command holds the guard only while it takes, reclaims, or releases the registry lock, so a guard that stays this long usually belongs to a command that was killed partway through one of those steps.',
    guardRecoveryGuidance(guardPath),
    'Once they are confirmed abandoned, remove only these coordination paths and run the command again:',
    `  ${guardPath}`,
    ...quarantinePaths.map((path) => `  ${path}`),
    `The registry lock at ${lockPath} (${await describeLockAt(lockPath)}) needs no manual removal. With the guard gone, the next command reclaims it at once when its owner is a dead process on this host, or once it is ${MALFORMED_LOCK_STALE_MS / 1000} seconds old when its owner metadata is missing or malformed.`,
  ].join('\n');
};

const lockTimeoutMessage = (lockPath: string, holder: string): string =>
  [
    `Timed out after ${LOCK_TIMEOUT_MS / 1000} seconds waiting for the simulator registry lock at ${lockPath}.`,
    `${holder}.`,
    `A lock held by a running command or by another host is never cleared automatically. Wait for that command to finish, or remove ${lockPath} only after confirming that the command that owns it has exited. Leave the registry JSON file and the simulators as they are.`,
  ].join('\n');

const acquireGuard = async (
  lockPath: string,
  deadline: number
): Promise<TransitionGuard> => {
  const guardPath = `${lockPath}${GUARD_SUFFIX}`;
  while (true) {
    try {
      await mkdir(guardPath);
      break;
    } catch (error: unknown) {
      if (errorCode(error) !== 'EEXIST') throw error;
    }
    if (Date.now() >= deadline) {
      throw new Error(await guardTimeoutMessage(lockPath));
    }
    await sleep(LOCK_RETRY_MS);
  }

  // From here this process is the guard's creator, the only one allowed to
  // remove it.
  let identity: DirectoryIdentity;
  try {
    const entry = await inspectPath(guardPath);
    if (entry.kind !== 'directory') {
      throw new Error(`${guardPath} is not the directory that was created.`);
    }
    identity = entry.identity;
    await writeFile(join(guardPath, OWNER_FILE), serializeOwner(newOwner()), {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error: unknown) {
    const failure = `Cannot publish owner metadata in the transition guard ${guardPath}: ${errorMessage(error)}`;
    const cleanup = await settle(async () => {
      await rm(join(guardPath, OWNER_FILE), { force: true });
      await rmdir(guardPath);
    });
    if (cleanup.ok) throw new Error(failure);
    throw new Error(
      `${failure}\nRemoving the guard also failed: ${errorMessage(cleanup.error)}\nThe guard is retained at ${guardPath}. ${guardRecoveryGuidance(guardPath)}`
    );
  }

  const isHeld = async (): Promise<boolean> => {
    const entry = await settle(() => inspectPath(guardPath));
    return (
      entry.ok &&
      entry.value.kind === 'directory' &&
      sameIdentity(entry.value.identity, identity)
    );
  };
  const remove = async (): Promise<void> => {
    if (!(await isHeld())) {
      throw new Error(
        `The transition guard ${guardPath} is no longer the directory this command created, so it was left untouched.`
      );
    }
    await rm(join(guardPath, OWNER_FILE), { force: true });
    await rmdir(guardPath);
  };
  let released: Promise<void> | undefined;
  return {
    path: guardPath,
    isHeld,
    release: (): Promise<void> => {
      released ??= remove();
      return released;
    },
  };
};

// Renaming to a unique path before removal means the shared pathname is never
// passed to a recursive delete. The caller holds the guard and has just matched
// `identity` against the directory at `lockPath`; the moved directory is
// checked again so that a directory swapped in by a command that ignores the
// guard is retained instead of deleted. Returns false when the pathname was
// already gone.
const quarantineLock = async (
  lockPath: string,
  identity: DirectoryIdentity
): Promise<boolean> => {
  const quarantinePath = `${lockPath}.${process.pid}.${randomUUID()}${QUARANTINE_SUFFIX}`;
  try {
    await rename(lockPath, quarantinePath);
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return false;
    throw new Error(
      `Cannot move the simulator registry lock ${lockPath} aside to ${quarantinePath}: ${errorMessage(error)}\nNothing was removed, and ${lockPath} is retained.`
    );
  }
  const moved = await settle(() => inspectPath(quarantinePath));
  if (
    !moved.ok ||
    moved.value.kind !== 'directory' ||
    !sameIdentity(moved.value.identity, identity)
  ) {
    throw new Error(
      `Moved ${lockPath} aside, but the result could not be confirmed as the directory this command inspected, so it was not removed. It is retained at ${quarantinePath}.`
    );
  }
  try {
    await rm(quarantinePath, { recursive: true, force: true });
  } catch (error: unknown) {
    throw new Error(
      `Moved the simulator registry lock ${lockPath} aside but cannot remove it: ${errorMessage(error)}\nIt is retained at ${quarantinePath}. That directory is no longer the lock and can be deleted.`
    );
  }
  return true;
};

// Must run under the guard. Nothing observed before the guard was taken is
// used: the pathname is read afresh every time.
const observeLock = async (lockPath: string): Promise<LockObservation> => {
  const entry = await inspectPath(lockPath);
  if (entry.kind === 'absent') return { kind: 'absent' };
  if (entry.kind === 'other') {
    throw new Error(
      `Refusing to use the simulator registry lock path ${lockPath}: it is ${entry.description}. Nothing was removed.`
    );
  }
  const ownerSource = await readOwnerSource(lockPath);
  const owner = parseOwner(ownerSource);
  if (owner && owner.hostname !== hostname()) {
    // Another host's pid means nothing here, so the claim is never probed and
    // never expires.
    return { kind: 'held', holder: `It is held by ${describeOwner(owner)}` };
  }
  if (owner) {
    // The age of a valid owner is not a lease: a live owner keeps the lock
    // however old its timestamps are.
    return localOwnerIsAlive(lockPath, owner.pid)
      ? { kind: 'held', holder: `It is held by ${describeOwner(owner)}` }
      : { kind: 'reclaimable', identity: entry.identity, ownerSource };
  }
  // Missing or malformed metadata is what a foreign or older writer looks like
  // between creating the directory and publishing its owner, so it is protected
  // until the directory itself is old.
  if (Date.now() - entry.modifiedAtMs > MALFORMED_LOCK_STALE_MS) {
    return { kind: 'reclaimable', identity: entry.identity, ownerSource };
  }
  return {
    kind: 'held',
    holder: `Its owner metadata is missing or malformed, and it is less than ${MALFORMED_LOCK_STALE_MS / 1000} seconds old`,
  };
};

// Must run under the guard. Returns false when the directory is no longer the
// one observed, in which case the caller observes again instead of acting on
// the earlier verdict.
const reclaimLock = async (
  lockPath: string,
  identity: DirectoryIdentity,
  ownerSource: string | undefined
): Promise<boolean> => {
  const entry = await inspectPath(lockPath);
  if (entry.kind !== 'directory' || !sameIdentity(entry.identity, identity)) {
    return false;
  }
  if ((await readOwnerSource(lockPath)) !== ownerSource) return false;
  return quarantineLock(lockPath, identity);
};

// Must run under the guard. Removes only the directory this acquisition
// created. `identity` is undefined when the directory could not be inspected
// after `mkdir`; it is then still empty, and `rmdir` removes nothing else.
const removeCreatedLock = async (
  lockPath: string,
  identity: DirectoryIdentity | undefined
): Promise<void> => {
  if (!identity) {
    await rmdir(lockPath);
    return;
  }
  const entry = await inspectPath(lockPath);
  if (entry.kind === 'absent') return;
  if (entry.kind !== 'directory' || !sameIdentity(entry.identity, identity)) {
    throw new Error(
      `${lockPath} is no longer the directory this command created, so it was left untouched.`
    );
  }
  await quarantineLock(lockPath, identity);
};

// Must run under the guard, which stays held through owner publication so no
// cooperating command sees a lock directory without its owner.
const createLock = async (
  lockPath: string,
  owner: LockOwner
): Promise<AcquisitionAttempt> => {
  try {
    await mkdir(lockPath);
  } catch (error: unknown) {
    if (errorCode(error) === 'EEXIST') return { kind: 'changed' };
    throw error;
  }
  let identity: DirectoryIdentity | undefined;
  try {
    const entry = await inspectPath(lockPath);
    if (entry.kind !== 'directory') {
      throw new Error(`${lockPath} is not the directory that was created.`);
    }
    identity = entry.identity;
    await writeFile(join(lockPath, OWNER_FILE), serializeOwner(owner), {
      encoding: 'utf8',
      flag: 'wx',
    });
    return { kind: 'acquired', identity };
  } catch (error: unknown) {
    const failure = `Cannot publish owner metadata for the simulator registry lock ${lockPath}: ${errorMessage(error)}`;
    const cleanup = await settle(() => removeCreatedLock(lockPath, identity));
    if (cleanup.ok) throw new Error(failure);
    throw new Error(
      `${failure}\nRemoving the lock directory this command created also failed: ${errorMessage(cleanup.error)}`
    );
  }
};

const attemptAcquisition = async (
  lockPath: string,
  owner: LockOwner
): Promise<AcquisitionAttempt> => {
  const observation = await observeLock(lockPath);
  if (observation.kind === 'held') return observation;
  if (
    observation.kind === 'reclaimable' &&
    !(await reclaimLock(
      lockPath,
      observation.identity,
      observation.ownerSource
    ))
  ) {
    return { kind: 'changed' };
  }
  return createLock(lockPath, owner);
};

// Must run under the guard. A missing lock, a different directory, or a
// different token is a successor's lock or nobody's, and is left alone.
const removeOwnedLock = async (
  lockPath: string,
  identity: DirectoryIdentity,
  token: string
): Promise<void> => {
  const entry = await inspectPath(lockPath);
  if (entry.kind !== 'directory' || !sameIdentity(entry.identity, identity)) {
    return;
  }
  const ownerSource = await settle(() => readOwnerSource(lockPath));
  const owner = ownerSource.ok ? parseOwner(ownerSource.value) : undefined;
  if (!owner) {
    const detail = ownerSource.ok
      ? 'its owner metadata is missing or malformed'
      : `its owner metadata cannot be read (${errorMessage(ownerSource.error)})`;
    throw new Error(
      `The simulator registry lock ${lockPath} is the directory this command created, but ${detail}, so it was not removed. It is retained at ${lockPath}.`
    );
  }
  if (owner.token !== token) return;
  await quarantineLock(lockPath, identity);
};

const withGuardReleased = async <T>(
  guard: TransitionGuard,
  work: () => Promise<T>
): Promise<T> => {
  const outcome = await settle(work);
  const released = await settle(() => guard.release());
  if (released.ok) {
    if (outcome.ok) return outcome.value;
    throw outcome.error;
  }
  const guardFailure = `Releasing the transition guard ${guard.path} failed: ${errorMessage(released.error)}\nThe guard may be retained. ${guardRecoveryGuidance(guard.path)}`;
  if (outcome.ok) throw new Error(guardFailure);
  throw new Error(`${errorMessage(outcome.error)}\n${guardFailure}`);
};

const releaseLock = async (
  lockPath: string,
  identity: DirectoryIdentity,
  token: string
): Promise<void> => {
  // Release waits on the guard with its own deadline, separate from the one
  // acquisition used.
  const guard = await settle(() =>
    acquireGuard(lockPath, Date.now() + LOCK_TIMEOUT_MS)
  );
  if (!guard.ok) {
    throw new Error(
      `${errorMessage(guard.error)}\nThe registry lock this command holds at ${lockPath} was not released.`
    );
  }
  await withGuardReleased(guard.value, () =>
    removeOwnedLock(lockPath, identity, token)
  );
};

// The acquisition is unusable once the guard cannot be released, so the lock
// just taken is given back when the guard is still verifiably held and reported
// as retained when it is not.
const abandonAcquisition = async (
  lockPath: string,
  guard: TransitionGuard,
  identity: DirectoryIdentity,
  guardError: unknown
): Promise<never> => {
  const failure = `Cannot finish taking the simulator registry lock ${lockPath}: releasing the transition guard ${guard.path} failed: ${errorMessage(guardError)}`;
  const guidance = `The guard may be retained. ${guardRecoveryGuidance(guard.path)}`;
  if (!(await guard.isHeld())) {
    throw new Error(
      `${failure}\nThe lock this command had just taken is retained at ${lockPath}, because the guard is no longer held and the lock cannot be removed safely without it.\n${guidance}`
    );
  }
  const cleanup = await settle(() => removeCreatedLock(lockPath, identity));
  if (cleanup.ok) {
    throw new Error(
      `${failure}\nThe lock this command had just taken was removed again.\n${guidance}`
    );
  }
  throw new Error(
    `${failure}\nRemoving the lock this command had just taken also failed: ${errorMessage(cleanup.error)}\n${guidance}`
  );
};

export const acquireLock = async (
  lockPath: string
): Promise<() => Promise<void>> => {
  // One deadline covers guard waits and every retry, whatever is contended.
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  const owner = newOwner();

  while (true) {
    const guard = await acquireGuard(lockPath, deadline);
    const attempt = await settle(() => attemptAcquisition(lockPath, owner));
    const released = await settle(() => guard.release());
    if (!released.ok) {
      if (attempt.ok && attempt.value.kind === 'acquired') {
        return abandonAcquisition(
          lockPath,
          guard,
          attempt.value.identity,
          released.error
        );
      }
      const guardFailure = `Releasing the transition guard ${guard.path} failed: ${errorMessage(released.error)}\nThe guard may be retained. ${guardRecoveryGuidance(guard.path)}`;
      throw new Error(
        attempt.ok
          ? guardFailure
          : `${errorMessage(attempt.error)}\n${guardFailure}`
      );
    }
    if (!attempt.ok) throw attempt.error;
    const result = attempt.value;
    if (result.kind === 'acquired') {
      const { identity } = result;
      // Memoized so that repeated and concurrent calls share one release and a
      // late call cannot reach a successor's lock.
      let releasing: Promise<void> | undefined;
      return (): Promise<void> => {
        releasing ??= releaseLock(lockPath, identity, owner.token);
        return releasing;
      };
    }
    if (Date.now() >= deadline) {
      throw new Error(
        lockTimeoutMessage(
          lockPath,
          result.kind === 'held'
            ? result.holder
            : 'It kept being replaced while this command tried to take it'
        )
      );
    }
    await sleep(LOCK_RETRY_MS);
  }
};

export const withRegistryLock = async <T>(
  lockPath: string,
  action: () => Promise<T>
): Promise<T> => {
  const release = await acquireLock(lockPath);
  const outcome = await settle(action);
  const released = await settle(release);
  if (outcome.ok) {
    // The result is returned only when the lock was released.
    if (!released.ok) throw released.error;
    return outcome.value;
  }
  if (released.ok) throw outcome.error;
  // The CLI prints `.message` only, so both failures go into it, action first.
  throw new Error(
    `${errorMessage(outcome.error)}\nReleasing the simulator registry lock also failed: ${errorMessage(released.error)}`,
    { cause: outcome.error }
  );
};
