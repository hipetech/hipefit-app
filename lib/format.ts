import type { Timestamp } from '@/database';

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
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

/**
 * A **local** calendar day ID, `YYYY-MM-DD` — the day as the device reckons it.
 *
 * Never `toISOString().slice(0, 10)`: that converts to UTC first, so any device
 * behind UTC reports tomorrow's date after its local evening, and any device
 * ahead of it reports yesterday's before local morning. The calendar keys every
 * day off this string, so an off-by-one here selects the wrong cell.
 */
export const toLocalDateId = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * The inverse of `toLocalDateId`, read back in local time.
 *
 * Never `new Date(dateId)`: a bare `YYYY-MM-DD` is specified to parse as UTC,
 * which undoes exactly what `toLocalDateId` was written to avoid.
 */
const fromLocalDateId = (dateId: string): Date => {
  const [year, month, day] = dateId.split('-');

  return new Date(Number(year), Number(month) - 1, Number(day));
};

/** The month a day ID falls in, spelled out for the locale: `2026-08-17` → "August". */
export const formatMonthName = (dateId: string): string =>
  fromLocalDateId(dateId).toLocaleDateString(undefined, { month: 'long' });

/** The day of the month, in the locale's own digits: `2026-08-17` → "17". */
export const formatDayOfMonth = (dateId: string): string =>
  fromLocalDateId(dateId).toLocaleDateString(undefined, { day: 'numeric' });
