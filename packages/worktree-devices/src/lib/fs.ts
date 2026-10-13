import { constants as fsConstants } from 'node:fs';
import { access, realpath } from 'node:fs/promises';

export const pathIsAccessible = async (
  path: string,
  mode: number = fsConstants.F_OK
): Promise<boolean> => {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
};

export const canonicalPath = async (path: string): Promise<string> =>
  realpath(path);
