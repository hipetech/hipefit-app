import { StyleSheet, View } from 'react-native';
import { buildCalendar, toDateId } from '@marceloterreiro/flash-calendar';

import { Text } from '@/components/text';
import { colors } from '@/theme/colors';

import { CALENDAR_BUILD_OPTIONS } from '../helpers/dates';
import { CALENDAR_HORIZONTAL_INSET } from '../helpers/metrics';

/**
 * Read once at module scope: the labels depend only on the device locale, and
 * any month yields the same seven names. Sharing `CALENDAR_BUILD_OPTIONS` keeps
 * this row and the grid below it agreeing on which day the week starts with.
 */
const WEEKDAY_LABELS = buildCalendar({
  calendarMonthId: toDateId(new Date()),
  ...CALENDAR_BUILD_OPTIONS,
}).weekDaysList;

const styles = StyleSheet.create({
  /**
   * The same inset the week rows carry, so a label sits over its own column; any
   * extra padding here would shear the two apart by half of it.
   */
  row: {
    flexDirection: 'row',
    paddingHorizontal: CALENDAR_HORIZONTAL_INSET,
    paddingBottom: 4,
  },
  /** `flex: 1` per column, matching the day cells, so the two grids line up. */
  label: {
    flex: 1,
    textAlign: 'center',
    color: colors.secondaryLabel,
  },
});

/**
 * The `Sun` … `Sat` row above the calendar.
 *
 * Plain RN text rather than the library's `Calendar.Item.WeekName`, so the
 * labels scale on the `footnote` Dynamic Type ramp, and outside the clipped
 * surface, where a row would be cut as the month closes. Hidden from VoiceOver:
 * each day cell already announces its own weekday.
 */
export const CalendarWeekdayLabels = () => (
  <View style={styles.row} accessibilityElementsHidden>
    {WEEKDAY_LABELS.map((label, index) => (
      // Position, not the label: the seven are fixed and never reorder, and a
      // locale whose short names are not all distinct would collide on text.
      <Text key={index} variant="footnote" style={styles.label}>
        {label}
      </Text>
    ))}
  </View>
);
