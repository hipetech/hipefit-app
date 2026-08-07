import type { ColorValue } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

import {
  CALENDAR_MARKER_DOT_GAP,
  CALENDAR_MARKER_DOT_SIZE,
  CALENDAR_MAX_VISIBLE_MARKERS,
} from './calendar-metrics';
import { type CalendarMarker, type CalendarMarkerTone } from './calendar-types';

/**
 * Tones map to the system status colours, the same mapping
 * [ui/chip.tsx](../../ui/chip.tsx) uses for status labels. `accent` is the one
 * place the app names a colour value for an RN view rather than letting a native
 * control pick up the system accent — there is no SwiftUI here to inherit it.
 */
const toneColor: Record<CalendarMarkerTone, ColorValue> = {
  accent: colors.accent,
  success: colors.systemGreen,
  warning: colors.systemOrange,
};

const styles = StyleSheet.create({
  /**
   * Fixed height whether or not the day has markers, so the day number sits at
   * the same offset in every cell and the grid does not jitter as markers
   * arrive.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: CALENDAR_MARKER_DOT_SIZE,
    marginTop: 2,
    gap: CALENDAR_MARKER_DOT_GAP,
  },
  dot: {
    width: CALENDAR_MARKER_DOT_SIZE,
    height: CALENDAR_MARKER_DOT_SIZE,
    borderRadius: CALENDAR_MARKER_DOT_SIZE / 2,
  },
  /**
   * The overflow treatment: the last position stretches into a lozenge rather
   * than adding a fourth dot. Widening one dot keeps the cell's width — and so
   * the column grid — untouched, which a fourth dot would not.
   */
  overflow: {
    width: CALENDAR_MARKER_DOT_SIZE * 2,
  },
});

export interface CalendarMarkerDotsProps {
  /** Every marker on the day. The full count still reaches VoiceOver. */
  markers: readonly CalendarMarker[];
  /**
   * Whether the day is the selected one. Selected days draw the accent circle
   * behind these dots, where a status colour would be illegible, so they invert
   * to solid on-accent content instead.
   */
  isSelected: boolean;
}

/**
 * The workout dots under a day number, capped at
 * `CALENDAR_MAX_VISIBLE_MARKERS` positions.
 *
 * Decorative: the whole cell is one accessibility element and announces the
 * count itself, so nothing here is a focus stop.
 */
export const CalendarMarkerDots = ({
  markers,
  isSelected,
}: CalendarMarkerDotsProps) => {
  const isOverflowing = markers.length > CALENDAR_MAX_VISIBLE_MARKERS;
  const visible = markers.slice(
    0,
    isOverflowing
      ? CALENDAR_MAX_VISIBLE_MARKERS - 1
      : CALENDAR_MAX_VISIBLE_MARKERS
  );

  return (
    <View style={styles.row} accessibilityElementsHidden>
      {visible.map((marker) => (
        <View
          key={marker.id}
          style={[
            styles.dot,
            {
              backgroundColor: isSelected
                ? colors.onAccentSolid
                : toneColor[marker.tone],
            },
          ]}
        />
      ))}
      {isOverflowing ? (
        <View
          style={[
            styles.dot,
            styles.overflow,
            {
              backgroundColor: isSelected
                ? colors.onAccentSolid
                : colors.secondaryLabel,
            },
          ]}
        />
      ) : null}
    </View>
  );
};
