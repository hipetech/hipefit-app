import type { DateData, DayState } from 'react-native-calendars/src/types';
import { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from '@/ui/text';

import { CalendarDayContext } from './calendar-day-context';
import { describeCalendarDay, isTodayDateId } from './calendar-helpers';
import { CalendarMarkerDots } from './calendar-marker-dots';
import {
  CALENDAR_DAY_NUMBER_MAX_SCALE,
  CALENDAR_DAY_SIZE,
  CALENDAR_WEEK_HEIGHT,
} from './calendar-metrics';

const NO_MARKERS: readonly never[] = [];

const styles = StyleSheet.create({
  /** The tappable column: full column width by Wix's `flex: 1` day container. */
  cell: {
    height: CALENDAR_WEEK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The selection circle, and the cell's 44pt target. Number and dots both sit
   * inside it — Apple's Calendar draws the event dot within the selected
   * circle rather than below it, which is also the only arrangement that fits
   * `CALENDAR_WEEK_HEIGHT`.
   */
  circle: {
    width: CALENDAR_DAY_SIZE,
    height: CALENDAR_DAY_SIZE,
    borderRadius: CALENDAR_DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCircle: {
    backgroundColor: colors.accent,
  },
  /** Tabular digits: the column must not twitch as 9 becomes 10. */
  number: {
    fontVariant: ['tabular-nums'],
  },
  today: {
    color: colors.accent,
  },
  selectedNumber: {
    color: colors.onAccentSolid,
  },
  outsideMonth: {
    color: colors.tertiaryLabel,
  },
});

export interface CalendarDayProps {
  /**
   * The day this cell draws. Optional because that is how Wix types it; it is
   * always supplied in practice, and the cell renders nothing without it.
   */
  date?: DateData;
  /**
   * Wix's computed state. Only `'disabled'` is read, and with no `minDate`,
   * `maxDate`, `disabledByDefault` or `disabledByWeekDays` set it can mean
   * exactly one thing: the day belongs to a different month than its page.
   * `'selected'` and `'today'` are deliberately ignored — see
   * [calendar-day-context.ts](calendar-day-context.ts).
   */
  state?: DayState;
  /**
   * Wix's press handler. Used rather than calling the feature's `onDatePress`
   * directly, so pressing a trailing day of the expanded month also pages the
   * grid to that month the way the library expects.
   */
  onPress?: (date?: DateData) => void;
  /** Wix's per-cell test ID; also the week-strip discriminator below. */
  testID?: string;
}

/**
 * Whether this cell belongs to the expanded month grid rather than the collapsed
 * week strip.
 *
 * The distinction matters because "outside this month" is worth dimming in a
 * month grid and is nonsense in a seven-day strip: `getState` compares each day
 * against the *page's* anchor, and a week strip's anchor is its first day, so
 * every week that straddles a month boundary would dim the days on the far side
 * of it — often five of the seven, while the header names the other month.
 *
 * Both trees are mounted at once (the strip is absolutely positioned over the
 * grid), so nothing about expansion state can tell them apart. The one signal
 * Wix hands the cell is its test ID, which it derives from the root ID as
 * `<root>.weekCalendar.day_<date>` for the strip and
 * `<root>.calendarList.item_<month>.day_<date>` for the grid
 * (`src/expandableCalendar/index.js` and `src/calendar-list/index.js`, 1.1314.0).
 * The screen-reader path renders a full month under `.calendarAccessible.`, which
 * correctly falls on the grid side of this test.
 */
const isMonthGridDay = (testID: string | undefined): boolean =>
  !testID?.includes('.weekCalendar.');

/**
 * One day of the calendar: the number, its selection circle and its workout
 * dots, as a single 44pt button and a single VoiceOver element.
 *
 * Replaces Wix's `BasicDay` outright rather than theming it, because that
 * component renders its number with `allowFontScaling={false}` and so opts the
 * calendar out of Dynamic Type.
 */
export const CalendarDay = ({
  date,
  state,
  onPress,
  testID,
}: CalendarDayProps) => {
  const { selectedDateId, markersByDateId } = useContext(CalendarDayContext);

  if (!date) return null;

  const markers = markersByDateId.get(date.dateString) ?? NO_MARKERS;
  const isSelected = date.dateString === selectedDateId;
  const isOutsideMonth = state === 'disabled' && isMonthGridDay(testID);

  return (
    <Pressable
      style={styles.cell}
      onPress={() => onPress?.(date)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={describeCalendarDay(date.dateString, markers.length)}
      accessibilityState={{ selected: isSelected }}
      testID={testID}
    >
      <View style={[styles.circle, isSelected && styles.selectedCircle]}>
        <Text
          variant="title3"
          maxFontSizeMultiplier={CALENDAR_DAY_NUMBER_MAX_SCALE}
          style={[
            styles.number,
            isOutsideMonth && styles.outsideMonth,
            isTodayDateId(date.dateString) && styles.today,
            isSelected && styles.selectedNumber,
          ]}
        >
          {String(date.day)}
        </Text>
        <CalendarMarkerDots markers={markers} isSelected={isSelected} />
      </View>
    </Pressable>
  );
};
