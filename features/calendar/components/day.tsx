import type { CalendarDayMetadata } from '@marceloterreiro/flash-calendar';
import { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from '@/ui/text';

import { describeCalendarDay } from '../helpers/dates';
import { CalendarDayContext } from '../helpers/day-context';
import {
  CALENDAR_DAY_NUMBER_MAX_SCALE,
  CALENDAR_DAY_SIZE,
  CALENDAR_WEEK_HEIGHT,
} from '../helpers/metrics';
import { CalendarMarkerDots } from './marker-dots';

const NO_MARKERS: readonly never[] = [];

const styles = StyleSheet.create({
  /** The row carries the horizontal inset, so seven of these divide what is left. */
  cell: {
    flex: 1,
    height: CALENDAR_WEEK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Number and dots both sit inside the circle, as Apple's Calendar draws them —
   * also the only arrangement that fits `CALENDAR_WEEK_HEIGHT`.
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
  /** The day this cell draws, as `useCalendar` built it. */
  metadata: CalendarDayMetadata;
  /**
   * Dim the number because the day belongs to a different month than its page.
   * A prop rather than `metadata.isDifferentMonth`, which the cell could read
   * itself: a week strip has no month, so a straddling week would dim five of
   * its seven days while the header names the other month.
   */
  isOutsideMonth: boolean;
  /** Fired with this day's local calendar ID. */
  onPress: (dateId: string) => void;
}

/**
 * One day of the calendar, as a single 44pt button and one VoiceOver element.
 *
 * Drawn here rather than through `Calendar.Item.Day`, which themes from the
 * library's own hex palette with no Dynamic Type ramp and reads its selected
 * state from a global `mitt` emitter — a second source of truth against the
 * controlled `selectedDateId`. Selection and markers arrive from
 * [day-context.ts](../helpers/day-context.ts) instead.
 */
export const CalendarDay = ({
  metadata,
  isOutsideMonth,
  onPress,
}: CalendarDayProps) => {
  const { selectedDateId, markersByDateId } = useContext(CalendarDayContext);

  const markers = markersByDateId.get(metadata.id) ?? NO_MARKERS;
  const isSelected = metadata.id === selectedDateId;

  return (
    <Pressable
      style={styles.cell}
      onPress={() => onPress(metadata.id)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={describeCalendarDay(metadata.id, markers.length)}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.circle, isSelected && styles.selectedCircle]}>
        <Text
          variant="title3"
          maxFontSizeMultiplier={CALENDAR_DAY_NUMBER_MAX_SCALE}
          style={[
            styles.number,
            isOutsideMonth && styles.outsideMonth,
            metadata.isToday && styles.today,
            isSelected && styles.selectedNumber,
          ]}
        >
          {metadata.displayLabel}
        </Text>
        <CalendarMarkerDots markers={markers} isSelected={isSelected} />
      </View>
    </Pressable>
  );
};
