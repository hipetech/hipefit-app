import type { ExpandableWeeklyCalendarProps } from './calendar-types';
import type { DateData } from 'react-native-calendars/src/types';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CalendarProvider, ExpandableCalendar } from 'react-native-calendars';

import { colors } from '@/theme/colors';

import { CalendarDay } from './calendar-day';
import { CalendarDayContext } from './calendar-day-context';
import { formatCalendarMonth, toMarkersByDateId } from './calendar-helpers';
import { CalendarMonthHeader } from './calendar-month-header';
import { CALENDAR_TEST_ID, CALENDAR_THEME } from './calendar-theme';
import { CalendarWeekdayLabels } from './calendar-weekday-labels';
import { useScreenReaderEnabled } from './use-screen-reader-enabled';

/**
 * Every navigation gesture Wix would otherwise treat as a choice of day.
 *
 * The library's provider moves its own `selectedDate` with the visible anchor
 * unless the update source is listed here, so paging a week or a month would
 * select whatever day the new page lands on. Selection is the caller's, so all
 * of them are disabled. The day cells already ignore the library's selected
 * state ([calendar-day-context.ts](calendar-day-context.ts)); this is the same
 * rule stated at the other end.
 */
const NAVIGATION_WITHOUT_SELECTION = [
  ExpandableCalendar.navigationTypes.MONTH_SCROLL,
  ExpandableCalendar.navigationTypes.WEEK_SCROLL,
  ExpandableCalendar.navigationTypes.MONTH_ARROWS,
  ExpandableCalendar.navigationTypes.WEEK_ARROWS,
  ExpandableCalendar.navigationTypes.AGENDA_SCROLL,
  ExpandableCalendar.navigationTypes.TODAY_PRESS,
];

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.systemGroupedBackground,
  },
  /**
   * **`flex: 0` is load-bearing, and `flexGrow: 0` is not enough.**
   *
   * Wix's provider wrapper is `flex: 1` — it is written for a screen-filling
   * agenda. Here the calendar is a self-sized band above a `Host` that owns the
   * remaining space, so it has to size to its content, and Yoga resolves
   * `flex: 1` inside an auto-height parent to a **zero** flex basis: the whole
   * calendar collapses and renders nothing at all, silently. Adding
   * `flexGrow: 0` and `flexBasis: 'auto'` does not fix it — Yoga's basis
   * resolution reads `flexBasis: auto` as "not specified" and falls through to
   * `flex > 0 ? 0 : auto`, so the shorthand still wins. Only overriding `flex`
   * itself takes that branch away. Found by rendering the library's own
   * unmodified example into this screen and watching it disappear.
   */
  provider: {
    flex: 0,
  },
});

/**
 * The expandable weekly calendar: a seven-day strip that pages horizontally by
 * week, drags open into the month, and marks days with workout dots.
 *
 * Wix `react-native-calendars` is the interaction engine and **stops here**. It
 * already implements the vertical open/close pan, the collapsed week pager and
 * the expanded month pager; reproducing those over `@expo/ui` would need a
 * gesture layer the SwiftUI bridge does not expose (it vends no `DragGesture`).
 * What the library does not get to decide is anything the user reads or hears:
 * its day cells and headers render with `allowFontScaling={false}`, so every
 * visible piece is replaced rather than themed —
 * [calendar-day.tsx](calendar-day.tsx),
 * [calendar-month-header.tsx](calendar-month-header.tsx) — and the vendor's
 * styling is confined to [calendar-theme.ts](calendar-theme.ts).
 *
 * This is a plain React Native island. It must not be placed inside a `Host`,
 * and it must not open one: its height is animated by the library, and a
 * dynamically sized `RNHostView` inside a SwiftUI `List` row would make that
 * animation depend on cross-bridge size invalidation. It belongs beside the
 * screen's `Host`, as a sibling.
 *
 * Visible week/month and open/closed are transient presentation state and stay
 * local — no store. Selection is controlled by the caller and the two never mix:
 * `onDateChanged` fires for every page and press, and only ever moves the
 * anchor.
 */
export const ExpandableWeeklyCalendar = ({
  selectedDateId,
  dateMarkers,
  onDatePress,
}: ExpandableWeeklyCalendarProps) => {
  const [visibleDateId, setVisibleDateId] = useState(selectedDateId);
  const [isExpanded, setIsExpanded] = useState(false);
  const screenReaderEnabled = useScreenReaderEnabled();

  const dayData = useMemo(
    () => ({
      selectedDateId,
      markersByDateId: toMarkersByDateId(dateMarkers),
    }),
    [selectedDateId, dateMarkers]
  );

  const handleDayPress = useCallback(
    (date: DateData) => onDatePress(date.dateString),
    [onDatePress]
  );

  // Wix renders a permanently expanded month when a screen reader is running
  // and never reports a toggle in that path, so the title has to follow both.
  const showMonthLabel = isExpanded || screenReaderEnabled;

  return (
    <View style={styles.container}>
      {showMonthLabel ? (
        <CalendarMonthHeader monthLabel={formatCalendarMonth(visibleDateId)} />
      ) : null}
      <CalendarDayContext value={dayData}>
        <CalendarProvider
          date={visibleDateId}
          onDateChanged={setVisibleDateId}
          disableAutoDaySelection={NAVIGATION_WITHOUT_SELECTION}
          style={styles.provider}
        >
          <ExpandableCalendar
            testID={CALENDAR_TEST_ID}
            theme={CALENDAR_THEME}
            firstDay={0}
            allowShadow={false}
            hideArrows
            hideDayNames
            // No grabber. It is a redundant affordance — the whole calendar is
            // the drag target, and hiding it also takes its 24pt strip out of
            // both the collapsed and expanded heights, which is what closes the
            // gap between the last week row and the list below.
            hideKnob
            // A day press is a choice, not a dismissal: the month stays open so
            // the next choice does not cost another drag.
            closeOnDayPress={false}
            dayComponent={CalendarDay}
            renderHeader={() => <CalendarWeekdayLabels />}
            onCalendarToggled={setIsExpanded}
            onDayPress={handleDayPress}
          />
        </CalendarProvider>
      </CalendarDayContext>
    </View>
  );
};
