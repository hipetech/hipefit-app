const KILOGRAMS_PER_POUND = 0.45359237;
const CENTIMETERS_PER_INCH = 2.54;

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
 * `Full Body`, `core` → `Core`. Values that are already spaced pass through
 * with each word capitalized.
 */
export const humanizeKey = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ');

export const kilogramsToPounds = (kilograms: number): number =>
  kilograms / KILOGRAMS_PER_POUND;

export const poundsToKilograms = (pounds: number): number =>
  pounds * KILOGRAMS_PER_POUND;

export const centimetersToInches = (centimeters: number): number =>
  centimeters / CENTIMETERS_PER_INCH;

export const inchesToCentimeters = (inches: number): number =>
  inches * CENTIMETERS_PER_INCH;

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
