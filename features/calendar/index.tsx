import type { ExpandableWeeklyCalendarProps } from './types';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

import { CalendarExpandToggle } from './components/expand-toggle';
import { CalendarMonthHeader } from './components/month-header';
import {
  getMonthWeekCount,
  getWeekIndexWithinMonth,
  isDrawnInMonth,
} from './components/month-page';
import { CalendarPager } from './components/pager';
import { CalendarWeekdayLabels } from './components/weekday-labels';
import {
  formatCalendarMonth,
  toMarkersByDateId,
  toMonthStartDateId,
  toWeekMonthStartDateId,
  toWeekStartDateId,
} from './helpers/dates';
import { CalendarDayContext } from './helpers/day-context';
import { CALENDAR_TEST_ID } from './helpers/metrics';
import { useCalendarExpansion } from './hooks/use-expansion';

/** The feature's public surface. Nothing outside imports past this barrel. */
export type {
  CalendarDateMarkers,
  CalendarMarker,
  CalendarMarkerTone,
  ExpandableWeeklyCalendarProps,
} from './types';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.systemGroupedBackground,
  },
});

/**
 * The expandable weekly calendar: a seven-day strip that pages by week, opens
 * into the month, and marks days with workout dots.
 *
 * `@marceloterreiro/flash-calendar` supplies date arithmetic only — its own
 * `Calendar`, `Calendar.Item.Day` and `CalendarTheme` are deliberately unused,
 * because it routes selection through a global `mitt` emitter that would be a
 * second source of truth against the controlled `selectedDateId`.
 *
 * A plain React Native island: it must not open a `Host` of its own. It is
 * mounted *through* one as a full-bleed row of Home's SwiftUI `List`, so the
 * animated height crosses the bridge as a size invalidation on every frame of
 * the spring — the first thing to re-check if the open/close starts to stutter.
 */
export const ExpandableWeeklyCalendar = ({
  selectedDateId,
  dateMarkers,
  onDatePress,
}: ExpandableWeeklyCalendarProps) => {
  // Two positions, not one. Deriving either from the other lost the week: a
  // single anchor was rewritten to the month's 1st on every month page, so
  // closing always landed on the first week instead of the one you came from.
  const [weekStartDateId, setWeekStartDateId] = useState(() =>
    toWeekStartDateId(selectedDateId)
  );
  const [monthStartDateId, setMonthStartDateId] = useState(() =>
    toMonthStartDateId(selectedDateId)
  );

  const expansion = useCalendarExpansion({
    // Against the *visible* month, not the week's own: a straddling week is one
    // month's last row and the next month's first, so the index differs.
    activeWeekIndex: getWeekIndexWithinMonth(monthStartDateId, weekStartDateId),
    weekCount: getMonthWeekCount(monthStartDateId),
  });

  // Paging weeks carries the month along; paging months must not touch the week.
  const handleWeekChange = useCallback((nextWeekStartDateId: string) => {
    setWeekStartDateId(nextWeekStartDateId);
    setMonthStartDateId(toWeekMonthStartDateId(nextWeekStartDateId));
  }, []);

  /**
   * Choosing a day moves the visible week; without it, closing returned to the
   * week you opened from rather than the one you tapped in.
   *
   * This belongs here and **not** in the closing logic: "prefer the selected
   * day's week when closing" would also override a week the user paged to
   * without selecting anything. Browsing and choosing are different acts.
   *
   * The month is left alone — moving it would flip the title from September to
   * August merely because the user tapped the 31st of a straddling week.
   */
  const handleDayPress = useCallback(
    (dateId: string) => {
      setWeekStartDateId(toWeekStartDateId(dateId));
      onDatePress(dateId);
    },
    [onDatePress]
  );

  /**
   * Closing lands on a week the month on screen actually draws — usually the one
   * already there, which is what "remembers the week" means. It only moves when
   * paging months left the remembered week outside the grid.
   *
   * **Only the week moves here.** Writing the month too replaced every day on
   * screen the instant the height began shrinking: closing October lands on a
   * mostly-September week, so the grid swapped to September and *then*
   * collapsed. Left alone there is nothing to swap — the landing week is by
   * definition a row of the month already displayed.
   */
  const handleToggle = useCallback(() => {
    if (expansion.isExpanded) {
      setWeekStartDateId(
        isDrawnInMonth(monthStartDateId, weekStartDateId)
          ? weekStartDateId
          : toWeekStartDateId(
              isDrawnInMonth(monthStartDateId, selectedDateId)
                ? selectedDateId
                : monthStartDateId
            )
      );
    } else {
      // Opening is the opposite case: the month has to be right *before* the
      // first frame, because it is the thing being revealed.
      setMonthStartDateId(toWeekMonthStartDateId(weekStartDateId));
    }

    expansion.toggle();
  }, [expansion, monthStartDateId, weekStartDateId, selectedDateId]);

  /**
   * Derived, not stored — which is what lets `monthStartDateId` stay put through
   * a collapse. Storing it swapped the grid mid-animation; reconciling it in an
   * effect is a cascading render the lint rule rejects. `isMonthMounted` flips
   * only once a collapse has settled, so the title changes at rest.
   */
  const monthLabel = formatCalendarMonth(
    expansion.isMonthMounted
      ? monthStartDateId
      : toWeekMonthStartDateId(weekStartDateId)
  );

  const dayData = useMemo(
    () => ({
      selectedDateId,
      markersByDateId: toMarkersByDateId(dateMarkers),
    }),
    [selectedDateId, dateMarkers]
  );

  return (
    <View style={styles.container} testID={CALENDAR_TEST_ID}>
      <CalendarMonthHeader monthLabel={monthLabel} />
      <CalendarWeekdayLabels />
      <CalendarDayContext value={dayData}>
        <CalendarPager
          expansion={expansion}
          weekStartDateId={weekStartDateId}
          monthStartDateId={monthStartDateId}
          onWeekChange={handleWeekChange}
          onMonthChange={setMonthStartDateId}
          onDayPress={handleDayPress}
        />
      </CalendarDayContext>
      {/*
        A button and not a drag: the calendar is a row of a scrolling SwiftUI
        `List`, and Gesture Handler cannot arbitrate a vertical pan with a
        `UIScrollView` across the bridge.
      */}
      <CalendarExpandToggle
        isExpanded={expansion.isExpanded}
        chevronStyle={expansion.chevronStyle}
        onToggle={handleToggle}
      />
    </View>
  );
};
