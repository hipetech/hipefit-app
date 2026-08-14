import type { ColorValue } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

import {
  CALENDAR_MARKER_DOT_GAP,
  CALENDAR_MARKER_DOT_SIZE,
  CALENDAR_MAX_VISIBLE_MARKERS,
} from '../helpers/metrics';
import { type CalendarMarker, type CalendarMarkerTone } from '../types';

/**
 * The same tone-to-system-colour mapping [ui/chip.tsx](../../../ui/chip.tsx)
 * uses. `accent` is named explicitly because this is plain RN, with no SwiftUI
 * to inherit the system accent.
 */
const toneColor: Record<CalendarMarkerTone, ColorValue> = {
  accent: colors.accent,
  success: colors.systemGreen,
  warning: colors.systemOrange,
};

const styles = StyleSheet.create({
  /** Fixed height with or without markers, so the grid does not jitter as markers arrive. */
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
   * Overflow widens the last dot into a lozenge rather than adding a fourth,
   * which keeps the cell's width — and so the column grid — untouched.
   */
  overflow: {
    width: CALENDAR_MARKER_DOT_SIZE * 2,
  },
});

export interface CalendarMarkerDotsProps {
  /** Every marker on the day. The full count still reaches VoiceOver. */
  markers: readonly CalendarMarker[];
  /**
   * Whether the day is the selected one. Its accent circle sits behind these
   * dots, where a status colour would be illegible, so they invert.
   */
  isSelected: boolean;
}

/**
 * The workout dots under a day number, capped at `CALENDAR_MAX_VISIBLE_MARKERS`
 * positions. Decorative: the cell announces the count itself.
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
