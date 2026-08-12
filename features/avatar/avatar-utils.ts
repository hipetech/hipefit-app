import type { ColorValue } from 'react-native';

import { AVATAR_BACKGROUNDS } from './avatar-backgrounds';

export interface AvatarGradient {
  colors: [ColorValue, ColorValue];
  foregroundColor: ColorValue;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

const DEFAULT_AVATAR_GRADIENT: AvatarGradient = {
  ...AVATAR_BACKGROUNDS[0],
  startPoint: { x: 0.5, y: 0 },
  endPoint: { x: 0.5, y: 1 },
};

const AVATAR_GRADIENTS: AvatarGradient[] = AVATAR_BACKGROUNDS.map(
  (background) => ({
    ...background,
    startPoint: { x: 0.5, y: 0 },
    endPoint: { x: 0.5, y: 1 },
  })
);

/** Selects a stable gradient for an identity without persisting presentation data. */
export const getAvatarGradient = (seed: string): AvatarGradient => {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (
    AVATAR_GRADIENTS[(hash >>> 0) % AVATAR_GRADIENTS.length] ??
    DEFAULT_AVATAR_GRADIENT
  );
};

export const getAvatarInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first =
    Array.from((parts[0] ?? '').normalize('NFC').toUpperCase())[0] ?? '';
  const last =
    parts.length > 1
      ? (Array.from((parts.at(-1) ?? '').normalize('NFC').toUpperCase())[0] ??
        '')
      : '';

  return `${first}${last}`;
};
