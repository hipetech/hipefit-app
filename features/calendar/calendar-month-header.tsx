import { StyleSheet } from 'react-native';

import { Text } from '@/ui/text';

import { CALENDAR_HORIZONTAL_INSET } from './calendar-metrics';

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: CALENDAR_HORIZONTAL_INSET,
    paddingBottom: 8,
  },
});

export interface CalendarMonthHeaderProps {
  /** "August 2026", already formatted for the device locale. */
  monthLabel: string;
}

/**
 * The month title above the expanded grid. Collapsed, the calendar is a
 * seven-day strip with no title row, so the caller renders this only while the
 * month is open.
 *
 * **It deliberately sits outside the library's own header**, above the whole
 * calendar, rather than inside `renderHeader` with the weekday labels — even
 * though that is where it visually belongs. Wix hands `onHeaderLayout` to the
 * *first* header it renders and never again (`shouldMeasureHeader` in
 * `src/calendar-list/index.js`, 1.1314.0), so the header height it derives both
 * the collapsed and expanded heights from is measured once, while collapsed. A
 * title that appears inside that header on expansion adds its own height to the
 * content and to nothing else, and the library clips the last week row of every
 * month by exactly that much, permanently. Out here it changes this component's
 * height instead, which is plain React Native layout: the calendar and the list
 * below it move down, and nothing is clipped.
 */
export const CalendarMonthHeader = ({
  monthLabel,
}: CalendarMonthHeaderProps) => (
  <Text variant="headline" style={styles.title}>
    {monthLabel}
  </Text>
);
