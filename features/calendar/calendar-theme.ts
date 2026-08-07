import type { Theme } from 'react-native-calendars/src/types';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';

import { CALENDAR_HORIZONTAL_INSET } from './calendar-metrics';

/**
 * Every Wix `react-native-calendars@1.1314.0` style override, in one place.
 *
 * Call sites do not know these keys exist — that is the point of the module.
 * The library takes styling through three *different* shapes, and which one a
 * given stylesheet reads is not guessable, so it is recorded here:
 *
 * - flat, dotted keys (`'stylesheet.calendar.main'`) for the calendar body,
 *   header and month list, read as `theme['stylesheet.calendar.main']`;
 * - a nested `stylesheet.expandable.main` for the expandable shell;
 * - plain scalar theme values (`calendarBackground`, `weekVerticalMargin`).
 *
 * The dotted keys are absent from the library's exported `Theme` interface,
 * which is why the object is assembled with `Object.assign` rather than written
 * as one annotated literal: TypeScript's excess-property check rejects unknown
 * keys on a fresh literal, and the assign result is not a fresh literal. No
 * cast, no `any`.
 *
 * An override **replaces** its entry rather than merging into it, so each one
 * below restates the layout properties it still needs (`flexDirection`,
 * `justifyContent`). Dropping them silently un-rows the calendar.
 *
 * The stylesheets are built once per mount (`useRef(styleConstructor(theme))`
 * throughout the library), so this object must stay module-scope and stable.
 * That is safe for colour: the `Color.ios.*` tokens are semantic UIKit colours
 * resolved at draw time, so light/dark still follows the live trait even though
 * the stylesheet itself is never rebuilt.
 */

/** Seven equal columns at the app's list inset. Shared by strip and grid. */
const weekRowStyle = {
  flexDirection: 'row',
  justifyContent: 'space-around',
  paddingLeft: CALENDAR_HORIZONTAL_INSET,
  paddingRight: CALENDAR_HORIZONTAL_INSET,
} as const;

const overrides = StyleSheet.create({
  /**
   * The calendar body of one month page. Wix's 5pt padding plus the month
   * list's own 15pt is where its default 20pt inset comes from; both are
   * flattened into this single value so the grid matches the week strip.
   */
  calendarContainer: {
    paddingLeft: CALENDAR_HORIZONTAL_INSET,
    paddingRight: CALENDAR_HORIZONTAL_INSET,
  },
  /**
   * One week of the expanded month. `marginVertical` comes from
   * `weekVerticalMargin` below and is zeroed there; the row's whole height is
   * the day cell, because `CALENDAR_WEEK_HEIGHT` is not negotiable.
   */
  monthWeek: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  /** The month page wrapper inside the horizontal pager. */
  monthPage: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  /**
   * The header pinned above the horizontal month pager. It must be **opaque**:
   * `calendarBackground` is transparent so the screen's grouped background can
   * show through the calendar, and without a colour here the month pages would
   * scroll visibly underneath their own pinned header.
   */
  staticHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: CALENDAR_HORIZONTAL_INSET,
    backgroundColor: colors.systemGroupedBackground,
  },
  /**
   * The header's title row. Wix centres a month label between two arrows; the
   * arrows are hidden (`hideArrows`) and the whole slot is handed to
   * `CalendarMonthHeader` through `renderHeader`, so this only has to stop
   * fighting it — no 10pt padding, no 6pt top margin, and a title container
   * that actually fills the row.
   */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  /**
   * The collapsed week strip. Also opaque, and for a sharper reason: it is
   * absolutely positioned *over* the first week row of the month page behind
   * it, and cross-fades against it while the calendar opens. Transparent here
   * renders both rows at once.
   */
  weekStripContainer: {
    backgroundColor: colors.systemGroupedBackground,
  },
  weekStripRow: {
    ...weekRowStyle,
    marginTop: 0,
    marginBottom: 0,
  },
});

export const CALENDAR_THEME: Theme = Object.assign(
  {
    /**
     * Transparent, so the screen's own `systemGroupedBackground` is the only
     * surface. Wix paints this colour into six separate views; the two that
     * genuinely need to be opaque re-state it above.
     */
    calendarBackground: 'transparent',
    /**
     * 7pt by default, top and bottom, on every week of the month. That is 14pt
     * a row the day cell cannot have — see `CALENDAR_WEEK_HEIGHT`.
     */
    weekVerticalMargin: 0,
    stylesheet: {
      expandable: {
        main: {
          container: overrides.weekStripContainer,
          week: overrides.weekStripRow,
        },
      },
    },
  },
  {
    'stylesheet.calendar.main': {
      container: overrides.calendarContainer,
      week: overrides.monthWeek,
    },
    'stylesheet.calendar.header': {
      header: overrides.headerRow,
      headerContainer: overrides.headerTitleContainer,
    },
    'stylesheet.calendar-list.main': {
      calendar: overrides.monthPage,
      staticHeader: overrides.staticHeader,
    },
  }
);

/**
 * Root test ID. Wix derives every inner ID from it, and one of those derivations
 * is load-bearing rather than decorative — see `isMonthGridDay` in
 * `calendar-day.tsx`.
 */
export const CALENDAR_TEST_ID = 'weekly-calendar';
