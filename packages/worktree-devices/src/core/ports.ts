import { connect, createServer } from 'node:net';
import type { WorktreeDevicesConfig } from '../config';
import type { RegistryState } from '../types';

const canBind = async (port: number, host: string): Promise<boolean> =>
  new Promise<boolean>((resolveBind, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolveBind(false);
        return;
      }
      if (error.code === 'EAFNOSUPPORT') {
        resolveBind(true);
        return;
      }
      reject(error);
    });
    server.listen({ port, host, exclusive: true }, () => {
      server.close((error) => {
        if (error) reject(error);
        else resolveBind(true);
      });
    });
  });

// Metro binds to loopback, and a loopback listener does not stop a wildcard
// bind, so every host has to be tested separately.
const PORT_PROBE_HOSTS = ['::', '0.0.0.0', '127.0.0.1', '::1'] as const;

export const portIsAvailable = async (port: number): Promise<boolean> => {
  for (const host of PORT_PROBE_HOSTS) {
    if (!(await canBind(port, host))) return false;
  }
  return true;
};

export const allocatePort = async (
  state: RegistryState,
  config: WorktreeDevicesConfig
): Promise<number> => {
  const reserved = new Set(state.assignments.map(({ port }) => port));
  const { start, end } = config.ports;
  for (let port = start; port <= end; port += 1) {
    if (config.reservedPorts.includes(port) || reserved.has(port)) continue;
    if (await portIsAvailable(port)) return port;
  }
  throw new Error(
    `No available Metro port remains in ${start}-${end}. Detach unused worktrees or stop the process using that range.`
  );
};

const connectionSucceeds = async (
  port: number,
  host: string
): Promise<boolean> =>
  new Promise<boolean>((resolveConnection) => {
    const socket = connect({ port, host });
    let settled = false;
    const settle = (result: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveConnection(result);
    };
    socket.setTimeout(250);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });

export const portAcceptsConnections = async (port: number): Promise<boolean> =>
  (await connectionSucceeds(port, '127.0.0.1')) ||
  (await connectionSucceeds(port, '::1'));
