import type { CalendarDayMetadata } from '@marceloterreiro/flash-calendar';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  buildCalendar,
  toDateId,
  useCalendar,
} from '@marceloterreiro/flash-calendar';

import { CALENDAR_BUILD_OPTIONS } from '../helpers/dates';
import { CalendarWeekRow } from './week-row';

const styles = StyleSheet.create({
  /**
   * No padding of its own, so the page is exactly
   * `weekCount * CALENDAR_WEEK_HEIGHT` tall — what the animation interpolates to.
   */
  page: {
    flexDirection: 'column',
  },
});

/**
 * Week grids, keyed by month **and by today**. Today is in the key because
 * `buildCalendar` bakes `isToday` into all 42 days: an app left open across
 * midnight would otherwise keep accenting yesterday. The key uses the library's
 * own `toDateId`, the same call `buildCalendar` makes for its `todayId`, so the
 * two can never disagree about the day boundary.
 */
const monthWeeksCache = new Map<string, CalendarDayMetadata[][]>();

const getMonthWeeks = (monthId: string): CalendarDayMetadata[][] => {
  const cacheKey = `${toDateId(new Date())}:${monthId.slice(0, 'YYYY-MM'.length)}`;
  const cached = monthWeeksCache.get(cacheKey);

  if (cached) return cached;

  const { weeksList } = buildCalendar({
    calendarMonthId: monthId,
    ...CALENDAR_BUILD_OPTIONS,
  });

  monthWeeksCache.set(cacheKey, weeksList);

  return weeksList;
};

/** Matches the one row of a month grid that draws `dateId`. */
const drawsDay =
  (dateId: string) =>
  (week: CalendarDayMetadata[]): boolean =>
    week.some((day) => day.id === dateId);

/**
 * Number of week rows a month renders. It lives beside the page rather than in
 * [dates.ts](../helpers/dates.ts) because the height the clip opens to is this
 * times `CALENDAR_WEEK_HEIGHT`, and the two must never disagree.
 */
export const getMonthWeekCount = (monthId: string): number =>
  getMonthWeeks(monthId).length;

/**
 * The seven days of the week starting at `weekStartDateId` (a Sunday), read out
 * of a month grid rather than built from seven `Date`s so a day in the collapsed
 * strip is the same value as that day in the expanded month — the equality the
 * open/close clip depends on. The Sunday's **own** month is always the right
 * grid, including for a straddling week.
 *
 * Verified against `@marceloterreiro/flash-calendar@2.0.0` by running
 * `buildCalendar` over every month from 2015 to 2035: all 1312 rows are exactly
 * 7 days and start on a Sunday, and each of the 1096 Sundays opens a row of its
 * own month's grid. Re-run it after a version bump. The `?? []` is a type
 * terminator for `find`, not a reachable case.
 */
export const getWeekDays = (
  weekStartDateId: string
): readonly CalendarDayMetadata[] =>
  getMonthWeeks(weekStartDateId).find(drawsDay(weekStartDateId)) ?? [];

/**
 * Index of the row that draws `weekStartDateId` inside **`monthStartDateId`'s**
 * grid, 0-based; `0` when that week is not one of the month's rows. The month
 * has to be passed in rather than derived: the week of 30 August 2026 is
 * August's last row and September's first, so the same week is index 5 or 0
 * depending on which month is displayed, and the clip translates by that many.
 */
export const getWeekIndexWithinMonth = (
  monthStartDateId: string,
  weekStartDateId: string
): number => {
  const weekIndex = getMonthWeeks(monthStartDateId).findIndex(
    drawsDay(weekStartDateId)
  );

  return weekIndex === -1 ? 0 : weekIndex;
};

/**
 * Whether `dateId` is drawn anywhere in `monthStartDateId`'s grid, including the
 * leading and trailing rows that belong to adjacent months — a user closing
 * August while looking at the week of 30 August should keep that row.
 */
export const isDrawnInMonth = (
  monthStartDateId: string,
  dateId: string
): boolean => getMonthWeeks(monthStartDateId).some(drawsDay(dateId));

export interface CalendarMonthPageProps {
  /** Any `YYYY-MM-DD` within the month. */
  monthId: string;
  /** Page width; the pager gives each page the viewport width. */
  width: number;
  /** Fired with the pressed day's local calendar ID. */
  onDayPress: (dateId: string) => void;
}

/**
 * One month as a stack of week rows, at the width of one pager page. It is as
 * tall as its own 4, 5 or 6 rows rather than padded to the tallest month: a
 * fixed six-row page would make the clip open to a height no month draws.
 */
export const CalendarMonthPage = ({
  monthId,
  width,
  onDayPress,
}: CalendarMonthPageProps) => {
  // `useCalendar` memoizes on its parameter object's identity, so building one
  // inline would rebuild all 42 days on every render of every page.
  const calendarParams = useMemo(
    () => ({ calendarMonthId: monthId, ...CALENDAR_BUILD_OPTIONS }),
    [monthId]
  );

  const { weeksList } = useCalendar(calendarParams);

  return (
    <View style={[styles.page, { width }]}>
      {weeksList.map((week, weekIndex) => (
        // The grid is fixed for a month and never reorders, so the row's
        // position is its identity.
        <CalendarWeekRow
          key={weekIndex}
          week={week}
          dimOutsideMonth
          onDayPress={onDayPress}
        />
      ))}
    </View>
  );
};
