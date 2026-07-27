import type { Timestamp } from '@/database';

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Turn a raw camelCase key into a human-readable label: `fullBody` →
 * `Full Body`, `core` → `Core`. Needed wherever a document falls back to its
 * own key for display — an exercise whose group has no user document yet
 * resolves `groupName` to the seed `groupKey` — so the UI never renders a raw
 * enum value. Values that are already spaced pass through with each word
 * capitalized, so a user-authored group name survives unchanged.
 */
export const humanizeKey = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ');

export const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '--';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
};

export const formatRelativeDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

export const formatShortDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatVolume = (volume: number | null): string => {
  if (!volume) return '--';
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k kg`;
  return `${volume} kg`;
};

export const getDifficultyValue = (difficulty: string): number => {
  switch (difficulty) {
    case 'beginner':
      return 33;
    case 'intermediate':
      return 66;
    case 'advanced':
      return 100;
    default:
      return 0;
  }
};
