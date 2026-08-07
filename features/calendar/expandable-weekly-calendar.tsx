import type { ExpandableWeeklyCalendarProps } from './calendar-types';
import type { ComponentRef } from 'react';
import type { DateData } from 'react-native-calendars/src/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CalendarProvider, ExpandableCalendar } from 'react-native-calendars';

import { colors } from '@/theme/colors';

import { CalendarDay } from './calendar-day';
import { CalendarDayContext } from './calendar-day-context';
import { CalendarExpandToggle } from './calendar-expand-toggle';
import { formatCalendarMonth, toMarkersByDateId } from './calendar-helpers';
import { CalendarMonthHeader } from './calendar-month-header';
import { CALENDAR_TEST_ID, CALENDAR_THEME } from './calendar-theme';
import { CalendarWeekdayLabels } from './calendar-weekday-labels';

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
 * supplies the animated open/close, the collapsed week pager and the expanded
 * month pager; reproducing those over `@expo/ui` would need a gesture layer the
 * SwiftUI bridge does not expose (it vends no `DragGesture`). Its *vertical pan*
 * is switched off (`disablePan`) and the month title opens the grid instead —
 * see the prop for why. What the library does not get to decide is anything the
 * user reads or hears:
 * its day cells and headers render with `allowFontScaling={false}`, so every
 * visible piece is replaced rather than themed —
 * [calendar-day.tsx](calendar-day.tsx),
 * [calendar-month-header.tsx](calendar-month-header.tsx) — and the vendor's
 * styling is confined to [calendar-theme.ts](calendar-theme.ts).
 *
 * This is a plain React Native island and must not open a `Host` of its own.
 * It is mounted *through* one, as a full-bleed row of the screen's SwiftUI
 * `List` via `RNHostView matchContents` — which is what lets it scroll with the
 * rest of the page instead of floating above it, and what lets the navigation
 * bar's large title collapse normally. The animated height does therefore cross
 * the bridge as a size invalidation on every frame of the spring; measured on
 * an iPhone 17 Pro that is smooth, but it is the first thing to re-check if the
 * open/close ever starts to stutter.
 *
 * Visible week/month and open/closed are transient presentation state and stay
 * local — no store, and open/closed is not a prop: the library owns the
 * position and only reports it when its spring lands. Selection is controlled
 * by the caller and the two never mix: `onDateChanged` fires for every page and
 * press, and only ever moves the anchor.
 */
export const ExpandableWeeklyCalendar = ({
  selectedDateId,
  dateMarkers,
  onDatePress,
}: ExpandableWeeklyCalendarProps) => {
  const [visibleDateId, setVisibleDateId] = useState(selectedDateId);
  const [isExpanded, setIsExpanded] = useState(false);
  const calendarRef = useRef<ComponentRef<typeof ExpandableCalendar>>(null);

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

  const handleToggle = useCallback(() => {
    const nextExpanded = !isExpanded;
    // Flipped here rather than waiting for `onCalendarToggled`: the library
    // reports the new position from the *completion* callback of its spring, so
    // a chevron driven by that alone would sit unturned for the whole animation
    // and read as a dropped tap. The callback below reconciles, which also
    // covers the screen-reader path where the month never actually moves.
    setIsExpanded(nextExpanded);

    calendarRef.current?.toggleCalendarPosition();
  }, [isExpanded]);

  return (
    <View style={styles.container}>
      {/*
        Always mounted, open or closed. Mounting it on expansion instead read as
        a glitch — Wix reports the toggle from the completion callback of its own
        spring, so the title arrived a beat late and shoved the strip, the grid
        and the whole list below it down in a single frame. Permanently up, it
        also answers a question the collapsed strip could not: bare day numbers
        with no month.
      */}
      <CalendarMonthHeader monthLabel={formatCalendarMonth(visibleDateId)} />
      <CalendarDayContext value={dayData}>
        <CalendarProvider
          date={visibleDateId}
          onDateChanged={setVisibleDateId}
          disableAutoDaySelection={NAVIGATION_WITHOUT_SELECTION}
          style={styles.provider}
        >
          <ExpandableCalendar
            ref={calendarRef}
            testID={CALENDAR_TEST_ID}
            theme={CALENDAR_THEME}
            firstDay={0}
            allowShadow={false}
            hideArrows
            hideDayNames
            // No grabber. With the pan disabled it would advertise a gesture
            // that no longer exists, and hiding it also takes its 24pt strip
            // out of both the collapsed and expanded heights, which is what
            // closes the gap between the last week row and the list below.
            hideKnob
            // Opening is the title's job, not a gesture's. The library's own
            // vertical pan is the reason the month used to fight the list it
            // sits in — the calendar is a row of a scrolling `List`, and a
            // PanResponder that claims every vertical drag over it makes that
            // part of the screen unscrollable. Off, the drag belongs to the
            // list and the month belongs to the button.
            disablePan
            // A day press is a choice, not a dismissal: the month stays open so
            // the next choice does not cost another tap.
            closeOnDayPress={false}
            dayComponent={CalendarDay}
            renderHeader={() => <CalendarWeekdayLabels />}
            onCalendarToggled={setIsExpanded}
            onDayPress={handleDayPress}
          />
        </CalendarProvider>
      </CalendarDayContext>
      {/*
        Below the grid, not beside the title: this is where the library's own
        drag grabber sat, so it is where the affordance is already expected, and
        centred under the last week row it belongs to the calendar rather than
        decorating the month label. It is outside the provider on purpose — Wix
        measures its header exactly once and derives both the collapsed and
        expanded heights from that, so anything added inside would be clipped
        out of every month.
      */}
      <CalendarExpandToggle isExpanded={isExpanded} onToggle={handleToggle} />
    </View>
  );
};
