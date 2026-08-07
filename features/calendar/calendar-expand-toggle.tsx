import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * 28pt of drawn height plus 8pt of slop top and bottom is Apple's 44pt minimum
 * without spending 44pt of layout on a chevron. The horizontal slop is generous
 * for the same reason: the glyph is 10pt wide and the strip below the calendar
 * is otherwise empty, so there is nothing to steal the touch from.
 */
const HIT_SLOP = { top: 8, bottom: 8, left: 32, right: 32 };

const styles = StyleSheet.create({
  toggle: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    width: 44,
  },
  /**
   * A chevron drawn from two borders on a rotated square, because there is no
   * SF Symbol to reach for here: this island is plain React Native, and SF
   * Symbols only arrive through SwiftUI's `Image systemName` inside a `Host`,
   * which this cannot open. Adding `expo-symbols` would mean a native
   * dependency, a `pod install` and a rebuilt dev client for one 10pt glyph.
   *
   * The square's borders meet at its bottom-right corner, so 45° points the
   * corner down and 225° points it up. Both rotate about the same centre, so
   * the two states occupy identical space and nothing shifts as it flips.
   */
  chevron: {
    width: 10,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.accent,
    borderRadius: 1,
  },
  chevronCollapsed: {
    transform: [{ rotate: '45deg' }, { translateY: -2 }],
  },
  chevronExpanded: {
    transform: [{ rotate: '225deg' }, { translateY: -2 }],
  },
});

export interface CalendarExpandToggleProps {
  /** Whether the month grid is currently open. Drives the chevron. */
  isExpanded: boolean;
  /** Open the month, or close it back to the week strip. */
  onToggle: () => void;
}

/**
 * The control that opens and closes the month, sitting centred below the
 * calendar where the library's own drag grabber used to be.
 *
 * It is a button rather than that grabber because the calendar is a row of a
 * scrolling `List`: a pan gesture over it would have to win the vertical drag
 * away from the list, which makes that part of the screen feel stuck. A tap
 * target competes with nothing.
 *
 * Chevron only, no text. The label lives in `accessibilityLabel` and the
 * position in `accessibilityState`, so VoiceOver hears "Show month, button" and
 * the layout keeps a symmetrical strip that reads as part of the calendar
 * rather than as a control bar.
 */
export const CalendarExpandToggle = ({
  isExpanded,
  onToggle,
}: CalendarExpandToggleProps) => (
  <Pressable
    style={styles.toggle}
    hitSlop={HIT_SLOP}
    onPress={onToggle}
    accessibilityRole="button"
    accessibilityState={{ expanded: isExpanded }}
    accessibilityLabel={isExpanded ? 'Show week' : 'Show month'}
  >
    <View
      style={[
        styles.chevron,
        isExpanded ? styles.chevronExpanded : styles.chevronCollapsed,
      ]}
    />
  </Pressable>
);
