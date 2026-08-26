import type { CalendarDateMarkers, CalendarMarker } from '../types';
import type { UseCalendarParams } from '@marceloterreiro/flash-calendar';
import { fromDateId, toDateId } from '@marceloterreiro/flash-calendar';

import { toLocalDateId } from '@/lib/format';

/**
 * IDs are parsed with the library's `fromDateId` because it is local midnight:
 * `new Date('2026-08-07')` parses that string as **UTC** midnight and shifts the
 * day for most of the world. Verified against
 * `@marceloterreiro/flash-calendar@2.0.0` (`dateId.split('-').map(Number)` fed
 * to the numeric `Date` constructor); re-check after a version bump.
 */

/**
 * Everything `buildCalendar` and `useCalendar` need except the month itself, so
 * every surface builds a month identically. Spread it beside a
 * `calendarMonthId`. The two formatters override library defaults:
 *
 * - **Weekday names**: the default is `{ weekday: 'narrow' }` — `S M T W T F S`,
 *   with three letters repeating — and this calendar shows `Sun` … `Sat`.
 * - **Day numbers**: the default renders the locale's own numerals, but the cell
 *   is sized for two Latin digits and `tabular-nums` is a Latin-digit feature.
 *
 * Both pass `undefined` so the platform resolves the **device** locale.
 * `calendarFormatLocale` is left unset because it defaults to `en-US` and would
 * print English weekday names on a non-English device.
 */
export const CALENDAR_BUILD_OPTIONS: Omit<
  UseCalendarParams,
  'calendarMonthId'
> = {
  calendarFirstDayOfWeek: 'sunday',
  getCalendarWeekDayFormat: (date) =>
    date.toLocaleDateString(undefined, { weekday: 'short' }),
  getCalendarDayFormat: (date) => String(date.getDate()),
};

/** Whether a local calendar ID names today, as the device reckons it. */
export const isTodayDateId = (dateId: string): boolean =>
  dateId === toLocalDateId(new Date());

/**
 * The contract's list form indexed for lookup. The day cell reads its own entry,
 * so an array scan per cell would be 42 scans per month page.
 */
export const toMarkersByDateId = (
  dateMarkers: readonly CalendarDateMarkers[]
): ReadonlyMap<string, readonly CalendarMarker[]> =>
  new Map(dateMarkers.map(({ dateId, markers }) => [dateId, markers]));

/** "August 2026" for the expanded month's title, in the device locale. */
export const formatCalendarMonth = (dateId: string): string =>
  fromDateId(dateId).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

/**
 * What VoiceOver reads for one day, including the **untruncated** workout count:
 * the cell draws at most `CALENDAR_MAX_VISIBLE_MARKERS` dots, and this is where
 * the real number survives. Selection is left to `accessibilityState.selected`.
 */
export const describeCalendarDay = (
  dateId: string,
  markerCount: number
): string => {
  const date = fromDateId(dateId).toLocaleDateString(undefined, {
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

/**
 * The calendar tracks **two** positions, not one. With a single anchor ID,
 * paging a month rewrote it to that month's 1st and collapsing always landed on
 * the first week — the "does not remember the week" defect.
 */

/** The Sunday that opens the week containing `dateId`. A week's identity. */
export const toWeekStartDateId = (dateId: string): string => {
  const date = fromDateId(dateId);
  date.setDate(date.getDate() - date.getDay());

  return toDateId(date);
};

/** The first of the month containing `dateId`. A month's identity. */
export const toMonthStartDateId = (dateId: string): string => {
  const date = fromDateId(dateId);

  return toDateId(new Date(date.getFullYear(), date.getMonth(), 1));
};

/**
 * Which month a week *belongs* to, when it straddles two — titling the week of
 * 30 August 2026 "August" disagrees with five of the seven days on screen.
 *
 * The rule is the majority, and for a Sunday-first week that is always the month
 * containing the **fourth day**: the days are consecutive, so whichever month
 * holds midweek holds at least four of seven.
 */
export const toWeekMonthStartDateId = (weekStartDateId: string): string => {
  const midweek = fromDateId(weekStartDateId);
  midweek.setDate(midweek.getDate() + 3);

  return toMonthStartDateId(toDateId(midweek));
};

/** The Sunday `delta` weeks from `weekStartDateId`. */
export const shiftWeekStartDateId = (
  weekStartDateId: string,
  delta: number
): string => {
  const date = fromDateId(weekStartDateId);
  date.setDate(date.getDate() + delta * 7);

  return toDateId(date);
};

/**
 * The first of the month `delta` months from `monthStartDateId`. Safe on lengths
 * because the day of month is always 1 — `setMonth` on a 31st would skid into
 * the following month.
 */
export const shiftMonthStartDateId = (
  monthStartDateId: string,
  delta: number
): string => {
  const date = fromDateId(monthStartDateId);

  return toDateId(new Date(date.getFullYear(), date.getMonth() + delta, 1));
};
