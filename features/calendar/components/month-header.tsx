import { StyleSheet } from 'react-native';

import { Text } from '@/ui/text';

import { CALENDAR_HORIZONTAL_INSET } from '../helpers/metrics';

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: CALENDAR_HORIZONTAL_INSET,
    paddingTop: 8,
    paddingBottom: 8,
  },
});

export interface CalendarMonthHeaderProps {
  /** "August 2026", already formatted for the device locale. */
  monthLabel: string;
}

/**
 * The month title above the calendar, following the *visible* week or month
 * rather than the selected day.
 *
 * It sits outside the clipped surface deliberately: it is the calendar's title
 * rather than a page's, and the clip's geometry stays a whole number of
 * `CALENDAR_WEEK_HEIGHT` rows. Anything non-row inside the clip is cut off as
 * the month closes or has to be added to every height the animation computes.
 */
export const CalendarMonthHeader = ({
  monthLabel,
}: CalendarMonthHeaderProps) => (
  <Text variant="headline" style={styles.title}>
    {monthLabel}
  </Text>
);
