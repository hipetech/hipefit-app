import type { CalendarDayMetadata } from '@marceloterreiro/flash-calendar';
import { StyleSheet, View } from 'react-native';

import {
  CALENDAR_HORIZONTAL_INSET,
  CALENDAR_WEEK_HEIGHT,
} from '../helpers/metrics';
import { CalendarDay } from './day';

const styles = StyleSheet.create({
  /**
   * Fixed height rather than left to the tallest cell: the row is the unit the
   * expand/collapse clip counts in. The inset is the row's, not the cell's,
   * which keeps the columns aligned with the weekday labels above.
   */
  row: {
    flexDirection: 'row',
    height: CALENDAR_WEEK_HEIGHT,
    paddingHorizontal: CALENDAR_HORIZONTAL_INSET,
  },
});

export interface CalendarWeekRowProps {
  /** Exactly 7 days, Sunday-first. */
  week: readonly CalendarDayMetadata[];
  /** False for the collapsed strip, true inside a month grid. */
  dimOutsideMonth: boolean;
  /** Fired with the pressed day's local calendar ID. */
  onDayPress: (dateId: string) => void;
}

/**
 * Seven day cells on one line — the collapsed calendar in full, and one row of
 * an expanded month. One component for both is what lets the open/close
 * animation be a clip over a single surface rather than a cross-fade: the
 * visible week is pixel-identical on either side. Dimming is the one difference
 * — see [day.tsx](./day.tsx)'s `isOutsideMonth`.
 */
export const CalendarWeekRow = ({
  week,
  dimOutsideMonth,
  onDayPress,
}: CalendarWeekRowProps) => (
  <View style={styles.row}>
    {week.map((day) => (
      <CalendarDay
        key={day.id}
        metadata={day}
        isOutsideMonth={dimOutsideMonth && day.isDifferentMonth}
        onPress={onDayPress}
      />
    ))}
  </View>
);
