import type { CalendarDateMarkers, CalendarMarker } from './calendar-types';

import { toLocalDateId } from '@/lib/format';

/** Sunday of a known week, used to enumerate weekday names in the device locale. */
const REFERENCE_SUNDAY = new Date(2023, 0, 1);

const DAYS_IN_WEEK = 7;

/**
 * A local calendar ID back to the `Date` it names, at local midnight.
 *
 * `new Date('2026-08-07')` would parse the same string as **UTC** midnight and
 * shift the day for most of the world; the numeric constructor is local by
 * definition. The destructuring defaults exist because `noUncheckedIndexedAccess`
 * types every `split` element as possibly undefined, not because a malformed ID
 * is expected.
 */
export const parseDateId = (dateId: string): Date => {
  const [year = '1970', month = '01', day = '01'] = dateId.split('-');

  return new Date(Number(year), Number(month) - 1, Number(day));
};

/** Whether a local calendar ID names today, as the device reckons it. */
export const isTodayDateId = (dateId: string): boolean =>
  dateId === toLocalDateId(new Date());

/**
 * The contract's list form indexed for lookup. The day cell renders once per
 * visible date and reads its own entry, so an array scan per cell would be 42
 * scans per month page.
 */
export const toMarkersByDateId = (
  dateMarkers: readonly CalendarDateMarkers[]
): ReadonlyMap<string, readonly CalendarMarker[]> =>
  new Map(dateMarkers.map(({ dateId, markers }) => [dateId, markers]));

/** "August 2026" for the expanded month's title, in the device locale. */
export const formatCalendarMonth = (dateId: string): string =>
  parseDateId(dateId).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

/**
 * `Sun` … `Sat` in the device locale, always Sunday-first to match the
 * calendar's `firstDay={0}`.
 *
 * Deliberately not Wix's `weekDayNames`: that reads the library's own
 * `LocaleConfig`, which the app never configures, so it would render English
 * names on a non-English device while every other string in the app localises.
 */
export const getWeekdayLabels = (): string[] =>
  Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const day = new Date(REFERENCE_SUNDAY);
    day.setDate(REFERENCE_SUNDAY.getDate() + index);

    return day.toLocaleDateString(undefined, { weekday: 'short' });
  });

/**
 * What VoiceOver reads for one day: the full local date, whether it is today,
 * and the **untruncated** workout count — the cell draws at most
 * `CALENDAR_MAX_VISIBLE_MARKERS` dots, and this is where the real number
 * survives.
 *
 * Selection is not in the label: it is `accessibilityState.selected`, so
 * VoiceOver announces it in the user's own words and does not repeat it.
 */
export const describeCalendarDay = (
  dateId: string,
  markerCount: number
): string => {
  const date = parseDateId(dateId).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const workouts =
    markerCount === 0
      ? 'no workouts'
      : markerCount === 1
        ? '1 workout'
        : `${markerCount} workouts`;

  return isTodayDateId(dateId)
    ? `${date}, today, ${workouts}`
    : `${date}, ${workouts}`;
};
