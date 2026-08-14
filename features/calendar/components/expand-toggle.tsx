import type { StyleProp, ViewStyle } from 'react-native';
import type { AnimatedStyle } from 'react-native-reanimated';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors } from '@/theme/colors';

/**
 * 28pt of drawn height plus 8pt of slop top and bottom is Apple's 44pt minimum
 * without spending 44pt of layout on a chevron.
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
   * A chevron drawn from two borders on a rotated square, because there is no SF
   * Symbol to reach for: this island is plain RN, SF Symbols arrive only through
   * SwiftUI inside a `Host`, and `expo-symbols` would mean a native dependency
   * and a rebuilt dev client for one 10pt glyph.
   *
   * **The rotation is not here** — it interpolates in
   * [use-expansion.ts](../hooks/use-expansion.ts), and cannot be split across
   * the two files because an animated `transform` array replaces a static one
   * rather than merging with it.
   */
  chevron: {
    width: 10,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.accent,
    borderRadius: 1,
  },
});

export interface CalendarExpandToggleProps {
  /** Whether the month grid is open. Announced, not drawn — see `chevronStyle`. */
  isExpanded: boolean;
  /** The chevron's animated rotation, from `useCalendarExpansion`. */
  chevronStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  /** Open the month, or close it back to the week strip. */
  onToggle: () => void;
}

/**
 * The control that opens and closes the month, centred below the calendar.
 *
 * A button rather than a drag grabber because the calendar is a row of a
 * scrolling SwiftUI `List`: a pan gesture would have to win the vertical drag
 * from a `UIScrollView` across the bridge, which Gesture Handler cannot
 * arbitrate, leaving that part of the screen feeling stuck.
 *
 * `isExpanded` is the caller's *intent*, flipped when the tap lands rather than
 * when the spring settles, so the announcement never trails the gesture.
 */
export const CalendarExpandToggle = ({
  isExpanded,
  chevronStyle,
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
    <Animated.View style={[styles.chevron, chevronStyle]} />
  </Pressable>
);
